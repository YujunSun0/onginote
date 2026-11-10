import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { deleteSession, getPerson, getSession, getSessionMeta, updateSession } from "@/lib/db";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/sessions/[id]">) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const session = await getSession(auth.ctx, id, { imageUrls: true });
  if (!session) return Response.json({ error: "not found" }, { status: 404 });
  const person = session.personId ? await getPerson(auth.ctx, session.personId) : null;
  return Response.json({ session, person });
}

/** 선톡 확인 처리, 선톡 켜기/끄기, 정리 카드의 할 것 체크 */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/sessions/[id]">) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const body = (await request.json()) as {
    dismissFollowUp?: boolean;
    followUpMuted?: boolean;
    todo?: { index: number; done: boolean };
  };
  const s = await getSessionMeta(auth.ctx, id);
  if (!s) return Response.json({ error: "not found" }, { status: 404 });

  const t = body.todo;
  if (s.summary && t && Number.isInteger(t.index) && t.index >= 0 && t.index < s.summary.todo.length) {
    const done = s.summary.todo.map((_, i) => Boolean(s.summary!.todoDone?.[i]));
    done[t.index] = Boolean(t.done);
    await updateSession(auth.ctx, id, { summary: { ...s.summary, todoDone: done } });
  }
  if (!s.followUp) return Response.json({ ok: true, followUp: null });
  const followUp = { ...s.followUp };
  if (body.dismissFollowUp) followUp.dismissed = true;
  if (typeof body.followUpMuted === "boolean") followUp.muted = body.followUpMuted;
  await updateSession(auth.ctx, id, { followUp });
  return Response.json({ ok: true, followUp });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/sessions/[id]">) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  await deleteSession(auth.ctx, id);
  return Response.json({ ok: true });
}
