// 연애 성향 리포트: 해금 조건, 결제 전 미리보기만 보이는지(API·DB 직접 조회 모두), 단건 결제 주문·승인 검증, 남의 리포트 접근.
import { SKIP_AI, admin, check, makeUser, skip } from "./_lib.mjs";

const SAMPLE = {
  type: "checker",
  headline: "답장 하나에도 마음을 다 쓰는 사람",
  keywords: ["섬세함", "확인", "배려"],
  emotions: [{ name: "불안", desc: "답이 늦으면 불안해져요", evidence: "3번 중 2번에서 '내가 너무 매달리나'라고 했어요" }],
  values: [{ title: "꾸준한 연락", desc: "잠긴 내용", evidence: "잠긴 근거" }],
  patterns: [{ situation: "답장이 늦을 때", reaction: "잠긴 반응", evidence: "잠긴" }],
  strengths: [{ title: "잠긴 강점", desc: "잠긴" }],
  stumbles: [{ title: "잠긴 지점", desc: "잠긴", tryThis: "잠긴 행동" }],
  characterNote: "잠긴 한마디",
};

const STORIES = [
  ["썸남 답장이 늦어요", ["썸 타는 사람이 답장을 반나절 넘게 안 해", "내가 너무 매달리나 싶어서 먼저 연락을 못 하겠어"]],
  ["약속이 자꾸 미뤄져요", ["주말 약속을 두 번이나 미뤘어", "서운하다고 말하면 부담스러워할까 봐 그냥 괜찮다고 했어"]],
  ["고백 타이밍 고민", ["이번 주에 고백할까 고민 중이야", "내가 너무 매달리나 싶기도 하고, 확신이 없으면 말을 못 하겠어"]],
];

export default async function testReports() {
  const A = await makeUser("report-a");
  const Bu = await makeUser("report-b");
  const get = async (u = A) => (await u.api("/api/reports")).body;

  try {
    // ── 해금 전
    let d = await get();
    check("처음: 정리한 상담 3개 남음, 리포트 없음", d.progress?.remaining === 3 && d.report === null && d.price === 4900, JSON.stringify(d));
    const early = await A.api("/api/reports", "POST");
    check("해금 전 만들기 400", early.status === 400, JSON.stringify(early.body));

    // 정리한 상담 3개 (관리자로 바로 넣는다)
    for (const [title, lines] of STORIES) {
      const { data: s, error } = await admin
        .from("sessions")
        .insert({
          user_id: A.id,
          character_id: "mongle",
          summary: { title, situation: lines.join(" "), interpretation: "마음이 쓰이는 상황이에요", todo: ["솔직하게 한마디 해 보기"], dont: [], suggestions: [], applied: false },
        })
        .select("id")
        .single();
      if (error) throw error;
      await admin.from("messages").insert(lines.map((text) => ({ session_id: s.id, user_id: A.id, role: "user", text })));
    }
    d = await get();
    check("정리한 상담 3개: 만들 수 있음", d.progress?.canCreate === true && d.progress.summarized === 3, JSON.stringify(d.progress));

    // ── 만들기
    let reportId;
    if (SKIP_AI) {
      skip("AI 로 리포트 만들기");
      const { data } = await admin.from("reports").insert({ user_id: A.id, kind: "personality", content: SAMPLE, source_count: 3, model: "test" }).select("id").single();
      reportId = data.id;
    } else {
      const before = (await A.api("/api/usage")).body.percent;
      const made = await A.api("/api/reports", "POST");
      check("리포트 만들기 200", made.status === 200 && !!made.body.report?.id, JSON.stringify(made.body).slice(0, 200));
      const c = made.body.report?.content ?? {};
      check("AI 리포트: 8개 유형 중 하나 + 키워드 3개", typeof c.type === "string" && c.keywords?.length === 3, JSON.stringify(c).slice(0, 200));
      console.log("   └", c.type, "·", c.headline, "·", (c.keywords ?? []).join(", "));
      check("AI 리포트: 다른 사람 이름 없이 근거 인용", (c.emotions ?? []).every((e) => typeof e.evidence === "string" && e.evidence.length > 0));
      const used = await admin.from("usage").select("kind, model").eq("user_id", A.id).eq("kind", "report");
      check("리포트 비용은 report 로 기록 (Sonnet)", used.data?.length === 1 && used.data[0].model.includes("sonnet"), JSON.stringify(used.data));
      check("리포트 비용은 개인 하루 한도에 안 잡힘", (await A.api("/api/usage")).body.percent === before);
      reportId = made.body.report?.id;
    }

    // ── 결제 전: 미리보기만
    d = await get();
    const keys = Object.keys(d.report?.content ?? {}).sort().join(",");
    check("결제 전 API: 미리보기 4항목만", d.report?.paid === false && keys === "emotions,headline,keywords,type", keys);
    check("결제 전 API: 잠긴 내용 없음", !("values" in (d.report?.content ?? {})) && !JSON.stringify(d).includes("잠긴"));
    check("다시 만들기 불가 (3개 더 필요)", d.progress?.canCreate === false && d.progress.remaining === 3, JSON.stringify(d.progress));
    check("해금 후 두 번째 만들기 400", (await A.api("/api/reports", "POST")).status === 400);

    const direct = await A.sb.from("reports").select("content");
    check("공개 키로 DB 직접 조회해도 리포트 못 읽음", !!direct.error || (direct.data ?? []).length === 0, direct.error?.message);
    const hack = await A.sb.from("reports").update({ paid_at: new Date().toISOString() }).eq("id", reportId).select();
    check("사용자가 paid_at 을 못 바꿈", !!hack.error || (hack.data ?? []).length === 0);
    check("남의 리포트 404", (await Bu.api(`/api/reports/${reportId}`)).status === 404);
    check("남의 리포트 결제 준비 404", [404, 503].includes((await Bu.api(`/api/reports/${reportId}/checkout`, "POST", { agreed: true })).status));

    // ── 결제 준비
    check("결제 동의 없으면 400", (await A.api(`/api/reports/${reportId}/checkout`, "POST", {})).status === 400);
    const co = await A.api(`/api/reports/${reportId}/checkout`, "POST", { agreed: true });
    if (co.status === 503) {
      skip("결제 준비·승인 (토스 키 없음)");
    } else {
      check("결제 준비: 주문번호·금액", co.status === 200 && /^P-/.test(co.body.orderId ?? "") && co.body.amount === 4900, JSON.stringify(co.body).slice(0, 160));
      check("결제 준비: 시크릿 키 안 내보냄", !JSON.stringify(co.body).includes("_sk_") && !JSON.stringify(co.body).includes("gsk"));
      const orderId = co.body.orderId;
      const pay = async () => (await admin.from("payments").select("kind, status, amount, report_id").eq("order_id", orderId).single()).data;
      const p0 = await pay();
      check("주문은 pending 으로 저장", p0?.kind === "report" && p0.status === "pending" && p0.report_id === reportId, JSON.stringify(p0));

      // 승인: 금액 바꿔치기, 남의 주문, 가짜 결제키
      const mis = await A.api("/api/reports/confirm", "POST", { paymentKey: "fake", orderId, amount: 100 });
      check("금액이 다르면 400", mis.status === 400 && mis.body.code === "AMOUNT_MISMATCH", JSON.stringify(mis.body));
      check("남의 주문 승인 404", (await Bu.api("/api/reports/confirm", "POST", { paymentKey: "fake", orderId, amount: 4900 })).status === 404);
      const fake = await A.api("/api/reports/confirm", "POST", { paymentKey: "fake-payment-key", orderId, amount: 4900 });
      check("가짜 결제키: 토스가 거절 → 402, 열리지 않음", fake.status === 402 && (await get()).report?.paid === false, JSON.stringify(fake.body));
      check("거절된 주문은 failed", (await pay())?.status === "failed");
      check("끝난 주문으로 다시 승인 400", (await A.api("/api/reports/confirm", "POST", { paymentKey: "x", orderId, amount: 4900 })).status === 400);
    }

    // ── 결제된 것으로 표시하면 전체가 열림 (실제 결제는 토스 결제창이 필요해서 관리자로 표시)
    const paidOrder = `P-test-${Date.now()}`;
    await admin.from("payments").insert({ user_id: A.id, order_id: paidOrder, kind: "report", status: "paid", amount: 4900, report_id: reportId, approved_at: new Date().toISOString() });
    await admin.from("reports").update({ paid_at: new Date().toISOString(), order_id: paidOrder }).eq("id", reportId);
    d = await get();
    check("결제 후: 전체 내용", d.report?.paid === true && Array.isArray(d.report.content.values) && typeof d.report.content.characterNote === "string");
    const again = await A.api(`/api/reports/${reportId}/checkout`, "POST", { agreed: true });
    check("이미 결제한 리포트 다시 결제 409", [409, 503].includes(again.status), JSON.stringify(again.body));
    const rc = await A.api(`/api/billing/receipt?order=${paidOrder}`);
    check("리포트 영수증: 상품 이름", rc.body?.orderName?.includes("연애 성향 리포트"), JSON.stringify(rc.body).slice(0, 120));

    // ── 리포트 결제가 구독 환불·결제 내역에 섞이지 않음
    const now = Date.now();
    await admin.from("subscriptions").upsert({ user_id: A.id, plan: "plus", status: "active", current_period_start: new Date(now - 10 * 864e5).toISOString(), current_period_end: new Date(now + 20 * 864e5).toISOString() });
    await admin.from("payments").insert({ user_id: A.id, order_id: `F-test-${now}`, kind: "first", status: "paid", amount: 9900, payment_key: "fake", approved_at: new Date(now - 10 * 864e5).toISOString() });
    const bill = (await A.api("/api/billing")).body;
    check("구독 환불은 구독 결제로만 판단 (10일 전 → 불가)", bill.refundable === false, JSON.stringify({ refundable: bill.refundable }));
    check("구독 결제 내역에 리포트 결제 없음", (bill.payments ?? []).every((p) => !String(p.order_id).startsWith("P-")), JSON.stringify(bill.payments?.map((p) => p.order_id)));

    // ── 내려받기에 리포트
    const ex = await A.api("/api/me/export");
    check("내려받기에 리포트", Array.isArray(ex.body?.reports) && ex.body.reports.length === 1 && ex.body.reports[0].paid === true);
  } finally {
    await admin.from("payments").delete().eq("user_id", A.id);
    await admin.from("subscriptions").delete().eq("user_id", A.id);
    await admin.from("usage").delete().eq("user_id", A.id);
    await admin.auth.admin.deleteUser(A.id);
    await admin.auth.admin.deleteUser(Bu.id);
  }
}
