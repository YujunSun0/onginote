import { requireUser } from "@/lib/auth";
import { PLUS_ORDER_NAME } from "@/lib/plans";

/** 결제 한 건의 상세 (영수증 화면). 본인 결제만 보인다 (RLS). */
export async function GET(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const orderId = new URL(req.url).searchParams.get("order") ?? "";
  const { sb } = auth.ctx;
  const [{ data: pay }, { data: sub }] = await Promise.all([
    sb
      .from("payments")
      .select("order_id, kind, status, amount, period_start, period_end, card_label, receipt_url, approved_at, refunded_at")
      .eq("order_id", orderId)
      .in("status", ["paid", "refunded"])
      .maybeSingle(),
    sb.from("subscriptions").select("status, current_period_end").maybeSingle(),
  ]);
  if (!pay) return Response.json({ error: "결제 내역을 찾을 수 없어요." }, { status: 404 });
  // 이 결제가 지금 기간의 결제이고 자동 결제 중이면 다음 결제일을 같이 보여준다
  const nextBillingAt =
    pay.status === "paid" && sub?.status === "active" && !!pay.period_end && new Date(sub.current_period_end).getTime() === new Date(pay.period_end).getTime() ? sub.current_period_end : null;
  return Response.json({ ...pay, orderName: PLUS_ORDER_NAME, nextBillingAt });
}
