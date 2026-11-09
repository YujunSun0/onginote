import type { NextRequest } from "next/server";
import { getDb, updateDb } from "@/lib/db";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/sessions/[id]">) {
  const { id } = await ctx.params;
  const db = await getDb();
  const session = db.sessions.find((s) => s.id === id);
  if (!session) return Response.json({ error: "not found" }, { status: 404 });
  const person = session.personId ? db.persons.find((p) => p.id === session.personId) ?? null : null;
  return Response.json({ session, person });
}

/** 선톡 확인 처리, 선톡 켜기/끄기 */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/sessions/[id]">) {
  const { id } = await ctx.params;
  const body = (await request.json()) as { dismissFollowUp?: boolean; followUpMuted?: boolean };
  const followUp = await updateDb((db) => {
    const s = db.sessions.find((x) => x.id === id);
    if (!s?.followUp) return null;
    if (body.dismissFollowUp) s.followUp.dismissed = true;
    if (typeof body.followUpMuted === "boolean") s.followUp.muted = body.followUpMuted;
    return s.followUp;
  });
  return Response.json({ ok: true, followUp });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/sessions/[id]">) {
  const { id } = await ctx.params;
  await updateDb((db) => {
    db.sessions = db.sessions.filter((s) => s.id !== id);
  });
  return Response.json({ ok: true });
}
