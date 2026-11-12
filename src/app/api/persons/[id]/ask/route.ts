import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { CHARACTERS } from "@/lib/characters";
import { LIGHT_MODEL, apiErrorMessage, getClient } from "@/lib/claude";
import { getPerson } from "@/lib/db";
import { SAFETY_RULES, personContext } from "@/lib/prompts";
import { budgetExceededMessage, getUsageStatus, recordUsage } from "@/lib/usage";

/** AI·결제 응답을 기다리는 시간 (Vercel 함수 최대 실행 시간, 초) */
export const maxDuration = 300;

/** 프로필 화면의 "물어보기": 저장된 기록을 바탕으로 짧게 답한다. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/persons/[id]/ask">) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const { question } = (await request.json()) as { question: string };
  if (!question?.trim()) return Response.json({ error: "질문을 입력해 주세요." }, { status: 400 });

  const person = await getPerson(auth.ctx, id);
  if (!person) return Response.json({ error: "not found" }, { status: 404 });
  const usage = await getUsageStatus(auth.ctx.userId);
  if (usage.exceeded) return Response.json({ error: budgetExceededMessage(usage), limit: "daily" }, { status: 429 });
  const character = CHARACTERS.mongle;

  try {
    const res = await getClient().messages.create({
      model: LIGHT_MODEL,
      max_tokens: 16000,
      output_config: { effort: "low" },
      system: `${SAFETY_RULES}\n\n[캐릭터]\n${character.persona}\n\n${personContext(person)}\n\n사용자가 이 사람에 대해 물어보면 기록을 바탕으로 2~4문장으로 답해. 기록에 없는 건 지어내지 말고 "아직 기록이 없어"라고 말한 뒤, 물어볼 만한 방법을 제안해.`,
      messages: [{ role: "user", content: question.trim() }],
    });
    await recordUsage(auth.ctx.userId, "ask", res.model ?? LIGHT_MODEL, res.usage);
    const answer = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    return Response.json({ answer });
  } catch (err) {
    console.error(err);
    return Response.json({ error: apiErrorMessage(err) }, { status: 500 });
  }
}
