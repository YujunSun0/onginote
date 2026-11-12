import { GLOBAL_BASE_DAILY_USD, GLOBAL_PER_PLUS_USD, PLANS, type PlanId, type PlanLimits } from "./plans";
import { createAdminClient } from "./supabase/server";
import type { UsageKind } from "./types";

/**
 * API 사용량 기록과 하루 사용 한도.
 * 내부에서는 달러로 계산하고, 화면에는 본인 하루 한도 대비 퍼센트만 보여준다.
 *
 * 한도는 세 겹이다. 숫자는 plans.ts 에 있다.
 * - 사람마다 하루 한도 (요금제별): 한 사람이 많이 써도 다른 사람에게 영향이 없게
 * - Plus 구독 기간 한도: 넘으면 그 기간 남은 날은 무료 수준으로 (구독료보다 많이 쓰지 않게)
 * - 서비스 전체 하루 한도 (Plus 인원만큼 늘어남): 사용자가 몰려도 요금이 폭주하지 않게
 */

/** 100만 토큰당 가격 (달러). 캐시 쓰기는 입력의 1.25배(5분), 캐시 읽기는 0.1배. */
const PRICES: { match: string; input: number; output: number }[] = [
  { match: "haiku-5-5", input: 0.1, output: 0.5 },
  { match: "sonnet-5-5", input: 2, output: 10 },
  { match: "opus-5-5", input: 4, output: 20 },
];
const DEFAULT_PRICE = { input: 4, output: 20 }; // 모르는 모델은 비싼 쪽으로 계산
const WEB_SEARCH_USD = 0.01; // 검색 1회

/** API 응답의 usage (일반·beta 둘 다 이 필드를 갖는다) */
export interface ApiUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
}

export function costOf(model: string, u: ApiUsage): number {
  const p = PRICES.find((x) => model.includes(x.match)) ?? DEFAULT_PRICE;
  const cw = u.cache_creation_input_tokens ?? 0;
  const cr = u.cache_read_input_tokens ?? 0;
  const searches = u.server_tool_use?.web_search_requests ?? 0;
  return (
    (u.input_tokens * p.input + cw * p.input * 1.25 + cr * p.input * 0.1 + u.output_tokens * p.output) / 1_000_000 +
    searches * WEB_SEARCH_USD
  );
}

/** 한국 날짜 YYYY-MM-DD. 서버가 어느 나라에 있든 자정 기준을 한국에 맞춘다. */
function koreaDay(d = new Date()): string {
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * 응답 하나의 사용량을 저장한다. 사용자가 고치거나 지울 수 없도록 관리자 권한으로 쓴다.
 * 실패해도 대화는 계속되게 오류를 삼킨다.
 */
export async function recordUsage(
  userId: string,
  kind: UsageKind,
  model: string,
  u: ApiUsage | null | undefined,
  sessionId?: string,
) {
  if (!u) return;
  const { error } = await createAdminClient()
    .from("usage")
    .insert({
      user_id: userId,
      day: koreaDay(),
      kind,
      model,
      session_id: sessionId ?? null,
      input: u.input_tokens,
      cache_write: u.cache_creation_input_tokens ?? 0,
      cache_read: u.cache_read_input_tokens ?? 0,
      output: u.output_tokens,
      searches: u.server_tool_use?.web_search_requests ?? 0,
      cost: costOf(model, u),
    });
  if (error) console.error("usage record failed", error);
}

/** 화면에 내보내는 사용 현황. 금액과 모델 이름은 내보내지 않는다. */
export interface UsageStatus {
  /** 가입한 요금제 */
  plan: PlanId;
  /** Plus 이용 기간 끝 (ISO). 무료면 null */
  plusUntil: string | null;
  /** Plus 해지 예약 등 상태. 무료면 null */
  plusStatus: SubStatus | null;
  /** Plus 구독 기간 한도에 닿아 무료 수준으로 쓰는 중 */
  periodCapped: boolean;
  /** 본인 오늘 한도 중 쓴 비율 (0~100, 반올림) */
  percent: number;
  exceeded: boolean;
  /** 서비스 전체 한도에 닿아서 막힌 경우 */
  serviceBusy?: boolean;
  /** 오늘 남은 웹 검색 횟수 */
  searchesLeft: number;
  /** 상담 하나에서 보낼 수 있는 내 메시지 수 */
  sessionMessages: number;
}

/** 서버 안에서만 쓰는 것까지 포함 */
export interface Allowance extends UsageStatus {
  limits: PlanLimits;
}

type SubStatus = "active" | "canceled" | "past_due";
export interface Snapshot {
  sub: { status: SubStatus | "expired"; current_period_start: string; current_period_end: string; grace_until: string | null } | null;
  mine_day: number;
  searches_day: number;
  mine_period: number;
  all_day: number;
  plus_members: number;
}

export async function getAllowance(userId: string): Promise<Allowance> {
  const { data, error } = await createAdminClient().rpc("usage_snapshot", { p_user: userId, p_day: koreaDay() });
  if (error) console.error("usage snapshot failed", error);
  return allowanceFromSnapshot((data ?? {}) as Partial<Snapshot>);
}

/** DB 에서 읽은 오늘·이번 기간 사용량으로 요금제와 남은 한도를 계산한다 (DB 조회 없는 순수 계산) */
export function allowanceFromSnapshot(snap: Partial<Snapshot>, now = Date.now()): Allowance {
  const sub = snap.sub ?? null;
  // 기간이 끝났어도 결제 재시도 중(grace_until)이면 Plus 를 유지한다
  const until = sub ? Math.max(new Date(sub.current_period_end).getTime(), sub.grace_until ? new Date(sub.grace_until).getTime() : 0) : 0;
  const isPlus = !!sub && sub.status !== "expired" && until > now;

  const plus = PLANS.plus;
  const periodCapped = isPlus && plus.periodUsd !== null && Number(snap.mine_period ?? 0) >= plus.periodUsd;
  // 기간 한도에 닿은 Plus 는 무료 수준으로 계속 쓴다 (상담 길이는 Plus 그대로)
  const limits: PlanLimits = !isPlus ? PLANS.free : periodCapped ? { ...PLANS.free, sessionMessages: plus.sessionMessages } : plus;

  const ratio = Number(snap.mine_day ?? 0) / limits.dailyUsd;
  const globalBudget = GLOBAL_BASE_DAILY_USD + Number(snap.plus_members ?? 0) * GLOBAL_PER_PLUS_USD;
  const serviceBusy = Number(snap.all_day ?? 0) >= globalBudget;
  return {
    plan: isPlus ? "plus" : "free",
    plusUntil: isPlus ? sub.current_period_end : null,
    plusStatus: isPlus ? (sub.status as SubStatus) : null,
    periodCapped,
    percent: Math.min(100, Math.round(ratio * 100)),
    exceeded: ratio >= 1 || serviceBusy,
    ...(serviceBusy ? { serviceBusy } : {}),
    searchesLeft: Math.max(0, limits.dailySearches - Number(snap.searches_day ?? 0)),
    sessionMessages: limits.sessionMessages,
    limits,
  };
}

/** 화면용으로 내보낼 때 */
export async function getUsageStatus(userId: string): Promise<UsageStatus> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { limits, ...status } = await getAllowance(userId);
  return status;
}

export function budgetExceededMessage(status: UsageStatus): string {
  if (status.serviceBusy && status.percent < 100) {
    return "지금 이용하는 분이 많아서 오늘은 대화를 더 할 수 없어요. 내일 다시 이야기해요.";
  }
  return status.plan === "free"
    ? "오늘 쓸 수 있는 대화량을 다 썼어요. 내일 다시 이야기해요. Plus로 바꾸면 더 이야기할 수 있어요."
    : "오늘 쓸 수 있는 대화량을 다 썼어요. 내일 다시 이야기해요.";
}
