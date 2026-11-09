import type { NextRequest } from "next/server";
import { CHARACTERS } from "@/lib/characters";
import { CHAT_MODEL, apiErrorMessage, getClient } from "@/lib/claude";
import { getDb } from "@/lib/db";
import { SAFETY_RULES, personContext } from "@/lib/prompts";
import { BUDGET_EXCEEDED_MESSAGE, recordUsage, usageStatus } from "@/lib/usage";

/** 프로필 화면의 "물어보기": 저장된 기록을 바탕으로 짧게 답한다. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/persons/[id]/ask">) {
  const { id } = await ctx.params;
  const { question } = (await request.json()) as { question: string };
  if (!question?.trim()) return Response.json({ error: "질문을 입력해 주세요." }, { status: 400 });

  const db = await getDb();
  const person = db.persons.find((p) => p.id === id);
  if (!person) return Response.json({ error: "not found" }, { status: 404 });
  if (usageStatus(db).exceeded) return Response.json({ error: BUDGET_EXCEEDED_MESSAGE, limit: "daily" }, { status: 429 });
  const character = CHARACTERS.mongle;

  try {
    const res = await getClient().messages.create({
      model: CHAT_MODEL,
      max_tokens: 16000,
      output_config: { effort: "low" },
      system: `${SAFETY_RULES}\n\n[캐릭터]\n${character.persona}\n\n${personContext(person)}\n\n사용자가 이 사람에 대해 물어보면 기록을 바탕으로 2~4문장으로 답해. 기록에 없는 건 지어내지 말고 "아직 기록이 없어"라고 말한 뒤, 물어볼 만한 방법을 제안해.`,
      messages: [{ role: "user", content: question.trim() }],
    });
    await recordUsage("ask", res.model ?? CHAT_MODEL, res.usage);
    const answer = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    return Response.json({ answer });
  } catch (err) {
    console.error(err);
    return Response.json({ error: apiErrorMessage(err) }, { status: 500 });
  }
}
