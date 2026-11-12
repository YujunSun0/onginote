import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { CHARACTERS } from "./characters";
import { REPORT_MODEL, getClient } from "./claude";
import type { Ctx } from "./db";
import { createAdminClient } from "./supabase/server";
import { LOVE_TYPES, REPORT_UNLOCK_SESSIONS, TYPE_IDS, type PersonalityReport, type ReportPreview, type ReportView } from "./report-types";
import type { CharacterId, Summary } from "./types";
import { recordUsage } from "./usage";

/**
 * 나의 연애 성향 리포트. 서버 전용.
 *
 * - 정리한 상담이 REPORT_UNLOCK_SESSIONS 개 쌓이면 만들 수 있다 (무료도 가능).
 * - 한 번 만들어 저장하고, 결제 전에는 미리보기 부분만 내보낸다 (나머지는 화면에 보내지도 않는다).
 * - 리포트를 만든 뒤 정리한 상담이 REPORT_UNLOCK_SESSIONS 개 더 쌓이면 새로 만들 수 있다.
 * - 근거는 사용자 본인이 한 말만 쓴다. 심리 진단처럼 들리는 말은 쓰지 않는다.
 */

/** 리포트에 넣는 최근 정리된 상담 수 (비용 상한) */
const MAX_SOURCE_SESSIONS = 10;
/** 상담 하나에서 넣는 사용자 메시지 수와 길이 */
const MAX_USER_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 300;

const Evidence = z.string().describe("근거: 사용자가 실제로 한 말을 짧게 인용하고 몇 번의 상담에서 나왔는지. 예: 3번의 상담 중 2번에서 '내가 너무 매달리나'라고 했어요");

const ReportSchema = z.object({
  type: z.enum(TYPE_IDS).describe("가장 잘 맞는 유형 하나"),
  headline: z.string().describe("이 사람만을 위한 한 줄 정의 (30자 안팎). 유형 이름을 반복하지 마"),
  keywords: z.array(z.string()).describe("이 사람을 나타내는 짧은 키워드 정확히 3개 (각 2~6자)"),
  emotions: z
    .array(z.object({ name: z.string().describe("감정 이름 (예: 불안, 서운함, 설렘)"), desc: z.string(), evidence: Evidence }))
    .describe("고민할 때 자주 나오는 감정 3개, 많이 나온 순서"),
  values: z.array(z.object({ title: z.string(), desc: z.string(), evidence: Evidence })).describe("관계에서 중요하게 여기는 것 2~3개"),
  patterns: z
    .array(z.object({ situation: z.string().describe("이럴 때 (예: 답장이 늦을 때)"), reaction: z.string().describe("이렇게 하는 편"), evidence: Evidence }))
    .describe("불안하거나 갈등이 생길 때의 패턴 2개"),
  strengths: z.array(z.object({ title: z.string(), desc: z.string() })).describe("연애에서의 강점 3개"),
  stumbles: z
    .array(z.object({ title: z.string(), desc: z.string(), tryThis: z.string().describe("다음에 해볼 만한 구체적인 행동 하나") }))
    .describe("자주 걸려 넘어지는 지점 2개"),
  characterNote: z.string().describe("가장 많이 상담한 캐릭터의 말투로 건네는 한마디 (2~3문장)"),
});
/** 스키마와 화면용 타입이 어긋나지 않게 컴파일 때 확인한다 */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _schemaMatches: Same<z.infer<typeof ReportSchema>, PersonalityReport> = true;
void _schemaMatches;

export { REPORT_UNLOCK_SESSIONS };

export interface ReportRow {
  id: string;
  content: PersonalityReport;
  source_count: number;
  paid_at: string | null;
  order_id: string | null;
  created_at: string;
}

export function toView(row: ReportRow, characterId: CharacterId): ReportView {
  const c = row.content;
  const content: ReportPreview | PersonalityReport = row.paid_at
    ? c
    : { type: c.type, headline: c.headline, keywords: c.keywords, emotions: c.emotions };
  return { id: row.id, paid: !!row.paid_at, createdAt: row.created_at, sourceCount: row.source_count, orderId: row.order_id, content, characterId };
}

/** 리포트를 만들 수 있는지: 처음은 정리한 상담 N개, 그 뒤로는 지난 리포트 이후 N개 더 */
export function reportProgress(summarized: number, latestSourceCount: number | null) {
  const base = latestSourceCount ?? 0;
  const need = REPORT_UNLOCK_SESSIONS - (summarized - base);
  return { canCreate: need <= 0, remaining: Math.max(0, need), summarized };
}

// ─────────────────────────────────────────────
// 데이터 읽기
// ─────────────────────────────────────────────
interface SourceSession {
  id: string;
  characterId: CharacterId;
  relation: string | null;
  createdAt: string;
  summary: Summary;
  userMessages: string[];
}

export async function countSummarized({ sb }: Ctx): Promise<number> {
  const { count } = await sb.from("sessions").select("id", { count: "exact", head: true }).not("summary", "is", null);
  return count ?? 0;
}

// 리포트 표는 사용자 권한으로 읽을 수 없다 (결제 전 전체 내용 보호). 관리자 권한으로 본인 것만 읽는다.
const REPORT_COLS = "id, content, source_count, paid_at, order_id, created_at";

export async function latestReport({ userId }: Ctx): Promise<ReportRow | null> {
  const { data } = await createAdminClient()
    .from("reports")
    .select(REPORT_COLS)
    .eq("user_id", userId)
    .eq("kind", "personality")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ReportRow | null) ?? null;
}

export async function getReport({ userId }: Ctx, id: string): Promise<ReportRow | null> {
  const { data } = await createAdminClient().from("reports").select(REPORT_COLS).eq("id", id).eq("user_id", userId).maybeSingle();
  return (data as ReportRow | null) ?? null;
}

/** 내 리포트 전체 (내려받기용) */
export async function listReports({ userId }: Ctx): Promise<ReportRow[]> {
  const { data } = await createAdminClient().from("reports").select(REPORT_COLS).eq("user_id", userId).order("created_at");
  return (data ?? []) as ReportRow[];
}

/** 가장 많이 상담한 캐릭터 (정리된 상담 기준, 없으면 몽글) */
export async function topCharacter({ sb }: Ctx): Promise<CharacterId> {
  const { data } = await sb.from("sessions").select("character_id").not("summary", "is", null);
  const counts = new Map<CharacterId, number>();
  for (const r of (data ?? []) as { character_id: CharacterId }[]) counts.set(r.character_id, (counts.get(r.character_id) ?? 0) + 1);
  let best: CharacterId = "mongle";
  for (const [id, n] of counts) if (n > (counts.get(best) ?? 0)) best = id;
  return best;
}

async function loadSources({ sb }: Ctx): Promise<SourceSession[]> {
  const { data: rows } = await sb
    .from("sessions")
    .select("id, character_id, created_at, summary, persons(relation)")
    .not("summary", "is", null)
    .order("created_at", { ascending: false })
    .limit(MAX_SOURCE_SESSIONS);
  const sessions = (rows ?? []) as unknown as {
    id: string;
    character_id: CharacterId;
    created_at: string;
    summary: Summary;
    persons: { relation: string } | null;
  }[];
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
  // 오래된 것부터 (흐름을 읽기 쉽게)
  return sessions.reverse().map((s) => ({
    id: s.id,
    characterId: s.character_id,
    relation: s.persons?.relation ?? null,
    createdAt: s.created_at,
    summary: s.summary,
    userMessages: bySession.get(s.id) ?? [],
  }));
}

function sourceText(sources: SourceSession[]): string {
  return sources
    .map((s, i) => {
      const date = new Date(new Date(s.createdAt).getTime() + 9 * 3600e3).toISOString().slice(0, 10);
      return [
        `## 상담 ${i + 1} (${date}${s.relation ? `, 상대: ${s.relation}` : ""})`,
        `정리 제목: ${s.summary.title}`,
        `상황: ${s.summary.situation}`,
        `해석: ${s.summary.interpretation}`,
        `정한 할 것: ${s.summary.todo.join(" / ") || "없음"}`,
        `사용자가 한 말:`,
        ...s.userMessages.map((t) => `- ${t.replace(/\s+/g, " ")}`),
      ].join("\n");
    })
    .join("\n\n");
}

const SYSTEM = `너는 연애 상담 앱 "온기노트"에서, 사용자가 지금까지 한 상담을 바탕으로 "나의 연애 성향 리포트"를 쓰는 역할이야.
한국어 존댓말(해요체)로, 따뜻하지만 구체적으로 써.

[가장 중요한 규칙]
- 근거(evidence)에는 사용자가 "실제로 한 말"만 짧게 인용해. 지어내지 마. 캐릭터나 정리 카드의 말은 인용하지 마.
- 누구에게나 들어맞는 말(운세 같은 말)은 쓰지 마. 이 사람의 상담에서만 나온 내용으로 써.
- 심리 진단처럼 들리는 말은 쓰지 마: 애착 유형, 불안형/회피형, 장애, 증상, 트라우마 같은 용어 금지. "이런 경향이 보여요" 정도의 관찰로.
- 다른 사람의 이름이나 별명은 쓰지 마. "그 사람", "상대"라고 써. 인용문 안의 이름도 "그 사람"으로 바꿔.
- 사용자를 평가하거나 고치려 들지 마. 약점도 "이렇게 해 보면 더 편해질 수 있어요"처럼 다정하게.
- 유형은 아래 8개 중 하나만 골라:
${TYPE_IDS.map((id) => `  - ${id}: ${LOVE_TYPES[id].name} — ${LOVE_TYPES[id].desc}`).join("\n")}`;

export class ReportError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** 리포트를 새로 만든다. 조건(정리한 상담 수)은 부르는 쪽에서 확인한다 */
export async function createReport(ctx: Ctx, summarized: number): Promise<ReportRow> {
  const sources = await loadSources(ctx);
  if (sources.length < REPORT_UNLOCK_SESSIONS) throw new ReportError("정리한 상담이 더 필요해요.");
  const charId = await topCharacter(ctx);
  const character = CHARACTERS[charId];

  const res = await getClient().messages.parse({
    model: REPORT_MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium", format: zodOutputFormat(ReportSchema) },
    system: `${SYSTEM}\n\n[characterNote 를 쓸 캐릭터]\n${character.name} (${character.style})\n${character.persona}`,
    messages: [{ role: "user", content: `[지금까지의 상담 ${sources.length}개]\n\n${sourceText(sources)}` }],
  });
  await recordUsage(ctx.userId, "report", res.model ?? REPORT_MODEL, res.usage);
  if (res.stop_reason === "refusal" || !res.parsed_output) {
    throw new ReportError("리포트를 만들지 못했어요. 잠시 후 다시 시도해 주세요.", 502);
  }
  const out = res.parsed_output;
  const content: PersonalityReport = { ...out, keywords: out.keywords.slice(0, 3) };

  const { data, error } = await createAdminClient()
    .from("reports")
    .insert({ user_id: ctx.userId, kind: "personality", content, source_count: summarized, model: res.model ?? REPORT_MODEL })
    .select(REPORT_COLS)
    .single();
  if (error) throw error;
  return data as ReportRow;
}
