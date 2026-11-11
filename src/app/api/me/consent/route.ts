import { requireUser } from "@/lib/auth";
import { CONSENT_VERSION, hasConsented } from "@/lib/legal";
import { createAdminClient } from "@/lib/supabase/server";

const REQUIRED = ["age14", "terms", "privacy", "sensitive", "overseas"] as const;

/** 첫 로그인 동의. 필수 항목에 모두 동의해야 한다. */
export async function POST(req: Request) {
  const auth = await requireUser({ allowUnconsented: true });
  if ("response" in auth) return auth.response;
  const { sb, userId } = auth.ctx;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!REQUIRED.every((k) => body[k] === true)) {
    return Response.json({ error: "필수 항목에 모두 동의해 주세요." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const admin = createAdminClient();
  // 로그인 토큰에 동의 버전을 넣어서 proxy 가 DB 조회 없이 확인하게 한다 (app_metadata 는 서버만 바꿀 수 있다)
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { consent_version: CONSENT_VERSION, consented_at: now },
  });
  if (error) return Response.json({ error: "저장하지 못했어요. 다시 시도해 주세요." }, { status: 500 });
  await admin.from("profiles").update({ consent_version: CONSENT_VERSION, consented_at: now }).eq("id", userId);

  // 새 토큰을 받아 쿠키에 다시 쓴다 (안 하면 토큰이 만료될 때까지 동의 전으로 보인다)
  await sb.auth.refreshSession();
  return Response.json({ ok: true });
}

/**
 * 동의하지 않고 나가기.
 * 막 가입해서 기록이 하나도 없으면 계정을 지운다 (재가입 제한은 걸지 않는다).
 * 약관이 바뀌어 다시 동의를 받는 기존 회원은 기록을 지키려고 로그아웃만 한다.
 */
export async function DELETE() {
  const auth = await requireUser({ allowUnconsented: true });
  if ("response" in auth) return auth.response;
  const { sb, userId } = auth.ctx;

  const { data } = await sb.auth.getClaims();
  if (hasConsented(data?.claims)) {
    return Response.json({ error: "이미 동의한 계정은 마이페이지에서 탈퇴해 주세요." }, { status: 400 });
  }
  const [persons, sessions] = await Promise.all([
    sb.from("persons").select("id", { count: "exact", head: true }),
    sb.from("sessions").select("id", { count: "exact", head: true }),
  ]);
  const empty = !persons.error && !sessions.error && (persons.count ?? 0) === 0 && (sessions.count ?? 0) === 0;
  if (empty) await createAdminClient().auth.admin.deleteUser(userId);
  await sb.auth.signOut({ scope: "local" });
  return Response.json({ ok: true, deleted: empty });
}
