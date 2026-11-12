import { requireUser } from "@/lib/auth";
import { BillingError, cancelSubscription, refundLatest, resumeSubscription } from "@/lib/billing";

/** AI·결제 응답을 기다리는 시간 (Vercel 함수 최대 실행 시간, 초) */
export const maxDuration = 300;

/** 해지, 해지 취소, 환불 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { action } = (await req.json().catch(() => ({}))) as { action?: unknown };
  try {
    const userId = auth.ctx.userId;
    if (action === "cancel") return Response.json(await cancelSubscription(userId));
    if (action === "resume") return Response.json(await resumeSubscription(userId));
    if (action === "refund") {
      await refundLatest(userId);
      return Response.json({ status: "refunded" });
    }
    return Response.json({ error: "알 수 없는 요청이에요." }, { status: 400 });
  } catch (err) {
    if (err instanceof BillingError) return Response.json({ error: err.message }, { status: err.status });
    console.error(err);
    return Response.json({ error: "처리하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
