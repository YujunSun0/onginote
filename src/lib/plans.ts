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
  /** 하루에 검색을 쓸 수 있는 답변 수 (답변 하나에서 여러 번 검색해도 1번) */
  dailySearches: number;
  /** 하루에 새로 시작할 수 있는 상담 수. null 이면 제한 없음 */
  dailySessions: number | null;
  /** 한 달(한국 달력 기준)에 새로 시작할 수 있는 상담 수. null 이면 제한 없음 */
  monthlySessions: number | null;
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
    dailySearches: num("ONGI_FREE_DAILY_SEARCHES", 1),
    // 맛보기: 상담 하나를 끝까지 해 보고 정리 카드까지 받는 만큼 (2026-11-12 결정)
    dailySessions: num("ONGI_FREE_DAILY_SESSIONS", 1),
    monthlySessions: num("ONGI_FREE_MONTHLY_SESSIONS", 10),
    sessionMessages: num("ONGI_FREE_SESSION_MESSAGES", 15),
    periodUsd: null,
  },
  plus: {
    // 무료와 같은 모델: 답변 품질 차이는 작고 비용은 30배라, 온기 패스는 "양"을 늘린다 (2026-11-11 결정)
    chatModel: process.env.ONGI_PLUS_CHAT_MODEL || "claude-haiku-5-5",
    dailyUsd: num("ONGI_PLUS_DAILY_USD", 0.5),
    // 검색은 1번에 $0.01 이라 비용이 가장 큰 항목: 하루 5번이면 한 달 최대 약 $3
    dailySearches: num("ONGI_PLUS_DAILY_SEARCHES", 5),
    // 사실상 제한 없음. 비정상적인 사용만 막는 안전장치
    dailySessions: num("ONGI_PLUS_DAILY_SESSIONS", 10),
    monthlySessions: null,
    sessionMessages: num("ONGI_PLUS_SESSION_MESSAGES", 80),
    // 구독료(9,900원)에서 수수료·부가세를 빼도 남도록
    periodUsd: num("ONGI_PLUS_PERIOD_USD", 4),
  },
};

/** 답변 하나에서 할 수 있는 웹 검색 수 */
export const SEARCHES_PER_ANSWER = 2;

/** 서비스 전체 하루 한도: 기본값에 온기 패스 회원 한 명당 이만큼 더한다 */
export const GLOBAL_BASE_DAILY_USD = num("ONGI_GLOBAL_DAILY_BUDGET_USD", 5);
export const GLOBAL_PER_PLUS_USD = num("ONGI_GLOBAL_PER_PLUS_USD", 0.5);

export const PLAN_LABEL: Record<PlanId, string> = { free: "무료", plus: "온기 패스" };

/** 온기 패스 월 구독료 (원, 부가세 포함) */
export const PLUS_PRICE_KRW = 9900;
export const PLUS_ORDER_NAME = "온기노트 온기 패스 1개월";
/** 결제 실패 후 다시 시도하는 횟수 (하루 한 번). 그동안은 온기 패스를 유지한다 */
export const BILLING_MAX_RETRIES = 3;
/** 결제 후 이 기간 안에 상담을 한 번도 하지 않았으면 전액 환불 */
export const REFUND_DAYS = 7;
