import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { CHARACTERS } from "./characters";
import { REPORT_MODEL, getClient } from "./claude";
import type { Ctx } from "./db";
import { createAdminClient } from "./supabase/server";
import {
  LOVE_TYPES,
  RELATIONSHIP_UNLOCK_SESSIONS,
  WEATHER_IDS,
  type PersonalityReport,
  type RelationshipPreview,
  type RelationshipReport,
  type RelationshipView,
  type WeatherId,
} from "./report-types";
import { ReportError, latestReport, reportProgress } from "./reports";
import type { CharacterId, Person, Summary } from "./types";
import { recordUsage } from "./usage";

/**
 * 관계 흐름 리포트 (사람 한 명). 서버 전용.
 *
 * - 그 사람과 정리한 상담이 RELATIONSHIP_UNLOCK_SESSIONS 개 쌓이면 만들 수 있다. 그 뒤로는 같은 수만큼 더 쌓여야 새로.
 * - 연애 성향 리포트와 같은 표·같은 결제 흐름: 결제 전에는 미리보기(한 줄, 키워드, 마음 날씨)만 내보낸다.
 * - 상대를 진단하거나 마음을 단정하지 않는다. 사용자가 느낀 것과 한 말만으로 쓴다.
 */

const MAX_SOURCE_SESSIONS = 12;
const MAX_USER_MESSAGES = 16;
const MAX_MESSAGE_CHARS = 300;
const MAX_TIMELINE = 15;

const Evidence = z.string().describe("근거: 사용자가 실제로 한 말을 짧게 인용. 예: 11월 3일 상담에서 '요즘 답장이 짧아진 것 같아'라고 했어요");

const Schema = z.object({
  headline: z.string().describe("이 관계를 지금 한 줄로 (30자 안팎). 상대 이름 쓰지 마. 예: 서운함을 지나 다시 천천히 가까워지는 중"),
  keywords: z.array(z.string()).describe("이 관계를 나타내는 짧은 키워드 정확히 3개 (각 2~6자). 상대를 평가하는 말 금지"),
  weather: z
    .array(
      z.object({
        session: z.number().int().describe("상담 번호 (1부터)"),
        weather: z.enum(WEATHER_IDS).describe("그 상담에서 사용자 마음: sunny 맑음(설렘·안심), partly 구름 조금, cloudy 흐림(답답·애매), rainy 비(서운·슬픔), stormy 천둥(화·크게 흔들림)"),
        note: z.string().describe("그때 내 마음을 12자 안팎으로. 예: 답장 기다리며 조마조마"),
      }),
    )
    .describe("상담마다 하나씩, 상담 번호 순서대로. 상담 수와 같은 개수"),
  chapters: z
    .array(z.object({ title: z.string().describe("이 시기의 이름 (예: 알아가던 때)"), period: z.string().describe("언제쯤인지 (예: 11월 초)"), desc: z.string(), evidence: Evidence }))
    .describe("관계 흐름을 시기로 나눠 2~4개, 오래된 순"),
  recurring: z.array(z.object({ title: z.string(), desc: z.string(), evidence: Evidence })).describe("이 사람과 반복되는 고민 2개"),
  tried: z
    .array(z.object({ action: z.string().describe("정리 카드에서 정하고 실제로 한 것"), after: z.string().describe("그 뒤 상담에서 어땠는지") }))
    .describe("정한 할 것 중 [했음]인 것만 최대 3개. 한 게 없으면 빈 배열"),
  me: z.object({
    desc: z.string().describe("이 사람 앞에서 나는 어떤 모습인지 (2~3문장)"),
    evidence: Evidence,
    differs: z.string().nullable().describe("[평소의 나] 가 주어졌을 때만: 평소의 나와 다른 점 1~2문장. 주어지지 않았으면 null"),
  }),
  nextSteps: z.array(z.object({ title: z.string(), desc: z.string() })).describe("지금 단계에서 해볼 만한 구체적인 행동 2개"),
  characterNote: z.string().describe("가장 많이 상담한 캐릭터의 말투로 건네는 한마디 (2~3문장)"),
});
type ModelOut = z.infer<typeof Schema>;

const SYSTEM = `너는 연애 상담 앱 "온기노트"에서, 사용자가 한 사람에 대해 한 상담들을 바탕으로 "관계 흐름 리포트"를 쓰는 역할이야.
한국어 존댓말(해요체)로, 따뜻하지만 구체적으로 써.

[가장 중요한 규칙]
- 이 리포트는 사용자 쪽에서 본 관계 이야기야. 상대를 진단하거나 평가하지 마: "회피형", "나르시시스트", "가스라이팅", "그 사람은 원래 ~한 사람" 같은 말 금지.
- 상대의 속마음을 단정하지 마. "그 사람은 관심이 식었어요"가 아니라 "답장이 짧아졌을 때 나는 마음이 식었나 걱정했어요"처럼, 일어난 일과 내가 느낀 것으로 써.
- 근거(evidence)에는 사용자가 "실제로 한 말"만 짧게 인용해. 지어내지 마. 캐릭터나 정리 카드의 말은 인용하지 마.
- 상대는 "그 사람"이라고 불러. 이름이나 별명을 쓰지 마. 인용문 안의 이름도 "그 사람"으로, 다른 사람 이름은 "다른 사람"으로 바꿔.
- 누구에게나 들어맞는 말은 쓰지 마. 이 상담들에서만 나온 내용으로 써.
- 사용자를 고치려 들지 마. 해볼 것도 부담 없는 작은 행동으로.
- 심리 진단 용어(애착 유형, 장애, 증상, 트라우마)는 쓰지 마.
- 헤어짐, 폭력, 위협처럼 안전이 걱정되는 내용이 있으면 관계를 이어 가라고 권하지 말고, 사용자의 안전과 마음을 먼저 챙기는 쪽으로 써.`;

/** 그 사람과 정리한 상담 수 */
export async function countPersonSummarized({ sb }: Ctx, personId: string): Promise<number> {
  const { count } = await sb.from("sessions").select("id", { count: "exact", head: true }).eq("person_id", personId).not("summary", "is", null);
  return count ?? 0;
}

const COLS = "id, content, source_count, paid_at, order_id, created_at";
export interface RelationshipRow {
  id: string;
  content: RelationshipReport;
  source_count: number;
  paid_at: string | null;
  order_id: string | null;
  created_at: string;
}

/** 그 사람의 가장 최근 관계 흐름 리포트 (리포트 표는 사용자 권한이 없어서 관리자 권한으로 본인 것만) */
export async function latestRelationshipReport({ userId }: Ctx, personId: string): Promise<RelationshipRow | null> {
  const { data } = await createAdminClient()
    .from("reports")
    .select(COLS)
    .eq("user_id", userId)
    .eq("kind", "relationship")
    .eq("person_id", personId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as RelationshipRow | null) ?? null;
}

export function relationshipProgress(summarized: number, latestSourceCount: number | null) {
  // 연애 성향 리포트와 같은 규칙 (같은 수)
  return reportProgress(summarized, latestSourceCount, RELATIONSHIP_UNLOCK_SESSIONS);
}

export function toRelationshipView(row: RelationshipRow, characterId: CharacterId): RelationshipView {
  const c = row.content;
  const content: RelationshipPreview | RelationshipReport = row.paid_at ? c : { headline: c.headline, keywords: c.keywords, weather: c.weather };
  return { id: row.id, paid: !!row.paid_at, createdAt: row.created_at, sourceCount: row.source_count, orderId: row.order_id, content, characterId };
}

// ─────────────────────────────────────────────
// 데이터 읽기
// ─────────────────────────────────────────────
interface Source {
  characterId: CharacterId;
  date: string; // 한국 날짜
  summary: Summary;
  userMessages: string[];
}

const koreaDate = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(0, 10);

async function loadSources({ sb }: Ctx, personId: string): Promise<Source[]> {
  const { data: rows } = await sb
    .from("sessions")
    .select("id, character_id, created_at, summary")
    .eq("person_id", personId)
    .not("summary", "is", null)
    .order("created_at", { ascending: false })
    .limit(MAX_SOURCE_SESSIONS);
  const sessions = (rows ?? []) as { id: string; character_id: CharacterId; created_at: string; summary: Summary }[];
  if (sessions.length === 0) return [];
  const { data: msgs } = await sb
    .from("messages")
    .select("session_id, text")
    .eq("role", "user")
    .in("session_id", sessions.map((s) => s.id))
    .order("id");
  const bySession = new Map<string, string[]>();
  for (const m of (msgs ?? []) as { session_id: string; text: string }[]) {
    const list = bySession.get(m.session_id) ?? [];
    if (list.length < MAX_USER_MESSAGES) list.push(m.text.slice(0, MAX_MESSAGE_CHARS));
    bySession.set(m.session_id, list);
  }
  return sessions.reverse().map((s) => ({
    characterId: s.character_id,
    date: koreaDate(s.created_at),
    summary: s.summary,
    userMessages: bySession.get(s.id) ?? [],
  }));
}

/** 정한 할 것과 체크 여부 */
function todoText(s: Summary): string {
  if (!s.todo.length) return "없음";
  return s.todo.map((t, i) => `${t} [${s.todoDone?.[i] ? "했음" : "안 함"}]`).join(" / ");
}

export function sourceText(person: Pick<Person, "relation" | "timeline">, sources: Source[], usual: PersonalityReport | null): string {
  const parts = [`[관계] ${person.relation || "알 수 없음"}`];
  const timeline = (person.timeline ?? []).slice(-MAX_TIMELINE);
  if (timeline.length) parts.push(`[사용자가 기록한 지난 일]\n${timeline.map((t) => `- ${t.date}: ${t.text}`).join("\n")}`);
  if (usual) {
    parts.push(`[평소의 나] (연애 성향 리포트) ${LOVE_TYPES[usual.type].name} · ${usual.headline} · ${usual.keywords.join(", ")}`);
  }
  parts.push(
    sources
      .map((s, i) =>
        [
          `## 상담 ${i + 1} (${s.date})`,
          `정리 제목: ${s.summary.title}`,
          `상황: ${s.summary.situation}`,
          `해석: ${s.summary.interpretation}`,
          `정한 할 것: ${todoText(s.summary)}`,
          `사용자가 한 말:`,
          ...s.userMessages.map((t) => `- ${t.replace(/\s+/g, " ")}`),
        ].join("\n"),
      )
      .join("\n\n"),
  );
  return parts.join("\n\n");
}

/** 모델 출력을 저장할 모양으로: 날씨에 상담 날짜를 붙이고, 개수를 상담 수에 맞춘다 */
export function finalize(out: ModelOut, dates: string[]): RelationshipReport {
  const byIndex = new Map<number, { weather: WeatherId; note: string }>();
  for (const w of out.weather) if (w.session >= 1 && w.session <= dates.length && !byIndex.has(w.session)) byIndex.set(w.session, w);
  const weather = dates.flatMap((date, i) => {
    const w = byIndex.get(i + 1);
    return w ? [{ date, weather: w.weather, note: w.note }] : [];
  });
  return {
    headline: out.headline,
    keywords: out.keywords.slice(0, 3),
    weather,
    chapters: out.chapters,
    recurring: out.recurring,
    tried: out.tried.slice(0, 3),
    me: out.me,
    nextSteps: out.nextSteps,
    characterNote: out.characterNote,
  };
}

/** 그 사람과 가장 많이 상담한 캐릭터 */
export function topCharacterOf(ids: CharacterId[]): CharacterId {
  const counts = new Map<CharacterId, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  let best: CharacterId = "mongle";
  for (const [id, n] of counts) if (n > (counts.get(best) ?? 0)) best = id;
  return best;
}

export async function personTopCharacter({ sb }: Ctx, personId: string): Promise<CharacterId> {
  const { data } = await sb.from("sessions").select("character_id").eq("person_id", personId).not("summary", "is", null);
  return topCharacterOf(((data ?? []) as { character_id: CharacterId }[]).map((r) => r.character_id));
}

/** 리포트를 새로 만든다. 조건(정리한 상담 수)은 부르는 쪽에서 확인한다 */
export async function createRelationshipReport(ctx: Ctx, person: Person, summarized: number): Promise<RelationshipRow> {
  const sources = await loadSources(ctx, person.id);
  if (sources.length < RELATIONSHIP_UNLOCK_SESSIONS) throw new ReportError("이 사람과 정리한 상담이 더 필요해요.");
  const usualRow = await latestReport(ctx);
  const charId = topCharacterOf(sources.map((s) => s.characterId));
  const character = CHARACTERS[charId];

  const res = await getClient().messages.parse({
    model: REPORT_MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium", format: zodOutputFormat(Schema) },
    system: `${SYSTEM}\n\n[characterNote 를 쓸 캐릭터]\n${character.name} (${character.style})\n${character.persona}`,
    messages: [
      {
        role: "user",
        content: `[그 사람과의 상담 ${sources.length}개]\n\n${sourceText(person, sources, usualRow?.content ?? null)}`,
      },
    ],
  });
  await recordUsage(ctx.userId, "report", res.model ?? REPORT_MODEL, res.usage);
  if (res.stop_reason === "refusal" || !res.parsed_output) {
    throw new ReportError("리포트를 만들지 못했어요. 잠시 후 다시 시도해 주세요.", 502);
  }
  const content = finalize(res.parsed_output, sources.map((s) => s.date));
  if (!usualRow) content.me.differs = null;

  const { data, error } = await createAdminClient()
    .from("reports")
    .insert({ user_id: ctx.userId, kind: "relationship", person_id: person.id, content, source_count: summarized, model: res.model ?? REPORT_MODEL })
    .select(COLS)
    .single();
  if (error) throw error;
  return data as RelationshipRow;
}
