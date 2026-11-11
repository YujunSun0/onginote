/**
 * 요금제별 한도. 숫자는 모두 여기서만 정한다 (서버 전용, .env.local 로 바꿀 수 있음).
 * 금액은 달러, 날짜 기준은 한국 시간 자정.
 */

export type PlanId = "free" | "plus";

export interface PlanLimits {
  /** 캐릭터 답변 모델 */
  chatModel: string;
  /** 하루 사용 한도 (달러) */
  dailyUsd: number;
  /** 하루 웹 검색 횟수 */
  dailySearches: number;
  /** 상담 하나에서 보낼 수 있는 내 메시지 수 */
  sessionMessages: number;
  /** 구독 기간(한 달) 사용 한도 (달러). 넘으면 그 기간 남은 날은 무료 수준으로 쓴다. 무료는 없음 */
  periodUsd: number | null;
}

function num(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return v > 0 ? v : fallback;
}

export const PLANS: Record<PlanId, PlanLimits> = {
  free: {
    chatModel: process.env.ONGI_FREE_CHAT_MODEL || "claude-haiku-5-5",
    dailyUsd: num("ONGI_FREE_DAILY_USD", 0.1),
    dailySearches: num("ONGI_FREE_DAILY_SEARCHES", 3),
    sessionMessages: num("ONGI_FREE_SESSION_MESSAGES", 40),
    periodUsd: null,
  },
  plus: {
    // 무료와 같은 모델: 답변 품질 차이는 작고 비용은 30배라, Plus 는 "양"을 늘린다 (2026-11-11 결정)
    chatModel: process.env.ONGI_PLUS_CHAT_MODEL || "claude-haiku-5-5",
    dailyUsd: num("ONGI_PLUS_DAILY_USD", 0.5),
    dailySearches: num("ONGI_PLUS_DAILY_SEARCHES", 20),
    sessionMessages: num("ONGI_PLUS_SESSION_MESSAGES", 80),
    periodUsd: num("ONGI_PLUS_PERIOD_USD", 8),
  },
};

/** 서비스 전체 하루 한도: 기본값에 Plus 회원 한 명당 이만큼 더한다 */
export const GLOBAL_BASE_DAILY_USD = num("ONGI_GLOBAL_DAILY_BUDGET_USD", 5);
export const GLOBAL_PER_PLUS_USD = num("ONGI_GLOBAL_PER_PLUS_USD", 0.5);

export const PLAN_LABEL: Record<PlanId, string> = { free: "무료", plus: "Plus" };

/** Plus 월 구독료 (원, 부가세 포함) */
export const PLUS_PRICE_KRW = 15000;
export const PLUS_ORDER_NAME = "온기노트 Plus 1개월";
/** 결제 실패 후 다시 시도하는 횟수 (하루 한 번). 그동안은 Plus 를 유지한다 */
export const BILLING_MAX_RETRIES = 3;
/** 결제 후 이 기간 안에 상담을 한 번도 하지 않았으면 전액 환불 */
export const REFUND_DAYS = 7;
