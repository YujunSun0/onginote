// 관계 흐름 리포트: 사람별 해금, 결제 전 미리보기만, 3,900원 주문, 남의 사람·리포트 접근, 사람을 지우면 리포트도 지워지는지.
import { SKIP_AI, admin, check, makeUser, skip } from "./_lib.mjs";

const SAMPLE = {
  headline: "서운함을 지나 다시 천천히 가까워지는 중",
  keywords: ["기다림", "솔직함", "회복"],
  weather: [
    { date: "2026-11-01", weather: "sunny", note: "설레는 시작" },
    { date: "2026-11-05", weather: "rainy", note: "약속이 미뤄져 서운" },
    { date: "2026-11-09", weather: "partly", note: "조금 안심" },
  ],
  chapters: [{ title: "잠긴 시기", period: "11월 초", desc: "잠긴", evidence: "잠긴 근거" }],
  recurring: [{ title: "잠긴 고민", desc: "잠긴", evidence: "잠긴" }],
  tried: [],
  me: { desc: "잠긴", evidence: "잠긴", differs: null },
  nextSteps: [{ title: "잠긴 다음", desc: "잠긴" }],
  characterNote: "잠긴 한마디",
};

const STORIES = [
  ["답장이 늦어요", ["민지가 답장을 반나절 넘게 안 해", "내가 너무 매달리나 싶어서 먼저 연락을 못 하겠어"], [true, false]],
  ["약속이 미뤄졌어요", ["민지가 주말 약속을 두 번이나 미뤘어", "서운하다고 말하면 부담스러워할까 봐 괜찮다고 했어"], [false]],
  ["다시 가까워진 것 같아요", ["어제 민지랑 오래 통화했어", "서운했던 거 솔직하게 말했더니 미안하다고 해서 마음이 좀 풀렸어"], [true]],
];

export default async function testRelationship() {
  const A = await makeUser("rel-a");
  const Bu = await makeUser("rel-b");

  try {
    const p = (await A.api("/api/persons", "POST", { name: "검증민지", relation: "썸" })).body;
    const other = (await A.api("/api/persons", "POST", { name: "다른사람", relation: "친구" })).body;
    const url = `/api/persons/${p.id}/report`;
    const get = async (u = A) => (await u.api(url)).body;

    // ── 해금 전
    let d = await get();
    check("처음: 3개 남음, 리포트 없음, 3,900원", d.progress?.remaining === 3 && d.report === null && d.price === 3900, JSON.stringify(d).slice(0, 200));
    check("해금 전 만들기 400", (await A.api(url, "POST")).status === 400);
    check("남의 사람 리포트 404", (await Bu.api(url)).status === 404);
    check("남의 사람 리포트 만들기 404", (await Bu.api(url, "POST")).status === 404);

    // 다른 사람과의 정리 상담은 세지 않는다
    const insertSession = async (personId, [title, lines, done]) => {
      const { data: s, error } = await admin
        .from("sessions")
        .insert({
          user_id: A.id,
          person_id: personId,
          character_id: "olly",
          summary: { title, situation: lines.join(" "), interpretation: "마음이 쓰이는 상황이에요", todo: done.map((_, i) => `할 일 ${i + 1}`), todoDone: done, dont: [], suggestions: [], applied: false },
        })
        .select("id")
        .single();
      if (error) throw error;
      await admin.from("messages").insert(lines.map((text) => ({ session_id: s.id, user_id: A.id, role: "user", text })));
    };
    await insertSession(other.id, STORIES[0]);
    d = await get();
    check("다른 사람과의 상담은 안 셈", d.progress?.summarized === 0, JSON.stringify(d.progress));
    for (const st of STORIES) await insertSession(p.id, st);
    d = await get();
    check("그 사람과 정리한 상담 3개: 만들 수 있음", d.progress?.canCreate === true && d.progress.summarized === 3, JSON.stringify(d.progress));

    // ── 만들기
    let reportId;
    if (SKIP_AI) {
      skip("AI 로 관계 흐름 리포트 만들기");
      const { data, error } = await admin
        .from("reports")
        .insert({ user_id: A.id, kind: "relationship", person_id: p.id, content: SAMPLE, source_count: 3, model: "test" })
        .select("id")
        .single();
      if (error) throw error;
      reportId = data.id;
    } else {
      const made = await A.api(url, "POST");
      check("리포트 만들기 200", made.status === 200 && !!made.body.report?.id, JSON.stringify(made.body).slice(0, 200));
      const c = made.body.report?.content ?? {};
      if (process.env.SHOW_REPORT) console.log(JSON.stringify(c, null, 1));
      console.log("   └", c.headline, "·", (c.keywords ?? []).join(", "), "·", (c.weather ?? []).map((w) => w.weather).join(" "));
      check("AI 리포트: 마음 날씨가 상담마다 하나, 날짜 붙음", c.weather?.length === 3 && c.weather.every((w) => /^\d{4}-\d{2}-\d{2}$/.test(w.date)), JSON.stringify(c.weather));
      check("AI 리포트: 키워드 3개", c.keywords?.length === 3);
      check("AI 리포트: 미리보기에 상대 이름 없음", !JSON.stringify(c).includes("민지"), c.headline);
      reportId = made.body.report?.id;
    }

    // ── 결제 전: 미리보기만
    d = await get();
    const keys = Object.keys(d.report?.content ?? {}).sort().join(",");
    check("결제 전 API: 미리보기 3항목만", d.report?.paid === false && keys === "headline,keywords,weather", keys);
    check("결제 전 API: 잠긴 내용 없음", !JSON.stringify(d).includes("잠긴"));
    check("다시 만들기 불가 (3개 더 필요)", d.progress?.canCreate === false && d.progress.remaining === 3, JSON.stringify(d.progress));
    check("연애 성향 리포트 주소로는 안 보임", (await A.api(`/api/reports/${reportId}`)).status === 404);
    check("연애 성향 리포트 화면에 안 섞임", (await A.api("/api/reports")).body.report === null);
    const direct = await A.sb.from("reports").select("content");
    check("공개 키로 DB 직접 조회해도 못 읽음", !!direct.error || (direct.data ?? []).length === 0);

    // ── 결제 준비: 3,900원
    const co = await A.api(`/api/reports/${reportId}/checkout`, "POST", { agreed: true });
    check("남의 리포트 결제 준비 404", [404, 503].includes((await Bu.api(`/api/reports/${reportId}/checkout`, "POST", { agreed: true })).status));
    if (co.status === 503) {
      skip("결제 준비 (토스 키 없음)");
    } else {
      check("결제 준비: 3,900원, 관계 흐름 상품 이름", co.status === 200 && co.body.amount === 3900 && co.body.orderName?.includes("관계 흐름"), JSON.stringify(co.body).slice(0, 160));
      const { data: p0 } = await admin.from("payments").select("amount, order_name, report_id").eq("order_id", co.body.orderId).single();
      check("주문: 금액·상품 이름 저장", p0?.amount === 3900 && p0.order_name?.includes("관계 흐름") && p0.report_id === reportId, JSON.stringify(p0));
      const mis = await A.api("/api/reports/confirm", "POST", { paymentKey: "fake", orderId: co.body.orderId, amount: 4900 });
      check("연애 성향 리포트 금액으로 승인 → 400", mis.status === 400 && mis.body.code === "AMOUNT_MISMATCH");
    }

    // ── 결제된 것으로 표시하면 전체가 열림
    const paidOrder = `P-reltest-${Date.now()}`;
    await admin.from("payments").insert({
      user_id: A.id,
      order_id: paidOrder,
      kind: "report",
      status: "paid",
      amount: 3900,
      order_name: "온기노트 관계 흐름 리포트",
      report_id: reportId,
      approved_at: new Date().toISOString(),
    });
    await admin.from("reports").update({ paid_at: new Date().toISOString(), order_id: paidOrder }).eq("id", reportId);
    d = await get();
    check("결제 후: 전체 내용", d.report?.paid === true && Array.isArray(d.report.content.chapters) && typeof d.report.content.characterNote === "string");
    const rc = (await A.api(`/api/billing/receipt?order=${paidOrder}`)).body;
    check("영수증: 상품 이름과 리포트 주소", rc?.orderName?.includes("관계 흐름") && rc.reportLink === `/people/${p.id}/report`, JSON.stringify(rc).slice(0, 160));
    const ex = (await A.api("/api/me/export")).body;
    check("내려받기에 관계 흐름 리포트", (ex?.reports ?? []).some((r) => r.kind === "relationship" && r.personId === p.id && r.paid === true));

    // ── 사람을 지우면 리포트도 지워지고, 결제 기록은 남는다
    await A.api(`/api/persons/${p.id}`, "DELETE");
    const { data: gone } = await admin.from("reports").select("id").eq("id", reportId);
    check("사람 삭제 → 리포트 삭제", (gone ?? []).length === 0);
    const { data: kept } = await admin.from("payments").select("report_id, order_name, status").eq("order_id", paidOrder).single();
    check("결제 기록은 남고 리포트 연결만 끊김", kept?.status === "paid" && kept.report_id === null && kept.order_name?.includes("관계 흐름"), JSON.stringify(kept));
    const rc2 = (await A.api(`/api/billing/receipt?order=${paidOrder}`)).body;
    check("지운 뒤 영수증: 상품 이름 그대로, 리포트 주소 없음", rc2?.orderName?.includes("관계 흐름") && rc2.reportLink === null, JSON.stringify(rc2).slice(0, 160));
    check("지운 사람 리포트 404", (await A.api(url)).status === 404);
  } finally {
    await admin.from("payments").delete().eq("user_id", A.id);
    await admin.from("usage").delete().eq("user_id", A.id);
  }
}
