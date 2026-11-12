import { requireUser } from "@/lib/auth";
import { BillingError, confirmReportPayment } from "@/lib/billing";

/** 결제 승인을 기다리는 시간 (초). 토스 권장 응답 대기 60초 */
export const maxDuration = 120;

/** 결제창에서 돌아온 뒤 승인 (successUrl 의 paymentKey, orderId, amount) */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const body = (await req.json().catch(() => ({}))) as { paymentKey?: unknown; orderId?: unknown; amount?: unknown };
  if (typeof body.paymentKey !== "string" || typeof body.orderId !== "string" || !Number.isFinite(Number(body.amount))) {
    return Response.json({ error: "결제 정보가 올바르지 않아요." }, { status: 400 });
  }
  try {
    const result = await confirmReportPayment(auth.ctx.userId, { paymentKey: body.paymentKey, orderId: body.orderId, amount: Number(body.amount) });
    return Response.json(result);
  } catch (err) {
    if (err instanceof BillingError) return Response.json({ error: err.message, code: err.code }, { status: err.status });
    console.error("report confirm failed", err);
    return Response.json({ error: "결제를 확인하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
