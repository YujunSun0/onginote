// 예전 data/db.json 의 인물·상담·메시지·사진을 Supabase 의 한 계정으로 옮긴다.
//
// 사용법 (먼저 그 계정으로 앱에 한 번 로그인해서 계정을 만들어 둔다):
//   node --env-file=.env.local scripts/import-db-json.mjs <로그인한 이메일> [--dry-run]
//
// - 이름이 "테스트"로 시작하는 인물과 그 상담은 옮기지 않는다 (테스트용 데이터).
// - 같은 id 가 이미 있으면 건너뛴다. 그래서 여러 번 실행해도 중복되지 않는다.
// - 사용량 기록은 옮기지 않는다 (하루 한도는 오늘부터 새로 센다).
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const [email, flag] = process.argv.slice(2);
const dryRun = flag === "--dry-run";
if (!email) {
  console.error("사용법: node --env-file=.env.local scripts/import-db-json.mjs <이메일> [--dry-run]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error(".env.local 에 NEXT_PUBLIC_SUPABASE_URL 과 SUPABASE_SECRET_KEY 가 필요해요.");
  process.exit(1);
}
const sb = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUserId(email) {
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (u) return u.id;
    if (data.users.length < 200) return null;
  }
}

const userId = await findUserId(email);
if (!userId) {
  console.error(`${email} 계정이 없어요. 먼저 앱에서 그 계정으로 로그인해 주세요.`);
  process.exit(1);
}

const db = JSON.parse(await readFile(new URL("../data/db.json", import.meta.url), "utf8"));
const skipPersons = new Set(db.persons.filter((p) => p.name.startsWith("테스트")).map((p) => p.id));
const persons = db.persons.filter((p) => !skipPersons.has(p.id));
const sessions = db.sessions.filter((s) => !skipPersons.has(s.personId));
console.log(
  `옮길 것: 인물 ${persons.length}명, 상담 ${sessions.length}개 (테스트 인물 ${skipPersons.size}명과 그 상담 ${db.sessions.length - sessions.length}개는 제외)`,
);
if (dryRun) process.exit(0);

async function exists(table, id) {
  const { data } = await sb.from(table).select("id").eq("id", id).maybeSingle();
  return Boolean(data);
}

const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

for (const p of persons) {
  if (await exists("persons", p.id)) continue;
  const { error } = await sb.from("persons").insert({
    id: p.id,
    user_id: userId,
    name: p.name,
    relation: p.relation ?? "썸",
    mbti: p.mbti ?? null,
    age: p.age ?? null,
    birthday: p.birthday ?? null,
    likes: p.likes ?? [],
    dislikes: p.dislikes ?? [],
    contact_style: p.contactStyle ?? null,
    notes: p.notes ?? [],
    timeline: p.timeline ?? [],
    created_at: p.createdAt,
  });
  if (error) throw new Error(`인물 ${p.name}: ${error.message}`);
  console.log(`인물: ${p.name}`);
}

for (const s of sessions) {
  if (await exists("sessions", s.id)) continue;
  const last = s.messages.at(-1);
  const { error } = await sb.from("sessions").insert({
    id: s.id,
    user_id: userId,
    character_id: s.characterId,
    person_id: s.personId,
    voice: Boolean(s.voice),
    mode: s.mode ?? "listen",
    plan_offered_at: s.planOfferedAt ?? null,
    summary: s.summary ?? null,
    follow_up: s.followUp ?? null,
    message_count: s.messages.length,
    user_message_count: s.messages.filter((m) => m.role === "user").length,
    last_text: last ? last.text.split(/\n?---\n?/).join(" ").slice(0, 200) : null,
    last_at: last?.at ?? null,
    created_at: s.createdAt,
  });
  if (error) throw new Error(`상담 ${s.id}: ${error.message}`);

  const rows = [];
  for (const m of s.messages) {
    const imgs = m.images ?? (m.image ? [m.image] : []);
    const stored = [];
    for (const img of imgs) {
      const path = `${userId}/${s.id}/${crypto.randomUUID()}.${EXT[img.mediaType] ?? "jpg"}`;
      const { error: upErr } = await sb.storage
        .from("chat-images")
        .upload(path, Buffer.from(img.data, "base64"), { contentType: img.mediaType });
      if (upErr) throw new Error(`사진 올리기: ${upErr.message}`);
      stored.push({ mediaType: img.mediaType, path });
    }
    rows.push({
      session_id: s.id,
      user_id: userId,
      role: m.role,
      text: m.text,
      images: stored.length ? stored : null,
      mode: m.mode ?? null,
      created_at: m.at,
    });
  }
  const { error: mErr } = await sb.from("messages").insert(rows);
  if (mErr) {
    // 메시지 없는 빈 상담이 남으면 다음 실행에서 건너뛰게 되니 지우고 멈춘다
    await sb.from("sessions").delete().eq("id", s.id);
    throw new Error(`메시지 ${s.id}: ${mErr.message}`);
  }
  console.log(`상담: ${s.summary?.title ?? s.id} (메시지 ${rows.length}개)`);
}

console.log("끝났어요.");
