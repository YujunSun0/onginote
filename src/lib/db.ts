import type { SupabaseClient } from "@supabase/supabase-js";
import { splitBubbles } from "./format";
import type { ChatImage, ChatMessage, FollowUp, Person, Session, SessionMeta, Summary } from "./types";

/**
 * Supabase 저장소. 모든 함수는 로그인한 사용자의 클라이언트(RLS 적용)를 받아서
 * 본인 데이터만 읽고 쓴다. user_id 는 DB 기본값(auth.uid())으로 채워진다.
 */
export interface Ctx {
  sb: SupabaseClient;
  userId: string;
}

const IMAGE_BUCKET = "chat-images";
const SIGNED_URL_SECONDS = 60 * 60;

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`${what}: ${error?.message ?? "unknown"}`);
}

// ─────────────────────────────────────────────
// 인물
// ─────────────────────────────────────────────

interface PersonRow {
  id: string;
  name: string;
  relation: string;
  mbti: string | null;
  age: string | null;
  birthday: string | null;
  likes: string[];
  dislikes: string[];
  contact_style: string | null;
  notes: string[];
  timeline: { date: string; text: string }[];
  created_at: string;
}

const PERSON_COLS = "id,name,relation,mbti,age,birthday,likes,dislikes,contact_style,notes,timeline,created_at";

function toPerson(r: PersonRow): Person {
  return {
    id: r.id,
    name: r.name,
    relation: r.relation,
    mbti: r.mbti ?? undefined,
    age: r.age ?? undefined,
    birthday: r.birthday ?? undefined,
    likes: r.likes ?? [],
    dislikes: r.dislikes ?? [],
    contactStyle: r.contact_style ?? undefined,
    notes: r.notes ?? [],
    timeline: r.timeline ?? [],
    createdAt: r.created_at,
  };
}

/** Person 일부 → DB 컬럼. undefined 인 필드는 건드리지 않는다. */
function personRow(p: Partial<Person>): Record<string, unknown> {
  const map: [keyof Person, string][] = [
    ["name", "name"], ["relation", "relation"], ["mbti", "mbti"], ["age", "age"], ["birthday", "birthday"],
    ["likes", "likes"], ["dislikes", "dislikes"], ["contactStyle", "contact_style"], ["notes", "notes"], ["timeline", "timeline"],
  ];
  const row: Record<string, unknown> = {};
  for (const [key, col] of map) if (key in p) row[col] = p[key] ?? null;
  return row;
}

export async function listPersons({ sb }: Ctx): Promise<Person[]> {
  const { data, error } = await sb.from("persons").select(PERSON_COLS).order("created_at");
  if (error) fail("인물 목록", error);
  return (data as PersonRow[]).map(toPerson);
}

export async function getPerson({ sb }: Ctx, id: string): Promise<Person | null> {
  const { data, error } = await sb.from("persons").select(PERSON_COLS).eq("id", id).maybeSingle();
  if (error) fail("인물 조회", error);
  return data ? toPerson(data as PersonRow) : null;
}

export async function createPerson({ sb }: Ctx, p: Partial<Person> & { name: string }): Promise<Person> {
  const { data, error } = await sb.from("persons").insert(personRow(p)).select(PERSON_COLS).single();
  if (error) fail("인물 만들기", error);
  return toPerson(data as PersonRow);
}

export async function updatePerson({ sb }: Ctx, id: string, patch: Partial<Person>): Promise<Person | null> {
  const row = personRow(patch);
  if (Object.keys(row).length === 0) return getPerson({ sb } as Ctx, id);
  const { data, error } = await sb.from("persons").update(row).eq("id", id).select(PERSON_COLS).maybeSingle();
  if (error) fail("인물 수정", error);
  return data ? toPerson(data as PersonRow) : null;
}

/** 인물과 그 사람에 대한 상담(사진 포함)을 모두 지운다. 상담 행은 DB cascade 로 지워진다. */
export async function deletePerson(ctx: Ctx, id: string): Promise<void> {
  const { data } = await ctx.sb.from("sessions").select("id").eq("person_id", id);
  for (const s of data ?? []) await removeSessionImages(ctx, s.id as string);
  const { error } = await ctx.sb.from("persons").delete().eq("id", id);
  if (error) fail("인물 삭제", error);
}

// ─────────────────────────────────────────────
// 상담
// ─────────────────────────────────────────────

interface SessionRow {
  id: string;
  character_id: Session["characterId"];
  person_id: string | null;
  voice: boolean;
  mode: Session["mode"];
  plan_offered_at: number | null;
  summary: Summary | null;
  follow_up: FollowUp | null;
  message_count: number;
  user_message_count: number;
  last_text: string | null;
  last_at: string | null;
  created_at: string;
}

const SESSION_COLS =
  "id,character_id,person_id,voice,mode,plan_offered_at,summary,follow_up,message_count,user_message_count,last_text,last_at,created_at";

function toMeta(r: SessionRow): SessionMeta {
  return {
    id: r.id,
    characterId: r.character_id,
    personId: r.person_id,
    voice: r.voice,
    mode: r.mode,
    planOfferedAt: r.plan_offered_at,
    summary: r.summary ?? undefined,
    followUp: r.follow_up ?? undefined,
    createdAt: r.created_at,
    messageCount: r.message_count,
    userMessageCount: r.user_message_count,
    lastText: r.last_text,
    lastAt: r.last_at,
  };
}

export async function listSessions({ sb }: Ctx, personId?: string): Promise<SessionMeta[]> {
  let q = sb.from("sessions").select(SESSION_COLS).order("created_at");
  if (personId) q = q.eq("person_id", personId);
  const { data, error } = await q;
  if (error) fail("상담 목록", error);
  return (data as SessionRow[]).map(toMeta);
}

export async function getSessionMeta({ sb }: Ctx, id: string): Promise<SessionMeta | null> {
  const { data, error } = await sb.from("sessions").select(SESSION_COLS).eq("id", id).maybeSingle();
  if (error) fail("상담 조회", error);
  return data ? toMeta(data as SessionRow) : null;
}

interface MessageRow {
  role: ChatMessage["role"];
  text: string;
  images: ChatImage[] | null;
  mode: ChatMessage["mode"] | null;
  created_at: string;
}

/**
 * 상담과 메시지 전체. imageUrls 면 화면에 보여줄 서명 URL 을 붙인다.
 * (Claude 에 보낼 때는 loadImageData 로 최근 사진만 따로 내려받는다)
 */
export async function getSession(ctx: Ctx, id: string, opts: { imageUrls?: boolean } = {}): Promise<(SessionMeta & Session) | null> {
  const meta = await getSessionMeta(ctx, id);
  if (!meta) return null;
  const { data, error } = await ctx.sb
    .from("messages")
    .select("role,text,images,mode,created_at")
    .eq("session_id", id)
    .order("id");
  if (error) fail("메시지 조회", error);
  const messages: ChatMessage[] = (data as MessageRow[]).map((m) => ({
    role: m.role,
    text: m.text,
    images: m.images?.length ? m.images : undefined,
    mode: m.mode ?? undefined,
    at: m.created_at,
  }));
  if (opts.imageUrls) await attachImageUrls(ctx, messages);
  return { ...meta, messages };
}

export async function createSession(
  { sb }: Ctx,
  s: { characterId: Session["characterId"]; personId: string | null; voice: boolean },
): Promise<SessionMeta> {
  const { data, error } = await sb
    .from("sessions")
    .insert({ character_id: s.characterId, person_id: s.personId, voice: s.voice })
    .select(SESSION_COLS)
    .single();
  if (error) fail("상담 만들기", error);
  return toMeta(data as SessionRow);
}

export async function updateSession(
  { sb }: Ctx,
  id: string,
  patch: Partial<Pick<Session, "mode" | "planOfferedAt" | "summary" | "followUp">>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if ("mode" in patch) row.mode = patch.mode;
  if ("planOfferedAt" in patch) row.plan_offered_at = patch.planOfferedAt;
  if ("summary" in patch) row.summary = patch.summary ?? null;
  if ("followUp" in patch) row.follow_up = patch.followUp ?? null;
  const { error } = await sb.from("sessions").update(row).eq("id", id);
  if (error) fail("상담 수정", error);
}

/**
 * 메시지를 하나 붙인다. 사진(base64)이 있으면 Storage 에 올리고 경로만 저장한다.
 * 목록 화면용 개수·마지막 메시지도 같이 갱신하고, 바뀐 meta 를 돌려준다.
 */
export async function appendMessage(ctx: Ctx, meta: SessionMeta, msg: ChatMessage): Promise<SessionMeta> {
  const images = msg.images?.length ? await uploadImages(ctx, meta.id, msg.images) : null;
  const { error } = await ctx.sb.from("messages").insert({
    session_id: meta.id,
    role: msg.role,
    text: msg.text,
    images,
    mode: msg.mode ?? null,
    created_at: msg.at,
  });
  if (error) fail("메시지 저장", error);

  const next: SessionMeta = {
    ...meta,
    messageCount: meta.messageCount + 1,
    userMessageCount: meta.userMessageCount + (msg.role === "user" ? 1 : 0),
    lastText: splitBubbles(msg.text).join(" ").slice(0, 200),
    lastAt: msg.at,
  };
  const { error: e2 } = await ctx.sb
    .from("sessions")
    .update({
      message_count: next.messageCount,
      user_message_count: next.userMessageCount,
      last_text: next.lastText,
      last_at: next.lastAt,
    })
    .eq("id", meta.id);
  if (e2) fail("상담 갱신", e2);
  return next;
}

export async function deleteSession(ctx: Ctx, id: string): Promise<void> {
  await removeSessionImages(ctx, id);
  const { error } = await ctx.sb.from("sessions").delete().eq("id", id);
  if (error) fail("상담 삭제", error);
}

// ─────────────────────────────────────────────
// 사진 (Storage)
// ─────────────────────────────────────────────

const EXT: Record<ChatImage["mediaType"], string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

async function uploadImages({ sb, userId }: Ctx, sessionId: string, images: ChatImage[]): Promise<ChatImage[]> {
  const out: ChatImage[] = [];
  for (const img of images) {
    if (img.path) {
      out.push({ mediaType: img.mediaType, path: img.path });
      continue;
    }
    if (!img.data) continue;
    const path = `${userId}/${sessionId}/${crypto.randomUUID()}.${EXT[img.mediaType] ?? "jpg"}`;
    const { error } = await sb.storage
      .from(IMAGE_BUCKET)
      .upload(path, Buffer.from(img.data, "base64"), { contentType: img.mediaType });
    if (error) fail("사진 올리기", error);
    out.push({ mediaType: img.mediaType, path });
  }
  return out;
}

async function attachImageUrls({ sb }: Ctx, messages: ChatMessage[]): Promise<void> {
  const paths = messages.flatMap((m) => (m.images ?? []).map((i) => i.path)).filter((p): p is string => Boolean(p));
  if (paths.length === 0) return;
  const { data, error } = await sb.storage.from(IMAGE_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error) return; // 사진을 못 보여줘도 대화는 보여준다
  const urls = new Map(data.map((d) => [d.path, d.signedUrl]));
  for (const m of messages) {
    m.images = m.images?.map((i) => ({ ...i, url: (i.path && urls.get(i.path)) || undefined }));
  }
}

/** Claude 에 보낼 사진을 base64 로 내려받는다. 이미 data 가 있으면 그대로 쓴다. */
export async function loadImageData({ sb }: Ctx, images: ChatImage[]): Promise<ChatImage[]> {
  return Promise.all(
    images.map(async (img) => {
      if (img.data || !img.path) return img;
      const { data, error } = await sb.storage.from(IMAGE_BUCKET).download(img.path);
      if (error || !data) return img;
      return { ...img, data: Buffer.from(await data.arrayBuffer()).toString("base64") };
    }),
  );
}

async function removeSessionImages({ sb, userId }: Ctx, sessionId: string): Promise<void> {
  const folder = `${userId}/${sessionId}`;
  const { data } = await sb.storage.from(IMAGE_BUCKET).list(folder, { limit: 1000 });
  if (data?.length) await sb.storage.from(IMAGE_BUCKET).remove(data.map((f) => `${folder}/${f.name}`));
}
