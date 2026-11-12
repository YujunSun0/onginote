import { requireUser } from "@/lib/auth";
import { checkRefund } from "@/lib/billing";
import { PLANS, PLUS_PRICE_KRW, REFUND_DAYS } from "@/lib/plans";
import { getUsageStatus } from "@/lib/usage";

/** /plus 화면: 내 구독, 결제 내역, 환불 가능 여부, 요금제 비교 숫자 */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { sb, userId } = auth.ctx;

  const [usage, { data: sub }, { data: payments }, refund] = await Promise.all([
    getUsageStatus(userId),
    sb.from("subscriptions").select("status, current_period_end, card_label, canceled_at, grace_until").eq("user_id", userId).maybeSingle(),
    sb
      .from("payments")
      .select("order_id, kind, status, amount, card_label, receipt_url, approved_at, refunded_at, created_at, period_end")
      .in("status", ["paid", "refunded", "failed"])
      .order("created_at", { ascending: false })
      .limit(24),
    checkRefund(userId),
  ]);

  const limits = (p: keyof typeof PLANS) => ({
    dailySearches: PLANS[p].dailySearches,
    sessionMessages: PLANS[p].sessionMessages,
    dailySessions: PLANS[p].dailySessions,
    monthlySessions: PLANS[p].monthlySessions,
  });
  return Response.json({
    plan: usage.plan,
    subscription: usage.plan === "plus" ? sub : null,
    payments: payments ?? [],
    refundable: refund.ok,
    price: PLUS_PRICE_KRW,
    refundDays: REFUND_DAYS,
    limits: { free: limits("free"), plus: limits("plus") },
  });
}
