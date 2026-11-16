// 날짜별 사용량 (0009 usage_daily): 트리거가 모으는 값, 사용자가 표에 닿지 못하는지, 화면 API 가 % 만 내보내는지
import { B, admin, check, makeUser } from "./_lib.mjs";

const koreaDay = (ms = Date.now()) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);

export default async function testUsage() {
  const A = await makeUser("usage-a");
  const Bu = await makeUser("usage-b");
  const today = koreaDay();
  const month = today.slice(0, 7);
  const s1 = crypto.randomUUID();
  const s2 = crypto.randomUUID();

  // 상담 2개(첫 router 에서 한 번씩 셈), 검색한 답변 1개, 리포트 1번
  const rows = [
    { kind: "router", session_id: s1, cost: 0.001 },
    { kind: "chat", session_id: s1, cost: 0.019, searches: 2 },
    { kind: "router", session_id: s1, cost: 0.001 },
    { kind: "chat", session_id: s1, cost: 0.009 },
    { kind: "router", session_id: s2, cost: 0.001 },
    { kind: "chat", session_id: s2, cost: 0.009 },
    { kind: "summary", session_id: s1, cost: 0.01 },
    { kind: "report", cost: 0.3 },
  ];
  for (const r of rows) {
    const { error } = await admin.from("usage").insert({ user_id: A.id, day: today, model: "test", searches: 0, ...r });
    if (error) throw error;
  }
  const { data: d } = await admin.from("usage_daily").select("*").eq("user_id", A.id).eq("day", today).maybeSingle();
  check("트리거가 하루 한 줄로 모음", Boolean(d), JSON.stringify(d).slice(0, 120));
  check("금액 합계 (리포트 제외)", d && Math.abs(Number(d.cost) - 0.05) < 1e-9, d?.cost);
  check("리포트 금액은 따로", d && Math.abs(Number(d.report_cost) - 0.3) < 1e-9, d?.report_cost);
  check("답변 수·검색한 답변 수", d?.answers === 3 && d?.searched_answers === 1, `${d?.answers}/${d?.searched_answers}`);
  check("시작한 상담 수 (상담마다 한 번)", d?.sessions_started === 2, d?.sessions_started);
  check("호출 수", d?.calls === rows.length, d?.calls);
  check("요금제 기록 (무료)", d?.plan === "free", d?.plan);

  // usage_snapshot 의 오늘 상담 수와 같은 기준인지
  const { data: snap } = await admin.rpc("usage_snapshot", { p_user: A.id, p_day: today });
  check("상담 수가 하루 한도 계산과 같음", snap?.sessions_day === d?.sessions_started, `${snap?.sessions_day} vs ${d?.sessions_started}`);

  // 사용자는 이 표를 못 읽고 못 쓴다 (금액이 들어 있다)
  const { data: rA, error: rErr } = await A.sb.from("usage_daily").select("*");
  check("사용자가 usage_daily 직접 읽기 → 안 보임", Boolean(rErr) || (rA ?? []).length === 0);
  const { error: wErr } = await A.sb.from("usage_daily").insert({ user_id: A.id, day: "2026-01-01" });
  check("사용자가 usage_daily 직접 쓰기 → 거부", Boolean(wErr));
  const { error: uErr, count: uCount } = await A.sb.from("usage_daily").update({ cost: 0 }, { count: "exact" }).eq("user_id", A.id);
  check("사용자가 usage_daily 고치기 → 0건", Boolean(uErr) || !uCount);

  // 화면 API
  const h = await A.api(`/api/usage/history?month=${month}`);
  const t = h.body?.days?.find((x) => x.day === today);
  check("history 조회", h.status === 200 && h.body.month === month, h.status);
  check("오늘 막대 % (무료 기본 한도 기준)", t?.percent === 50 && t?.answers === 3 && t?.sessionsStarted === 2, JSON.stringify(t));
  check("history 에 금액·모델 없음", !/cost|usd|model|0\.05|0\.3/i.test(JSON.stringify(h.body)));
  check("요약", h.body?.summary?.activeDays === 1 && h.body?.summary?.peak?.day === today, JSON.stringify(h.body?.summary));
  check("미래 달 요청 → 이번 달", (await A.api("/api/usage/history?month=2999-01")).body.month === month);
  check("이상한 달 → 이번 달", (await A.api("/api/usage/history?month=x")).body.month === month);
  check("기록 없는 지난달 요청 → 이번 달 (처음 쓴 달)", (await A.api("/api/usage/history?month=2020-01")).body.month === month);

  // 그날 한도를 남기면 그걸로 % 를 계산한다
  await admin.from("usage_daily").update({ limit_usd: 0.2 }).eq("user_id", A.id).eq("day", today);
  const h2 = await A.api(`/api/usage/history?month=${month}`);
  check("그날 남긴 한도로 % 계산", h2.body?.days?.find((x) => x.day === today)?.percent === 25);

  // 여러 줄을 한 번에 넣어도 상담은 한 번만 센다
  const s3 = crypto.randomUUID();
  const { error: batchErr } = await admin.from("usage").insert(
    ["router", "chat", "chat"].map((kind) => ({ user_id: A.id, day: today, kind, model: "test", session_id: s3, searches: 0, cost: 0 })),
  );
  const { data: d3 } = await admin.from("usage_daily").select("sessions_started").eq("user_id", A.id).eq("day", today).maybeSingle();
  check("한 번에 넣은 여러 줄 → 상담 1개만 더함", !batchErr && d3?.sessions_started === 3, `${batchErr?.message ?? ""} ${d3?.sessions_started}`);

  // 남의 사용량이 섞이지 않는다
  const hb = await Bu.api(`/api/usage/history?month=${month}`);
  check("B 에게 A 사용량 안 보임", hb.status === 200 && hb.body.summary.activeDays === 0);
  check("비로그인 history 401", (await fetch(B + "/api/usage/history")).status === 401);
}
