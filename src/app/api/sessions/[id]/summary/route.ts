import type { NextRequest } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { CHARACTERS } from "@/lib/characters";
import { CHAT_MODEL, apiErrorMessage, getClient } from "@/lib/claude";
import { getDb, updateDb } from "@/lib/db";
import { personContext, transcript } from "@/lib/prompts";
import type { FollowUp, Summary } from "@/lib/types";
import { recordUsage } from "@/lib/usage";

const SummarySchema = z.object({
  title: z.string().describe("상황을 15자 안팎으로 요약한 제목"),
  situation: z.string(),
  interpretation: z.string(),
  todo: z.array(z.string()).describe("할 것 1~3개"),
  dont: z.array(z.string()).describe("하지 말 것 0~2개"),
  followup_in_days: z.number().int().describe("며칠 뒤에 결과를 물어보면 좋을지 (1~7)"),
  followup_message: z.string().describe("그날 캐릭터가 먼저 보낼 안부 메시지 (캐릭터 말투, 1~2문장)"),
  profile_suggestions: z.array(
    z.object({
      field: z.enum(["likes", "dislikes", "contactStyle", "notes", "timeline", "mbti", "age", "birthday"]),
      value: z.string(),
    }),
  ),
});

const EXTRACT_RULES = `[프로필 추출 규칙]
- 대화에서 사용자가 상대에 대해 새로 말한 사실만 뽑아. 이미 프로필에 있는 건 빼.
- 추측하지 마. 사용자가 실제로 말한 것만.
- 건강, 질병, 성적 지향, 종교, 정치, 주소, 연락처, 직장명, 금융 정보 같은 민감한 정보는 절대 뽑지 마.
- timeline 은 "약속 변경 후 연락 끊김"처럼 이번 상담의 사건을 한 줄로 (날짜는 빼고).
- birthday 는 "MM-DD" 형식. 상담 대상 인물이 없으면 profile_suggestions 는 빈 배열.`;

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/sessions/[id]/summary">) {
  const { id } = await ctx.params;
  const db = await getDb();
  const session = db.sessions.find((s) => s.id === id);
  if (!session) return Response.json({ error: "not found" }, { status: 404 });
  const person = session.personId ? db.persons.find((p) => p.id === session.personId) ?? null : null;
  const character = CHARACTERS[session.characterId];

  try {
    const res = await getClient().messages.parse({
      model: CHAT_MODEL,
      max_tokens: 16000,
      output_config: { effort: "medium", format: zodOutputFormat(SummarySchema) },
      system: `너는 연애 상담 앱 "온기노트"에서 상담 내용을 한 장의 정리 카드로 만드는 역할이야. 한국어로, 짧고 따뜻하게 써.\n캐릭터: ${character.name} (${character.style})\n${character.persona}\n\n${personContext(person)}\n\n${EXTRACT_RULES}`,
      messages: [{ role: "user", content: `[상담 대화]\n${transcript(session.messages, 60)}` }],
    });
    await recordUsage("summary", res.model ?? CHAT_MODEL, res.usage, session.id);
    const out = res.parsed_output;
    if (!out) return Response.json({ error: "정리 카드를 만들지 못했어요. 다시 시도해 주세요." }, { status: 502 });

    const summary: Summary = {
      title: out.title,
      situation: out.situation,
      interpretation: out.interpretation,
      todo: out.todo,
      dont: out.dont,
      suggestions: person ? out.profile_suggestions : [],
      applied: false,
      messageCount: session.messages.length,
    };
    const days = Math.min(7, Math.max(1, out.followup_in_days || 3));
    const followUp: FollowUp = {
      dueAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
      message: out.followup_message,
      dismissed: false,
      muted: session.followUp?.muted, // 다시 정리해도 "안부 받지 않기" 설정은 유지
    };
    await updateDb((d) => {
      const s = d.sessions.find((x) => x.id === id);
      if (s) {
        s.summary = summary;
        s.followUp = followUp;
      }
    });
    return Response.json({ summary, followUp });
  } catch (err) {
    console.error(err);
    return Response.json({ error: apiErrorMessage(err) }, { status: 500 });
  }
}
