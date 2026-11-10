import { createAdminClient } from "./supabase/server";
import type { UsageKind } from "./types";

/**
 * API 사용량 기록과 하루 사용 한도.
 * 내부에서는 달러로 계산하고, 화면에는 본인 하루 한도 대비 퍼센트만 보여준다.
 *
 * 한도는 두 겹이다.
 * - 사람마다 하루 한도: 한 사람이 많이 써도 다른 사람에게 영향이 없게
 * - 서비스 전체 하루 한도: 사용자가 몰려도 요금이 폭주하지 않게
 */

function budget(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return v > 0 ? v : fallback;
}
/** 1인 하루 한도 (달러) */
export const USER_DAILY_BUDGET_USD = budget("ONGI_USER_DAILY_BUDGET_USD", 0.1);
/** 서비스 전체 하루 한도 (달러) */
export const GLOBAL_DAILY_BUDGET_USD = budget("ONGI_GLOBAL_DAILY_BUDGET_USD", 5);

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

export interface UsageStatus {
  /** 본인 오늘 한도 중 쓴 비율 (0~100, 반올림) */
  percent: number;
  exceeded: boolean;
  /** 서비스 전체 한도에 닿아서 막힌 경우 */
  serviceBusy?: boolean;
}

async function spent(day: string, userId: string | null): Promise<number> {
  const { data, error } = await createAdminClient().rpc("usage_spent", { p_day: day, p_user: userId });
  if (error) {
    console.error("usage sum failed", error);
    return 0;
  }
  return Number(data) || 0;
}

export async function getUsageStatus(userId: string): Promise<UsageStatus> {
  const today = koreaDay();
  const [mine, all] = await Promise.all([spent(today, userId), spent(today, null)]);
  const ratio = mine / USER_DAILY_BUDGET_USD;
  const serviceBusy = all >= GLOBAL_DAILY_BUDGET_USD;
  return {
    percent: Math.min(100, Math.round(ratio * 100)),
    exceeded: ratio >= 1 || serviceBusy,
    ...(serviceBusy ? { serviceBusy } : {}),
  };
}

export function budgetExceededMessage(status: UsageStatus): string {
  return status.serviceBusy && status.percent < 100
    ? "지금 이용하는 분이 많아서 오늘은 대화를 더 할 수 없어요. 내일 다시 이야기해요."
    : "오늘 쓸 수 있는 대화량을 다 썼어요. 내일 다시 이야기해요.";
}
