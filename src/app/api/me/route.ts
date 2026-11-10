import { requireUser } from "@/lib/auth";
import { getUsageStatus } from "@/lib/usage";
import { withdrawUser } from "@/lib/withdrawal";

const NICKNAME_MAX = 20;

/** 마이페이지: 내 정보와 기록 개수 */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { sb, userId } = auth.ctx;

  const [{ data: userData }, { data: profile }, persons, sessions, summaries, usage] = await Promise.all([
    sb.auth.getUser(),
    sb.from("profiles").select("display_name, created_at").eq("id", userId).maybeSingle(),
    sb.from("persons").select("id", { count: "exact", head: true }),
    sb.from("sessions").select("id", { count: "exact", head: true }),
    sb.from("sessions").select("id", { count: "exact", head: true }).not("summary", "is", null),
    getUsageStatus(userId),
  ]);
  const user = userData.user;
  const meta = user?.user_metadata ?? {};

  return Response.json({
    nickname: profile?.display_name ?? null,
    email: user?.email ?? null,
    provider: user?.app_metadata?.provider ?? null,
    avatarUrl: typeof meta.avatar_url === "string" ? meta.avatar_url.replace(/^http:/, "https:") : null,
    joinedAt: profile?.created_at ?? user?.created_at ?? null,
    counts: { persons: persons.count ?? 0, sessions: sessions.count ?? 0, summaries: summaries.count ?? 0 },
    usagePercent: usage.percent,
  });
}

/** 닉네임 수정 */
export async function PATCH(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { sb, userId } = auth.ctx;

  const body = (await req.json().catch(() => ({}))) as { nickname?: unknown };
  const nickname = typeof body.nickname === "string" ? body.nickname.trim().replace(/\s+/g, " ") : "";
  if (nickname.length < 1 || nickname.length > NICKNAME_MAX) {
    return Response.json({ error: `닉네임은 1~${NICKNAME_MAX}자로 적어 주세요.` }, { status: 400 });
  }
  const { error } = await sb.from("profiles").upsert({ id: userId, display_name: nickname });
  if (error) return Response.json({ error: "저장하지 못했어요." }, { status: 500 });
  return Response.json({ nickname });
}

/** 회원 탈퇴. 실수를 막으려고 본문에 { confirm: "탈퇴" } 가 있어야 한다. */
export async function DELETE(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { sb, userId } = auth.ctx;

  const body = (await req.json().catch(() => ({}))) as { confirm?: unknown };
  if (body.confirm !== "탈퇴") return Response.json({ error: "확인 문구가 맞지 않아요." }, { status: 400 });

  const { data } = await sb.auth.getUser();
  try {
    await withdrawUser(userId, data.user?.email);
  } catch (e) {
    console.error("withdraw failed", e);
    return Response.json({ error: "탈퇴를 처리하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
  await sb.auth.signOut({ scope: "local" }); // 계정은 이미 없으니 쿠키만 지운다
  return Response.json({ ok: true });
}
