import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { deletePerson, getPerson, listSessions, updatePerson } from "@/lib/db";
import { summaryState, type Person } from "@/lib/types";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/persons/[id]">) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const person = await getPerson(auth.ctx, id);
  if (!person) return Response.json({ error: "not found" }, { status: 404 });
  const sessions = (await listSessions(auth.ctx, id)).map((s) => ({
    id: s.id,
    characterId: s.characterId,
    createdAt: s.createdAt,
    title: s.summary?.title,
    summaryState: summaryState(s.summary, s.messageCount),
  }));
  return Response.json({ person, sessions });
}

/** 사용자가 프로필을 직접 고칠 때. 배열 필드도 통째로 받는다. */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/persons/[id]">) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const patch = (await request.json()) as Partial<Person>;
  const allowed: (keyof Person)[] = [
    "name", "relation", "mbti", "age", "birthday", "likes", "dislikes", "contactStyle", "notes", "timeline",
  ];
  const clean: Partial<Person> = {};
  for (const key of allowed) {
    if (key in patch) (clean as Record<string, unknown>)[key] = patch[key];
  }
  const person = await updatePerson(auth.ctx, id, clean);
  if (!person) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(person);
}

/** "이 사람 기록 전체 삭제": 프로필과 그 사람에 대한 상담 기록을 모두 지운다. */
export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/persons/[id]">) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  await deletePerson(auth.ctx, id);
  return Response.json({ ok: true });
}
