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
    check("무료: 상담 길이 15", u.sessionMessages === 15);
    check("무료: 검색 답변 1번", u.searchesLeft === 1);
    check("무료: 상담 하루 1·한 달 10", u.sessionsLeftToday === 1 && u.sessionsLeftMonth === 10 && u.monthlySessions === 10, JSON.stringify(u));
    check("무료: 금액·모델 안 내보냄", !("limits" in u) && !JSON.stringify(u).includes("claude"));
    const me = (await U.api("/api/me")).body;
    check("마이: plan 정보", me.plan?.id === "free" && me.plan.until === null);

    // 사용자가 직접 Plus 로 바꾸지 못함 (RLS)
    const ins = await U.sb.from("subscriptions").insert({ user_id: U.id, plan: "plus", status: "active", current_period_start: new Date().toISOString(), current_period_end: new Date(Date.now() + 864e5 * 30).toISOString() });
    check("사용자가 구독 행을 못 씀", !!ins.error, ins.error?.message);
    check("여전히 무료", (await usage()).plan === "free");
    const rpc = await U.sb.rpc("usage_snapshot", { p_user: U.id, p_day: day });
    check("사용자가 usage_snapshot 못 부름", !!rpc.error);

    // 검색 다 쓴 날: 검색 안 함. 답변 하나에서 여러 번 검색해도 1번으로 센다
    await addUsage({ searches: 2 });
    check("검색한 답변 1개면 남은 검색 0", (await usage()).searchesLeft === 0);
    const s1 = (await U.api("/api/sessions", "POST", { characterId: "mongle", personId: null })).body;
    if (SKIP_AI) skip("검색 소진 시 검색 없이 답변, 무료 모델");
    else {
      const r1 = await chat(s1.id, "혹시 ISFJ 여자 특징 좀 검색해줄 수 있을까?");
      check("검색 소진: 검색 이벤트 없음", !r1.ev.some((e) => e.type === "searching" || e.type === "sources"), r1.reply.slice(0, 80));
      check("검색 소진: 답변은 옴", r1.reply.length > 0);
      console.log("   └", r1.reply.replace(/\n/g, " ").slice(0, 140));
      check("무료: Haiku 로 답함", (await lastChatModel())?.includes("haiku"), await lastChatModel());
    }

    // 상담 길이 15
    await admin.from("sessions").update({ user_message_count: 15 }).eq("id", s1.id);
    const r2 = await chat(s1.id, "하나 더");
    check("무료: 16번째 메시지 막힘", r2.status === 400 && r2.body?.limit === "session", JSON.stringify(r2.body));

    // ── Plus
    const now = Date.now();
    await setSub({ current_period_start: new Date(now - 10 * 864e5).toISOString(), current_period_end: new Date(now + 20 * 864e5).toISOString() });
    u = await usage();
    check("Plus: plan=plus", u.plan === "plus" && !!u.plusUntil, JSON.stringify(u));
    check("Plus: 상담 길이 80", u.sessionMessages === 80);
    check("Plus: 검색 답변 5-1=4", u.searchesLeft === 4);
    check("Plus: 상담 수 한 달 제한 없음", u.sessionsLeftMonth === null && u.monthlySessions === null);
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
    await admin.from("sessions").update({ user_message_count: 1 }).eq("id", s1.id);
    const r3 = await chat(s1.id, "안녕");
    check("무료 한도 초과: 429 + 온기 패스 안내", r3.status === 429 && /온기 패스/.test(r3.body?.error ?? ""), r3.body?.error);

    // 구독 기간 한도 $4: 기간 안의 지난 사용(어제)로 채운다
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
    check("기간 지나면 무료", u.plan === "free" && u.plusUntil === null && u.sessionMessages === 15, JSON.stringify(u));

    // ── 상담 수 (무료): 사용량 기록에서 상담이 처음 쓰인 날로 센다
    await admin.from("subscriptions").delete().eq("user_id", U.id);
    await admin.from("usage").delete().eq("user_id", U.id);
    u = await usage();
    check("상담 수: 처음엔 오늘 1개 남음", u.sessionsLeftToday === 1, JSON.stringify(u));
    await addUsage({ session_id: crypto.randomUUID(), kind: "router" });
    u = await usage();
    check("상담 수: 오늘 1개 쓰면 0", u.sessionsLeftToday === 0 && u.sessionsLeftMonth === 9, JSON.stringify(u));
    const blockedNew = await U.api("/api/sessions", "POST", { characterId: "mongle", personId: null });
    check("상담 수: 오늘 다 쓰면 새 상담 429", blockedNew.status === 429 && blockedNew.body?.limit === "sessions_day" && blockedNew.body?.upgrade === true, JSON.stringify(blockedNew.body));
    // 한도 전에 미리 만들어 둔 빈 상담도 첫 메시지에서 막힌다 (AI 호출 전에 거절)
    const { data: early } = await admin.from("sessions").insert({ user_id: U.id, character_id: "mongle" }).select("id").single();
    const r4 = await chat(early.id, "안녕");
    check("상담 수: 미리 만든 빈 상담도 첫 메시지 막힘", r4.status === 429 && r4.body?.limit === "sessions_day", JSON.stringify(r4.body));
    // 같은 상담에 오늘 사용이 더 있어도 1개로 센다
    const sid = crypto.randomUUID();
    await addUsage({ session_id: sid, day: yday, at: new Date(now - 864e5).toISOString() });
    await addUsage({ session_id: sid });
    check("상담 수: 어제 시작한 상담을 오늘 이어가도 오늘 수는 그대로", (await usage()).sessionsLeftToday === 0);
    // 패스는 상담 수 제한 없음 (하루 안전 상한만)
    await setSub({ current_period_start: new Date(now - 864e5).toISOString(), current_period_end: new Date(now + 29 * 864e5).toISOString() });
    check("상담 수: 패스는 새 상담 가능", (await U.api("/api/sessions", "POST", { characterId: "mongle", personId: null })).status === 200);
    await admin.from("subscriptions").delete().eq("user_id", U.id);
    // 무료 한 달 10개 (오늘이 1일이면 어제 상담은 지난달이지만, 오늘 것만으로 10개가 찬다)
    for (let i = 0; i < 9; i++) await addUsage({ session_id: crypto.randomUUID() });
    u = await usage();
    check("상담 수: 한 달 10개 다 쓰면 0", u.sessionsLeftMonth === 0, JSON.stringify(u));
    const blockedMonth = await U.api("/api/sessions", "POST", { characterId: "mongle", personId: null });
    check("상담 수: 한 달 다 쓰면 sessions_month", blockedMonth.status === 429 && blockedMonth.body?.limit === "sessions_month", JSON.stringify(blockedMonth.body));
  } finally {
    await admin.from("usage").delete().eq("user_id", U.id);
    await admin.auth.admin.deleteUser(U.id);
  }
}
