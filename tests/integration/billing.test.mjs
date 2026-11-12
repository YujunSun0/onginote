// 계정 2개로 로그인해서: 각자 기능이 되는지, 서로의 데이터가 안 보이는지, 한도가 막는지 확인한다.
import { B, admin, check, makeUser } from "./_lib.mjs";

export default async function testBilling() {
  const U = await makeUser("billing");
  const now = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  const usage = async () => (await U.api("/api/usage")).body;
  const renew = (secret = process.env.CRON_SECRET) => fetch(B + "/api/billing/renew", { method: "POST", headers: secret ? { Authorization: `Bearer ${secret}` } : {} }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const sub = async () => (await admin.from("subscriptions").select("*").eq("user_id", U.id).maybeSingle()).data;
  const setSub = (row) => admin.from("subscriptions").upsert({ user_id: U.id, plan: "plus", status: "active", retry_count: 0, next_retry_at: null, grace_until: null, canceled_at: null, ...row });
  const manage = (action) => U.api("/api/billing/manage", "POST", { action });

  try {
    // 스케줄러 보호
    check("renew: 비밀값 없으면 401", (await renew(null)).status === 401);
    check("renew: 틀린 비밀값 401", (await renew("wrong")).status === 401);
    const r0 = await renew();
    check("renew: 맞는 비밀값 200", r0.status === 200, JSON.stringify(r0.body));

    // 준비
    check("prepare: 동의 없으면 400", (await U.api("/api/billing/prepare", "POST", {})).status === 400);
    const p1 = await U.api("/api/billing/prepare", "POST", { agreed: true });
    check("prepare: 구매자 키 발급", p1.status === 200 && /^ongi_[0-9a-f-]{36}$/.test(p1.body.customerKey ?? ""), JSON.stringify(p1.body).slice(0, 120));
    const p2 = await U.api("/api/billing/prepare", "POST", { agreed: true });
    check("prepare: 같은 키 유지", p2.body.customerKey === p1.body.customerKey);
    check("prepare: 시크릿 키 안 내보냄", !JSON.stringify(p2.body).includes("_sk_") && !JSON.stringify(p2.body).includes("gsk"));
    const own = await U.sb.from("billing_customers").select("*");
    check("사용자가 billing_customers 못 읽음", !!own.error || (own.data ?? []).length === 0, own.error?.message);
    const st = await U.api("/api/billing/start", "POST", { authKey: "x", customerKey: "ongi_wrong" });
    check("start: 다른 구매자 키 거절", st.status === 400, JSON.stringify(st.body));
    const ip = await U.sb.from("payments").insert({ user_id: U.id, order_id: "hack-1234", kind: "first", status: "paid", amount: 1 });
    check("사용자가 결제 내역 못 씀", !!ip.error);

    // 결제 실패 → 재시도 → 만료 (가짜 빌링키라 토스가 거절한다)
    await admin.from("billing_customers").update({ billing_key: "fake-billing-key-for-test" }).eq("user_id", U.id);
    await setSub({ current_period_start: iso(now - 31 * 864e5), current_period_end: iso(now - 60e3) });
    let r = await renew();
    let s = await sub();
    check("갱신 실패 → past_due, 재시도 1", s.status === "past_due" && s.retry_count === 1 && !!s.grace_until, JSON.stringify(r.body));
    let u = await usage();
    check("재시도 중에도 Plus 유지", u.plan === "plus" && u.plusStatus === "past_due");
    const { data: pays } = await admin.from("payments").select("status,failure,order_id").eq("user_id", U.id);
    check("실패 결제 기록", pays.length === 1 && pays[0].status === "failed", JSON.stringify(pays[0]));
    r = await renew();
    check("다음 재시도 시각 전에는 다시 안 함", (await sub()).retry_count === 1 && r.body.failed === 0);
    for (let i = 0; i < 3; i++) {
      await admin.from("subscriptions").update({ next_retry_at: iso(Date.now() - 1000) }).eq("user_id", U.id);
      await renew();
    }
    s = await sub();
    check("3번 더 실패하면 expired", s.status === "expired", `status=${s.status} retry=${s.retry_count}`);
    check("만료되면 무료", (await usage()).plan === "free");
    const { data: cust } = await admin.from("billing_customers").select("billing_key").eq("user_id", U.id).single();
    check("만료되면 빌링키 지움", cust.billing_key === null);
    const { count: nPays } = await admin.from("payments").select("id", { count: "exact", head: true }).eq("user_id", U.id);
    check("결제 시도 4번 (처음 1 + 재시도 3)", nPays === 4, String(nPays));

    // 해지 / 해지 취소
    await admin.from("billing_customers").update({ billing_key: "fake-billing-key-for-test" }).eq("user_id", U.id);
    await setSub({ current_period_start: iso(now - 864e5), current_period_end: iso(now + 29 * 864e5) });
    check("해지", (await manage("cancel")).body.status === "canceled");
    check("해지 후에도 Plus", (await usage()).plusStatus === "canceled");
    check("두 번 해지는 거절", (await manage("cancel")).status === 400);
    check("해지 취소", (await manage("resume")).body.status === "active");
    await manage("cancel");
    await admin.from("subscriptions").update({ current_period_end: iso(Date.now() - 1000) }).eq("user_id", U.id);
    r = await renew();
    check("해지 후 기간 끝 → expired, 결제 안 함", (await sub()).status === "expired" && r.body.renewed === 0 && r.body.failed === 0, JSON.stringify(r.body));
    check("해지 만료 → 빌링키 지움", (await admin.from("billing_customers").select("billing_key").eq("user_id", U.id).single()).data.billing_key === null);
    check("만료 후 resume 거절", (await manage("resume")).status === 400);

    // 환불 가능 여부
    await setSub({ current_period_start: iso(now), current_period_end: iso(now + 30 * 864e5) });
    await admin.from("payments").insert({ user_id: U.id, order_id: `T-${now}`, kind: "first", status: "paid", amount: 15000, payment_key: "fake", approved_at: iso(Date.now() - 3600e3) });
    let b = (await U.api("/api/billing")).body;
    check("결제 직후 Plus 미사용 → 환불 가능", b.refundable === true && b.plan === "plus", JSON.stringify({ refundable: b.refundable, plan: b.plan }));
    check("결제 내역 보임", b.payments.some((p) => p.order_id === `T-${now}`));
    await admin.from("usage").insert({ user_id: U.id, day: new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10), kind: "chat", model: "claude-sonnet-5-5", cost: 0.01 });
    b = (await U.api("/api/billing")).body;
    check("Plus 답변 받으면 환불 불가", b.refundable === false);
    check("환불 불가 상태에서 환불 요청 거절", (await manage("refund")).status === 400);
  } finally {
    await admin.from("payments").delete().eq("user_id", U.id);
    await admin.from("usage").delete().eq("user_id", U.id);
    await admin.auth.admin.deleteUser(U.id);
  }
}
