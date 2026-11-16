import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { CHARACTERS } from "./characters";
import { LIGHT_MODEL, getClient } from "./claude";
import type { Ctx } from "./db";
import {
  RECAP_REFRESH_SESSIONS,
  RECAP_SEASON,
  TIME_BUCKETS,
  TIME_BUCKET_IDS,
  WANTS,
  recapOk,
  type RecapContent,
  type RecapProgress,
  type RecapStats,
  type RecapView,
  type TimeBucket,
  type Want,
} from "./recap-types";
import { ReportError } from "./reports";
import { createAdminClient } from "./supabase/server";
import type { CharacterId, Mode, Summary } from "./types";
import { recordUsage } from "./usage";

/**
 * 연말 결산. 서버 전용. 무료.
 * 숫자는 모두 DB 기록으로 계산하고, AI(Haiku)는 고민 주제 묶기·한 줄·캐릭터 편지에만 한 번 쓴다.
 * 12/31 까지의 상담만 넣는다 (RECAP_SEASON.dataEnd).
 */

const MAX_TOPIC_SESSIONS = 60;
const TOPIC_TEXT_CHARS = 140;

const koreaDay = (iso: string) => new Date(Date.parse(iso) + 9 * 3600e3).toISOString().slice(0, 10);
const koreaHour = (iso: string) => new Date(Date.parse(iso) + 9 * 3600e3).getUTCHours();

export function bucketOf(hour: number): TimeBucket {
  if (hour < 6) return "dawn";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  if (hour < 22) return "evening";
  return "night";
}

export function wantOf(mode: Mode | string | null): Want | null {
  if (mode === "listen" || mode === "react" || mode === "chat") return "listen";
  if (mode === "explore" || mode === "interpret") return "think";
  if (mode === "offer_plan" || mode === "plan") return "plan";
  return null;
}

export interface StatSession {
  id: string;
  characterId: CharacterId;
  personId: string | null;
  summary: Summary | null;
}
export interface StatMessage {
  sessionId: string;
  role: "user" | "assistant";
  mode: string | null;
  createdAt: string;
}

function topKey<K extends string>(counts: Map<K, number>): [K, number] | null {
  let best: [K, number] | null = null;
  for (const [k, n] of counts) if (!best || n > best[1]) best = [k, n];
  return best;
}

/** 결산 숫자 (DB 조회 없는 순수 계산). 결산 기간 밖의 메시지와, 내가 말한 적 없는 상담은 뺀다 */
export function computeStats(
  sessions: StatSession[],
  messages: StatMessage[],
  relations: Map<string, string>,
  dataEnd = RECAP_SEASON.dataEnd,
): RecapStats | null {
  const end = Date.parse(dataEnd);
  const inRange = messages.filter((m) => Date.parse(m.createdAt) < end);
  const userMsgs = inRange.filter((m) => m.role === "user");
  const talked = new Set(userMsgs.map((m) => m.sessionId));
  const valid = sessions.filter((s) => talked.has(s.id));
  if (valid.length === 0) return null;

  const days = new Map<string, number>();
  const hours = Object.fromEntries(TIME_BUCKET_IDS.map((b) => [b, 0])) as Record<TimeBucket, number>;
  for (const m of userMsgs) {
    const d = koreaDay(m.createdAt);
    days.set(d, (days.get(d) ?? 0) + 1);
    hours[bucketOf(koreaHour(m.createdAt))]++;
  }
  const wants: Record<Want, number> = { listen: 0, think: 0, plan: 0 };
  for (const m of inRange) {
    if (m.role !== "assistant" || !talked.has(m.sessionId)) continue;
    const w = wantOf(m.mode);
    if (w) wants[w]++;
  }

  const byPerson = new Map<string, number>();
  const byChar = new Map<CharacterId, number>();
  let total = 0;
  let done = 0;
  for (const s of valid) {
    if (s.personId) byPerson.set(s.personId, (byPerson.get(s.personId) ?? 0) + 1);
    byChar.set(s.characterId, (byChar.get(s.characterId) ?? 0) + 1);
    if (s.summary) {
      total += s.summary.todo.length;
      done += s.summary.todo.filter((_, i) => s.summary!.todoDone?.[i]).length;
    }
  }
  const person = topKey(byPerson);
  const character = topKey(byChar)!;
  const longest = topKey(days);
  const topBucket = TIME_BUCKET_IDS.reduce((a, b) => (hours[b] > hours[a] ? b : a));

  return {
    firstDay: [...days.keys()].sort()[0],
    sessions: valid.length,
    activeDays: days.size,
    summarized: valid.filter((s) => s.summary).length,
    people: byPerson.size,
    topPerson: person ? { personId: person[0], relation: relations.get(person[0]) ?? "", sessions: person[1] } : null,
    hours,
    topBucket,
    wants,
    todos: { total, done },
    character: { id: character[0], sessions: character[1] },
    longestDay: longest ? { day: longest[0], messages: longest[1] } : null,
  };
}

/** 열리는 조건 확인용: 결산 기간 안에 내가 말한 상담 수와 날 수 */
export function progressOf(userMessages: { sessionId: string; createdAt: string }[], dataEnd = RECAP_SEASON.dataEnd): RecapProgress {
  const end = Date.parse(dataEnd);
  const inRange = userMessages.filter((m) => Date.parse(m.createdAt) < end);
  const sessions = new Set(inRange.map((m) => m.sessionId)).size;
  const days = new Set(inRange.map((m) => koreaDay(m.createdAt))).size;
  return { sessions, days, ok: recapOk(sessions, days) };
}

/** 고민 주제를 세고 많은 순으로 3개 */
export function countTopics(assigned: { session: number; topic: string }[], sessionCount: number): { name: string; count: number }[] {
  const seen = new Set<number>();
  const counts = new Map<string, number>();
  for (const a of assigned) {
    if (a.session < 1 || a.session > sessionCount || seen.has(a.session)) continue;
    const name = a.topic.trim().slice(0, 12);
    if (!name) continue;
    seen.add(a.session);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));
}

// ─────────────────────────────────────────────
// 데이터 읽기 (한 번에 1000줄까지만 오므로 나눠 읽는다)
// ─────────────────────────────────────────────
async function fetchAll<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

async function userMessages(sb: SupabaseClient) {
  const rows = await fetchAll<{ session_id: string; created_at: string }>((a, b) =>
    sb.from("messages").select("session_id, created_at").eq("role", "user").lt("created_at", RECAP_SEASON.dataEnd).order("id").range(a, b),
  );
  return rows.map((r) => ({ sessionId: r.session_id, createdAt: r.created_at }));
}

export async function recapProgress({ sb }: Ctx): Promise<RecapProgress> {
  return progressOf(await userMessages(sb));
}

const COLS = "id, content, source_count, created_at";
interface RecapRow {
  id: string;
  content: RecapContent;
  source_count: number;
  created_at: string;
}

export async function getRecapRow({ userId }: Ctx): Promise<RecapRow | null> {
  const { data } = await createAdminClient()
    .from("reports")
    .select(COLS)
    .eq("user_id", userId)
    .eq("kind", "recap")
    .eq("content->>season", RECAP_SEASON.id)
    .maybeSingle();
  return (data as RecapRow | null) ?? null;
}

export async function toRecapView({ sb }: Ctx, row: RecapRow): Promise<RecapView> {
  let topPersonName: string | null = null;
  const pid = row.content.stats.topPerson?.personId;
  if (pid) {
    const { data } = await sb.from("persons").select("name").eq("id", pid).maybeSingle();
    topPersonName = (data?.name as string | undefined) ?? null;
  }
  return { ...row.content, id: row.id, createdAt: row.created_at, topPersonName };
}

/** 다시 만들 수 있는지: 12/31 전이고, 만든 뒤 상담이 더 쌓였을 때 */
export function canRefresh(row: Pick<RecapRow, "source_count"> | null, progress: RecapProgress, now = Date.now()): boolean {
  return !!row && now < Date.parse(RECAP_SEASON.dataEnd) && progress.sessions - row.source_count >= RECAP_REFRESH_SESSIONS;
}

// ─────────────────────────────────────────────
// 만들기
// ─────────────────────────────────────────────
const Schema = z.object({
  topics: z
    .array(z.object({ session: z.number().int().describe("상담 번호"), topic: z.string().describe("고민 주제 (2~8자 명사구). 예: 답장 고민, 서운함, 고백 타이밍") }))
    .describe("상담마다 하나씩. 비슷한 고민은 같은 이름으로 묶어서 주제는 6개 이하로"),
  headline: z.string().describe("이 사람의 한 해 연애 고민을 한 줄로 (25자 안팎). 다정하게. 이름·진단 용어 금지. 예: 답장 하나에도 마음을 다 쓴 겨울"),
  letter: z.string().describe("가장 많이 상담한 캐릭터가 이 사람에게 쓰는 짧은 편지 (3~4문장, 캐릭터 말투). 숫자 한두 개를 자연스럽게 넣고, 내년을 응원하며 끝내"),
});

const SYSTEM = `너는 연애 상담 앱 "온기노트"의 연말 결산을 쓰는 역할이야. 사용자가 올해 한 상담 목록과 숫자를 보고 짧게 쓴다.
- 사람 이름이나 별명은 절대 쓰지 마 (상대는 "그 사람").
- 심리 진단처럼 들리는 말(애착 유형, 불안형, 회피형 등)은 쓰지 마.
- 평가하거나 고치려 들지 말고, 한 해 동안 고민한 것 자체를 다정하게 알아봐 줘.
- 고민 주제는 짧은 명사구로, 같은 고민은 같은 이름으로 묶어.`;

function statsText(s: RecapStats): string {
  const w = s.wants;
  const wSum = w.listen + w.think + w.plan || 1;
  return [
    `첫 상담: ${s.firstDay}, 상담 ${s.sessions}개, 대화한 날 ${s.activeDays}일`,
    `가장 많이 고민한 시간대: ${TIME_BUCKETS[s.topBucket].name}`,
    `원했던 것: ${(Object.keys(WANTS) as Want[]).map((k) => `${WANTS[k].name} ${Math.round((w[k] / wSum) * 100)}%`).join(", ")}`,
    `정한 할 일 ${s.todos.total}개 중 해본 것 ${s.todos.done}개`,
    s.topPerson ? `가장 많이 이야기한 사람: ${s.topPerson.relation || "소중한 사람"} (상담 ${s.topPerson.sessions}개)` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** 결산을 만들거나(처음), 새 기록으로 다시 만든다. 조건은 부르는 쪽에서 확인한다 */
export async function createRecap(ctx: Ctx, existing: RecapRow | null): Promise<RecapRow> {
  const { sb } = ctx;
  const [sessionRows, messageRows, personRows] = await Promise.all([
    fetchAll<{ id: string; character_id: CharacterId; person_id: string | null; summary: Summary | null; created_at: string }>((a, b) =>
      sb.from("sessions").select("id, character_id, person_id, summary, created_at").lt("created_at", RECAP_SEASON.dataEnd).order("created_at").range(a, b),
    ),
    fetchAll<{ session_id: string; role: "user" | "assistant"; mode: string | null; created_at: string; text: string }>((a, b) =>
      sb.from("messages").select("session_id, role, mode, created_at, text").lt("created_at", RECAP_SEASON.dataEnd).order("id").range(a, b),
    ),
    fetchAll<{ id: string; relation: string | null }>((a, b) => sb.from("persons").select("id, relation").range(a, b)),
  ]);
  const sessions: StatSession[] = sessionRows.map((s) => ({ id: s.id, characterId: s.character_id, personId: s.person_id, summary: s.summary }));
  const messages: StatMessage[] = messageRows.map((m) => ({ sessionId: m.session_id, role: m.role, mode: m.mode, createdAt: m.created_at }));
  const stats = computeStats(sessions, messages, new Map(personRows.map((p) => [p.id, p.relation ?? ""])));
  if (!stats) throw new ReportError("결산에 넣을 상담이 없어요.");

  // 주제 묶기에 넣을 상담: 내가 말한 상담, 최근 것부터 최대 60개. 정리 카드가 있으면 제목·상황, 없으면 첫 메시지
  const firstText = new Map<string, string>();
  for (const m of messageRows) if (m.role === "user" && !firstText.has(m.session_id)) firstText.set(m.session_id, m.text);
  const topicSessions = sessions.filter((s) => firstText.has(s.id)).slice(-MAX_TOPIC_SESSIONS);
  const lines = topicSessions.map((s, i) => {
    const text = s.summary ? `${s.summary.title} - ${s.summary.situation}` : (firstText.get(s.id) ?? "");
    return `${i + 1}. ${text.replace(/\s+/g, " ").slice(0, TOPIC_TEXT_CHARS)}`;
  });
  const character = CHARACTERS[stats.character.id];

  const res = await getClient().messages.parse({
    model: LIGHT_MODEL,
    max_tokens: 4000,
    output_config: { format: zodOutputFormat(Schema) },
    system: `${SYSTEM}\n\n[편지를 쓸 캐릭터]\n${character.name} (${character.style})\n${character.persona}`,
    messages: [{ role: "user", content: `[숫자]\n${statsText(stats)}\n\n[상담 ${lines.length}개]\n${lines.join("\n")}` }],
  });
  await recordUsage(ctx.userId, "report", res.model ?? LIGHT_MODEL, res.usage);
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new ReportError("결산을 만들지 못했어요. 잠시 후 다시 시도해 주세요.", 502);
  const out = res.parsed_output;

  const content: RecapContent = {
    season: RECAP_SEASON.id,
    stats,
    topics: countTopics(out.topics, lines.length),
    headline: out.headline,
    letter: out.letter,
  };
  const admin = createAdminClient();
  const query = existing
    ? admin.from("reports").update({ content, source_count: stats.sessions, model: res.model ?? LIGHT_MODEL }).eq("id", existing.id).eq("user_id", ctx.userId)
    : admin.from("reports").insert({ user_id: ctx.userId, kind: "recap", content, source_count: stats.sessions, model: res.model ?? LIGHT_MODEL });
  const { data, error } = await query.select(COLS).single();
  if (error) {
    // 동시에 두 번 눌러서 이미 만들어졌으면 그걸 돌려준다
    if ((error as { code?: string }).code === "23505") {
      const row = await getRecapRow(ctx);
      if (row) return row;
    }
    throw error;
  }
  return data as RecapRow;
}
