import { requireUser } from "@/lib/auth";
import { BillingError, prepareBilling } from "@/lib/billing";
import { businessReady } from "@/lib/legal";

/** 카드 등록 창을 열기 직전: 정기결제 동의를 받고 구매자 키를 준다 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const body = (await req.json().catch(() => ({}))) as { agreed?: unknown };
  if (body.agreed !== true) return Response.json({ error: "자동 결제에 동의해 주세요." }, { status: 400 });
  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
  if (!clientKey || !process.env.TOSS_SECRET_KEY) {
    return Response.json({ error: "결제 설정이 아직 안 됐어요. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }
  // 실제 결제는 사업자 정보를 약관·결제 화면에 표시한 뒤에만 연다 (전자상거래법 제10조)
  if (clientKey.startsWith("live_") && !businessReady()) {
    console.error("live 결제 키가 있지만 사업자 정보(src/lib/legal.ts BUSINESS)가 비어 있어요.");
    return Response.json({ error: "결제 준비 중이에요. 조금만 기다려 주세요." }, { status: 503 });
  }
  try {
    const customerKey = await prepareBilling(auth.ctx.userId);
    const { data } = await auth.ctx.sb.auth.getUser();
    return Response.json({ customerKey, clientKey, email: data.user?.email ?? null });
  } catch (err) {
    console.error(err);
    const status = err instanceof BillingError ? err.status : 500;
    return Response.json({ error: err instanceof BillingError ? err.message : "준비하지 못했어요." }, { status });
  }
}
