import type { NextRequest } from "next/server";
import { updateDb } from "@/lib/db";
import type { ProfileSuggestion } from "@/lib/types";

/** 정리 카드에서 사용자가 체크한 정보만 인물 프로필에 저장한다. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/sessions/[id]/apply">) {
  const { id } = await ctx.params;
  const { accepted } = (await request.json()) as { accepted: ProfileSuggestion[] };

  const result = await updateDb((db) => {
    const session = db.sessions.find((s) => s.id === id);
    const person = session?.personId ? db.persons.find((p) => p.id === session.personId) : undefined;
    if (!session || !person) return null;

    const n = new Date(); // UTC로 자르면 한국 아침에는 어제 날짜가 돼서 로컬 날짜로
    const today = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
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
    if (session.summary) session.summary.applied = true;
    return person;
  });

  if (!result) return Response.json({ error: "저장할 인물이 없어요." }, { status: 404 });
  return Response.json(result);
}

function normalizeBirthday(v: string): string | null {
  const nums = v.match(/\d{1,2}/g);
  if (!nums || nums.length < 2) return null;
  const [m, d] = nums.slice(-2).map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
