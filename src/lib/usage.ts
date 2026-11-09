import { getDb, updateDb } from "./db";
import type { Db, UsageKind, UsageRecord } from "./types";

/**
 * API 사용량 기록과 하루 사용 한도.
 * 내부에서는 달러로 계산하고, 화면에는 하루 한도 대비 퍼센트만 보여준다.
 */

/** 하루 한도 (달러). .env.local 의 ONGI_DAILY_BUDGET_USD 로 바꾼다. */
export const DAILY_BUDGET_USD = Number(process.env.ONGI_DAILY_BUDGET_USD) > 0 ? Number(process.env.ONGI_DAILY_BUDGET_USD) : 1;

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

function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 응답 하나의 사용량을 저장한다. 실패해도 대화는 계속되게 오류를 삼킨다. */
export async function recordUsage(kind: UsageKind, model: string, u: ApiUsage | null | undefined, sessionId?: string) {
  if (!u) return;
  const rec: UsageRecord = {
    at: new Date().toISOString(),
    day: localDay(),
    kind,
    model,
    sessionId,
    input: u.input_tokens,
    cacheWrite: u.cache_creation_input_tokens ?? 0,
    cacheRead: u.cache_read_input_tokens ?? 0,
    output: u.output_tokens,
    searches: u.server_tool_use?.web_search_requests ?? 0,
    cost: costOf(model, u),
  };
  try {
    await updateDb((db) => {
      db.usage ??= [];
      db.usage.push(rec);
      // 60일보다 오래된 기록은 지운다
      const cutoff = localDay(new Date(Date.now() - 60 * 86_400_000));
      if (db.usage[0] && db.usage[0].day < cutoff) db.usage = db.usage.filter((r) => r.day >= cutoff);
    });
  } catch (err) {
    console.error("usage record failed", err);
  }
}

export interface UsageStatus {
  /** 오늘 한도 중 쓴 비율 (0~100, 반올림) */
  percent: number;
  exceeded: boolean;
}

export function usageStatus(db: Db): UsageStatus {
  const today = localDay();
  const spent = (db.usage ?? []).filter((r) => r.day === today).reduce((sum, r) => sum + r.cost, 0);
  const ratio = spent / DAILY_BUDGET_USD;
  return { percent: Math.min(100, Math.round(ratio * 100)), exceeded: ratio >= 1 };
}

export async function getUsageStatus(): Promise<UsageStatus> {
  return usageStatus(await getDb());
}

export const BUDGET_EXCEEDED_MESSAGE = "오늘 쓸 수 있는 대화량을 다 썼어요. 내일 다시 이야기해요.";
