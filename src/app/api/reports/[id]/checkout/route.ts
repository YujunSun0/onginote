import { requireUser } from "@/lib/auth";
import { BillingError, prepareReportPayment } from "@/lib/billing";
import { businessReady } from "@/lib/legal";

/** 리포트 결제창을 열기 직전: 주문을 만들고 결제창에 넘길 값을 준다 */
export async function POST(req: Request, ctx: RouteContext<"/api/reports/[id]/checkout">) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const body = (await req.json().catch(() => ({}))) as { agreed?: unknown };
  // 디지털 콘텐츠: 결제하면 바로 열려서 청약철회가 제한된다는 것에 동의를 받는다 (전자상거래법 제17조 제2항·제6항)
  if (body.agreed !== true) return Response.json({ error: "결제 안내에 동의해 주세요." }, { status: 400 });
  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
  if (!clientKey || !process.env.TOSS_SECRET_KEY) {
    return Response.json({ error: "결제 설정이 아직 안 됐어요. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }
  if (clientKey.startsWith("live_") && !businessReady()) {
    console.error("live 결제 키가 있지만 사업자 정보(src/lib/legal.ts BUSINESS)가 비어 있어요.");
    return Response.json({ error: "결제 준비 중이에요. 조금만 기다려 주세요." }, { status: 503 });
  }
  const { id } = await ctx.params;
  try {
    const order = await prepareReportPayment(auth.ctx.userId, id);
    const { data } = await auth.ctx.sb.auth.getUser();
    return Response.json({ ...order, clientKey, email: data.user?.email ?? null });
  } catch (err) {
    if (err instanceof BillingError) return Response.json({ error: err.message, code: err.code }, { status: err.status });
    console.error(err);
    return Response.json({ error: "결제를 준비하지 못했어요." }, { status: 500 });
  }
}
