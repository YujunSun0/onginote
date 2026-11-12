// 계정 2개로 로그인해서: 각자 기능이 되는지, 서로의 데이터가 안 보이는지, 한도가 막는지 확인한다.
import { SKIP_AI, admin, check, makeUser, skip } from "./_lib.mjs";

export default async function testPlans() {
  const U = await makeUser("plans");
  const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const addUsage = (row) => admin.from("usage").insert({ user_id: U.id, day, kind: "chat", model: "test", input: 0, output: 0, searches: 0, cost: 0, ...row });
  const usage = async () => (await U.api("/api/usage")).body;
  const chat = async (sid, text) => {
    const r = await U.api("/api/chat", "POST", { sessionId: sid, text });
    const ev = String(r.raw).split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return {}; } });
    return { status: r.status, body: r.body, ev, reply: ev.filter((e) => e.type === "text").map((e) => e.delta).join("") };
  };
  const lastChatModel = async () => (await admin.from("usage").select("model").eq("user_id", U.id).eq("kind", "chat").neq("model", "test").order("id", { ascending: false }).limit(1)).data?.[0]?.model;
  const setSub = (row) => admin.from("subscriptions").upsert({ user_id: U.id, plan: "plus", status: "active", ...row });

  try {
    // ── 무료
    let u = await usage();
    check("무료: plan=free", u.plan === "free", JSON.stringify(u));
    check("무료: 상담 길이 40", u.sessionMessages === 40);
    check("무료: 검색 3회", u.searchesLeft === 3);
    check("무료: 금액·모델 안 내보냄", !("limits" in u) && !JSON.stringify(u).includes("claude"));
    const me = (await U.api("/api/me")).body;
    check("마이: plan 정보", me.plan?.id === "free" && me.plan.until === null);

    // 사용자가 직접 Plus 로 바꾸지 못함 (RLS)
    const ins = await U.sb.from("subscriptions").insert({ user_id: U.id, plan: "plus", status: "active", current_period_start: new Date().toISOString(), current_period_end: new Date(Date.now() + 864e5 * 30).toISOString() });
    check("사용자가 구독 행을 못 씀", !!ins.error, ins.error?.message);
    check("여전히 무료", (await usage()).plan === "free");
    const rpc = await U.sb.rpc("usage_snapshot", { p_user: U.id, p_day: day });
    check("사용자가 usage_snapshot 못 부름", !!rpc.error);

    // 검색 다 쓴 날: 검색 안 함
    await addUsage({ searches: 3 });
    check("검색 3회 쓰면 남은 검색 0", (await usage()).searchesLeft === 0);
    const s1 = (await U.api("/api/sessions", "POST", { characterId: "mongle", personId: null })).body;
    if (SKIP_AI) skip("검색 소진 시 검색 없이 답변, 무료 모델");
    else {
      const r1 = await chat(s1.id, "혹시 ISFJ 여자 특징 좀 검색해줄 수 있을까?");
      check("검색 소진: 검색 이벤트 없음", !r1.ev.some((e) => e.type === "searching" || e.type === "sources"), r1.reply.slice(0, 80));
      check("검색 소진: 답변은 옴", r1.reply.length > 0);
      console.log("   └", r1.reply.replace(/\n/g, " ").slice(0, 140));
      check("무료: Haiku 로 답함", (await lastChatModel())?.includes("haiku"), await lastChatModel());
    }

    // 상담 길이 40
    await admin.from("sessions").update({ user_message_count: 40 }).eq("id", s1.id);
    const r2 = await chat(s1.id, "하나 더");
    check("무료: 41번째 메시지 막힘", r2.status === 400 && r2.body?.limit === "session", JSON.stringify(r2.body));

    // ── Plus
    const now = Date.now();
    await setSub({ current_period_start: new Date(now - 10 * 864e5).toISOString(), current_period_end: new Date(now + 20 * 864e5).toISOString() });
    u = await usage();
    check("Plus: plan=plus", u.plan === "plus" && !!u.plusUntil, JSON.stringify(u));
    check("Plus: 상담 길이 80", u.sessionMessages === 80);
    check("Plus: 검색 20-3=17", u.searchesLeft === 17);
    if (SKIP_AI) skip("Plus 이어서 답변, Plus 모델");
    else {
      check("Plus: 같은 상담 이어서 가능", (await chat(s1.id, "고마워!")).status === 200);
      check("Plus: Plus 모델(Haiku)로 답함", (await lastChatModel())?.includes("haiku"), await lastChatModel());
    }
    await admin.from("sessions").update({ user_message_count: 80 }).eq("id", s1.id);
    check("Plus: 81번째 메시지 막힘", (await chat(s1.id, "하나 더")).body?.limit === "session");

    // 하루 한도: 0.1 쓴 상태로 무료면 막히고 Plus 면 통과
    await addUsage({ cost: 0.12 });
    u = await usage();
    check("Plus: $0.12 써도 안 막힘", !u.exceeded && u.percent < 50, JSON.stringify(u));
    await admin.from("subscriptions").delete().eq("user_id", U.id);
    check("무료: $0.12 쓰면 막힘", (await usage()).exceeded);
    const s2 = (await U.api("/api/sessions", "POST", { characterId: "mongle", personId: null })).body;
    const r3 = await chat(s2.id, "안녕");
    check("무료 한도 초과: 429 + Plus 안내", r3.status === 429 && /Plus/.test(r3.body?.error ?? ""), r3.body?.error);

    // 구독 기간 한도 $8: 기간 안의 지난 사용(어제)로 채운다
    await setSub({ current_period_start: new Date(now - 10 * 864e5).toISOString(), current_period_end: new Date(now + 20 * 864e5).toISOString() });
    const yday = new Date(now + 9 * 3600e3 - 864e5).toISOString().slice(0, 10);
    await admin.from("usage").insert({ user_id: U.id, day: yday, at: new Date(now - 864e5).toISOString(), kind: "chat", model: "test", cost: 8 });
    u = await usage();
    check("Plus 기간 한도: periodCapped", u.plan === "plus" && u.periodCapped, JSON.stringify(u));
    check("Plus 기간 한도: 무료 수준 하루 한도로 막힘($0.12 > $0.1)", u.exceeded);
    check("Plus 기간 한도: 상담 길이는 80 유지", u.sessionMessages === 80);
    // 기간 시작 전 사용은 세지 않음
    await setSub({ current_period_start: new Date(now - 3600e3).toISOString(), current_period_end: new Date(now + 30 * 864e5).toISOString() });
    check("새 기간이면 기간 한도 초기화", !(await usage()).periodCapped);

    // 만료
    await setSub({ current_period_start: new Date(now - 31 * 864e5).toISOString(), current_period_end: new Date(now - 864e5).toISOString() });
    u = await usage();
    check("기간 지나면 무료", u.plan === "free" && u.plusUntil === null && u.sessionMessages === 40, JSON.stringify(u));
  } finally {
    await admin.from("usage").delete().eq("user_id", U.id);
    await admin.auth.admin.deleteUser(U.id);
  }
}
