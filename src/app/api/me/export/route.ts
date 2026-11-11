import { requireUser } from "@/lib/auth";

/** 내 기록 전체를 JSON 파일로 내려받는다 (개인정보 열람·이동 요청 대응). 사진은 파일 대신 저장 경로만 넣는다. */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { sb, userId } = auth.ctx;

  // RLS 때문에 본인 행만 나온다. user_id 조건은 한 번 더 확인하는 용도.
  const [{ data: userData }, profile, persons, sessions, messages, usage] = await Promise.all([
    sb.auth.getUser(),
    sb.from("profiles").select("display_name, created_at").eq("id", userId).maybeSingle(),
    sb.from("persons").select("*").eq("user_id", userId).order("created_at"),
    sb.from("sessions").select("*").eq("user_id", userId).order("created_at"),
    sb.from("messages").select("session_id, role, text, images, mode, sources, created_at").eq("user_id", userId).order("id"),
    sb.from("usage").select("at, kind, model, cost").eq("user_id", userId).order("at"),
  ]);
  const err = [profile, persons, sessions, messages, usage].find((r) => r.error)?.error;
  if (err) return Response.json({ error: "기록을 모으지 못했어요." }, { status: 500 });

  const bySession = new Map<string, unknown[]>();
  for (const m of messages.data ?? []) {
    const { session_id, ...rest } = m;
    bySession.set(session_id, [...(bySession.get(session_id) ?? []), rest]);
  }

  const out = {
    exportedAt: new Date().toISOString(),
    account: {
      email: userData.user?.email ?? null,
      provider: userData.user?.app_metadata?.provider ?? null,
      nickname: profile.data?.display_name ?? null,
      joinedAt: profile.data?.created_at ?? null,
    },
    persons: (persons.data ?? []).map(withoutUserId),
    sessions: (sessions.data ?? []).map((s) => ({ ...withoutUserId(s), messages: bySession.get(s.id) ?? [] })),
    usage: usage.data ?? [],
  };

  const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  return new Response(JSON.stringify(out, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="onginote-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

function withoutUserId<T extends { user_id?: unknown }>(row: T): Omit<T, "user_id"> {
  const copy = { ...row };
  delete copy.user_id;
  return copy;
}
