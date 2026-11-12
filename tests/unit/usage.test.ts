import { describe, expect, it } from "vitest";
import { GLOBAL_BASE_DAILY_USD, GLOBAL_PER_PLUS_USD, PLANS } from "@/lib/plans";
import { allowanceFromSnapshot, costOf, type Snapshot } from "@/lib/usage";

const NOW = new Date("2026-11-12T03:00:00Z").getTime();
const day = 24 * 3600e3;
const iso = (ms: number) => new Date(ms).toISOString();

type Sub = NonNullable<Snapshot["sub"]>;
const sub = (over: Partial<Sub> = {}): Sub => ({
  status: "active",
  current_period_start: iso(NOW - 10 * day),
  current_period_end: iso(NOW + 20 * day),
  grace_until: null,
  ...over,
});
const allow = (snap: Partial<Snapshot>) => allowanceFromSnapshot(snap, NOW);

describe("allowanceFromSnapshot: 요금제 판단", () => {
  it("구독이 없으면 무료", () => {
    const a = allow({});
    expect(a.plan).toBe("free");
    expect(a.limits).toEqual(PLANS.free);
    expect(a.plusUntil).toBeNull();
  });

  it("기간 안의 구독은 Plus", () => {
    const a = allow({ sub: sub() });
    expect(a.plan).toBe("plus");
    expect(a.limits).toEqual(PLANS.plus);
    expect(a.plusStatus).toBe("active");
  });

  it("해지 예약(canceled)이어도 기간이 남았으면 Plus", () => {
    expect(allow({ sub: sub({ status: "canceled" }) }).plan).toBe("plus");
  });

  it("기간이 끝났어도 결제 재시도 중(grace_until)이면 Plus 유지", () => {
    const a = allow({ sub: sub({ status: "past_due", current_period_end: iso(NOW - day), grace_until: iso(NOW + 2 * day) }) });
    expect(a.plan).toBe("plus");
  });

  it("재시도 기간까지 지나면 무료", () => {
    const a = allow({ sub: sub({ status: "past_due", current_period_end: iso(NOW - 4 * day), grace_until: iso(NOW - day) }) });
    expect(a.plan).toBe("free");
  });

  it("만료(expired)는 날짜와 상관없이 무료", () => {
    expect(allow({ sub: sub({ status: "expired" }) }).plan).toBe("free");
  });
});

describe("allowanceFromSnapshot: 한도", () => {
  it("하루 사용량을 본인 한도 대비 퍼센트로", () => {
    const a = allow({ mine_day: PLANS.free.dailyUsd * 0.42 });
    expect(a.percent).toBe(42);
    expect(a.exceeded).toBe(false);
  });

  it("하루 한도에 닿으면 막고, 퍼센트는 100에서 멈춘다", () => {
    const a = allow({ mine_day: PLANS.free.dailyUsd * 1.5 });
    expect(a.exceeded).toBe(true);
    expect(a.percent).toBe(100);
  });

  it("같은 사용량도 Plus 는 덜 찬다", () => {
    const used = PLANS.free.dailyUsd;
    expect(allow({ mine_day: used }).exceeded).toBe(true);
    expect(allow({ mine_day: used, sub: sub() }).exceeded).toBe(false);
  });

  it("Plus 한 달 한도에 닿으면 무료 수준 하루 한도, 상담 길이는 Plus 그대로", () => {
    const a = allow({ sub: sub(), mine_period: PLANS.plus.periodUsd! });
    expect(a.plan).toBe("plus");
    expect(a.periodCapped).toBe(true);
    expect(a.limits.dailyUsd).toBe(PLANS.free.dailyUsd);
    expect(a.limits.dailySearches).toBe(PLANS.free.dailySearches);
    expect(a.sessionMessages).toBe(PLANS.plus.sessionMessages);
  });

  it("남은 웹 검색 횟수는 0 아래로 내려가지 않는다", () => {
    expect(allow({ searches_day: 1 }).searchesLeft).toBe(PLANS.free.dailySearches - 1);
    expect(allow({ searches_day: 999 }).searchesLeft).toBe(0);
  });

  it("서비스 전체 하루 한도에 닿으면 본인 한도가 남아도 막는다", () => {
    const a = allow({ mine_day: 0, all_day: GLOBAL_BASE_DAILY_USD });
    expect(a.exceeded).toBe(true);
    expect(a.serviceBusy).toBe(true);
    expect(a.percent).toBe(0);
  });

  it("서비스 전체 한도는 Plus 인원만큼 늘어난다", () => {
    const all = GLOBAL_BASE_DAILY_USD + GLOBAL_PER_PLUS_USD; // 기본 한도보다 조금 더 씀
    expect(allow({ all_day: all, plus_members: 0 }).serviceBusy).toBe(true);
    expect(allow({ all_day: all, plus_members: 3 }).serviceBusy).toBeUndefined();
  });

  it("DB 값이 문자열(numeric)로 와도 계산된다", () => {
    const a = allow({ mine_day: String(PLANS.free.dailyUsd / 2) as unknown as number });
    expect(a.percent).toBe(50);
  });
});

describe("costOf: 토큰 수 → 달러", () => {
  it("입력·출력 토큰", () => {
    // haiku-5-5: 100만 토큰당 입력 0.1, 출력 0.5
    expect(costOf("claude-haiku-5-5", { input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBeCloseTo(0.6);
  });

  it("캐시 쓰기는 1.25배, 캐시 읽기는 0.1배", () => {
    const c = costOf("claude-haiku-5-5", {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 1_000_000,
      cache_read_input_tokens: 1_000_000,
    });
    expect(c).toBeCloseTo(0.1 * 1.25 + 0.1 * 0.1);
  });

  it("웹 검색은 1회 0.01달러", () => {
    expect(costOf("claude-haiku-5-5", { input_tokens: 0, output_tokens: 0, server_tool_use: { web_search_requests: 3 } })).toBeCloseTo(0.03);
  });

  it("모르는 모델은 비싼 쪽으로 계산 (한도를 넘기지 않게)", () => {
    const unknown = costOf("some-new-model", { input_tokens: 1_000_000, output_tokens: 0 });
    const haiku = costOf("claude-haiku-5-5", { input_tokens: 1_000_000, output_tokens: 0 });
    expect(unknown).toBeGreaterThan(haiku);
  });
});
