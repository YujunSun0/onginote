import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { getPerson, getSessionMeta, updatePerson, updateSession } from "@/lib/db";
import type { ProfileSuggestion } from "@/lib/types";

/** 정리 카드에서 사용자가 체크한 정보만 인물 프로필에 저장한다. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/sessions/[id]/apply">) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const { accepted } = (await request.json()) as { accepted: ProfileSuggestion[] };

  const session = await getSessionMeta(auth.ctx, id);
  const person = session?.personId ? await getPerson(auth.ctx, session.personId) : null;
  if (!session || !person) return Response.json({ error: "저장할 인물이 없어요." }, { status: 404 });

  // 서버가 어느 나라에 있든 한국 날짜로 (UTC로 자르면 한국 아침에는 어제 날짜가 된다)
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  for (const { field, value } of accepted) {
    const v = value.trim();
    if (!v) continue;
    switch (field) {
      case "likes":
      case "dislikes":
      case "notes":
        if (!person[field].includes(v)) person[field].push(v);
        break;
      case "timeline":
        person.timeline.unshift({ date: today, text: v });
        break;
      case "birthday": {
        // 사용자가 "1월 11일", "1/11"처럼 고쳐 써도 MM-DD로 맞춘다
        const b = normalizeBirthday(v);
        if (b) person.birthday = b;
        break;
      }
      case "contactStyle":
      case "mbti":
      case "age":
        person[field] = field === "mbti" ? v.toUpperCase() : v;
        break;
    }
  }
  const result = await updatePerson(auth.ctx, person.id, person);
  if (session.summary) await updateSession(auth.ctx, id, { summary: { ...session.summary, applied: true } });
  return Response.json(result);
}

function normalizeBirthday(v: string): string | null {
  const nums = v.match(/\d{1,2}/g);
  if (!nums || nums.length < 2) return null;
  const [m, d] = nums.slice(-2).map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
