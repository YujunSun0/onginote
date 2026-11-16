import { describe, expect, it } from "vitest";
import { PLANS } from "@/lib/plans";
import { buildHistory, dayPercent, resolveMonth, type DailyRow } from "@/lib/usage-history";

const row = (day: string, over: Partial<DailyRow> = {}): DailyRow => ({
  day,
  plan: "free",
  limit_usd: null,
  cost: 0,
  answers: 0,
  searched_answers: 0,
  sessions_started: 0,
  ...over,
});

describe("dayPercent", () => {
  it("그날 남긴 한도가 있으면 그걸로 나눈다", () => {
    expect(dayPercent({ plan: "plus", limit_usd: "0.2", cost: "0.05" })).toBe(25);
  });
  it("한도가 없으면 그 요금제의 기본 한도로", () => {
    expect(dayPercent({ plan: "free", limit_usd: null, cost: PLANS.free.dailyUsd / 2 })).toBe(50);
    expect(dayPercent({ plan: "plus", limit_usd: null, cost: PLANS.plus.dailyUsd / 4 })).toBe(25);
  });
  it("모르는 요금제는 무료로, 100% 를 넘지 않는다", () => {
    expect(dayPercent({ plan: null, limit_usd: null, cost: PLANS.free.dailyUsd * 3 })).toBe(100);
  });
});

describe("resolveMonth", () => {
  const today = "2026-11-16";
  it("없거나 이상한 값이면 이번 달", () => {
    expect(resolveMonth(null, today, "2026-09-03")).toBe("2026-11");
    expect(resolveMonth("2026-13", today, "2026-09-03")).toBe("2026-11");
    expect(resolveMonth("abc", today, "2026-09-03")).toBe("2026-11");
  });
  it("미래 달은 이번 달로, 처음 쓴 달보다 앞은 처음 쓴 달로", () => {
    expect(resolveMonth("2027-01", today, "2026-09-03")).toBe("2026-11");
    expect(resolveMonth("2026-01", today, "2026-09-03")).toBe("2026-09");
    expect(resolveMonth("2026-10", today, "2026-09-03")).toBe("2026-10");
  });
  it("기록이 없으면 이번 달만", () => {
    expect(resolveMonth("2026-10", today, null)).toBe("2026-11");
  });
});

describe("buildHistory", () => {
  const today = "2026-11-16";
  const rows = [
    row("2026-11-02", { cost: PLANS.free.dailyUsd, answers: 9, searched_answers: 1, sessions_started: 1 }),
    row("2026-11-10", { cost: PLANS.free.dailyUsd * 0.3, answers: 3, sessions_started: 1 }),
    row("2026-11-16", { plan: "plus", limit_usd: 0.5, cost: 0.1, answers: 4, searched_answers: 2, sessions_started: 2 }),
  ];
  const h = buildHistory(rows, "2026-11", today, "2026-10-20");

  it("그 달의 모든 날을 채우고, 오늘 뒤는 future", () => {
    expect(h.days).toHaveLength(30);
    expect(h.days[0]).toMatchObject({ day: "2026-11-01", percent: 0, plan: null, future: false });
    expect(h.days[15]).toMatchObject({ day: "2026-11-16", percent: 20, plan: "plus", future: false });
    expect(h.days[16].future).toBe(true);
  });

  it("요약: 대화한 날만 평균, 가장 많이 쓴 날, 다 쓴 날", () => {
    expect(h.summary).toEqual({
      activeDays: 3,
      sessionsStarted: 4,
      answers: 16,
      searchedAnswers: 3,
      averagePercent: 50, // (100 + 30 + 20) / 3
      fullDays: 1,
      peak: { day: "2026-11-02", percent: 100 },
    });
  });

  it("이전 달은 처음 쓴 달까지, 다음 달은 이번 달까지", () => {
    expect(h.prevMonth).toBe("2026-10");
    expect(h.nextMonth).toBeNull();
    const oct = buildHistory([], "2026-10", today, "2026-10-20");
    expect(oct.prevMonth).toBeNull();
    expect(oct.nextMonth).toBe("2026-11");
    expect(oct.days).toHaveLength(31);
  });

  it("금액은 내보내지 않는다", () => {
    expect(JSON.stringify(h)).not.toMatch(/cost|limit_usd|usd/i);
  });

  it("기록이 없으면 비어 있는 달", () => {
    const empty = buildHistory([], "2026-11", today, null);
    expect(empty.summary.activeDays).toBe(0);
    expect(empty.summary.peak).toBeNull();
    expect(empty.summary.averagePercent).toBe(0);
    expect(empty.prevMonth).toBeNull();
  });
});
