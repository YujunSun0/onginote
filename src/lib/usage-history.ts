import { PLANS, type PlanId } from "./plans";
import { createAdminClient } from "./supabase/server";
import { koreaDay } from "./usage";

/**
 * 날짜별 사용량 (사용량 화면의 막대그래프).
 * DB 의 usage_daily(0009) 를 읽어서, 금액은 그날 하루 한도 대비 % 로만 바꿔 내보낸다.
 */

/** DB 한 줄 (서버 안에서만) */
export interface DailyRow {
  day: string;
  plan: string | null;
  limit_usd: number | string | null;
  cost: number | string;
  answers: number;
  searched_answers: number;
  sessions_started: number;
}

/** 화면에 내보내는 하루. 금액은 없다 */
export interface UsageDay {
  day: string; // YYYY-MM-DD (한국 날짜)
  /** 그날 하루 한도 중 쓴 비율 (0~100). 쓰지 않은 날은 0 */
  percent: number;
  answers: number;
  searchedAnswers: number;
  sessionsStarted: number;
  /** 그날 요금제. 쓰지 않은 날은 null */
  plan: PlanId | null;
  /** 아직 오지 않은 날 */
  future: boolean;
}

export interface UsageHistory {
  month: string; // YYYY-MM
  today: string;
  /** 볼 수 있는 이전·다음 달. 없으면 null */
  prevMonth: string | null;
  nextMonth: string | null;
  days: UsageDay[];
  summary: {
    /** 대화한 날 수 */
    activeDays: number;
    sessionsStarted: number;
    answers: number;
    searchedAnswers: number;
    /** 대화한 날의 평균 % (반올림). 대화한 날이 없으면 0 */
    averagePercent: number;
    /** 한도를 다 쓴 날 수 */
    fullDays: number;
    /** 가장 많이 쓴 날. 대화한 날이 없으면 null */
    peak: { day: string; percent: number } | null;
  };
}

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function planOf(p: string | null): PlanId {
  return p === "plus" ? "plus" : "free";
}

/** 하루 % : 그날 남긴 한도가 있으면 그걸로, 없으면 그 요금제의 지금 한도로 */
export function dayPercent(row: Pick<DailyRow, "plan" | "limit_usd" | "cost">): number {
  const limit = Number(row.limit_usd) > 0 ? Number(row.limit_usd) : PLANS[planOf(row.plan)].dailyUsd;
  return Math.min(100, Math.round((Number(row.cost) / limit) * 100));
}

/**
 * 볼 달을 정한다. 이상한 값이거나 범위를 벗어나면 가장 가까운 달로.
 * firstDay 는 처음 사용한 날 (없으면 이번 달만).
 */
export function resolveMonth(requested: string | null | undefined, today: string, firstDay: string | null): string {
  const current = today.slice(0, 7);
  const first = firstDay ? firstDay.slice(0, 7) : current;
  if (!requested || !MONTH_RE.test(requested)) return current;
  if (requested > current) return current;
  if (requested < first) return first;
  return requested;
}

/** DB 줄로 한 달 화면 데이터를 만든다 (DB 조회 없는 순수 계산) */
export function buildHistory(rows: DailyRow[], month: string, today: string, firstDay: string | null): UsageHistory {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const days: UsageDay[] = [];
  for (let i = 1; i <= daysInMonth(month); i++) {
    const day = `${month}-${String(i).padStart(2, "0")}`;
    const r = byDay.get(day);
    days.push({
      day,
      percent: r ? dayPercent(r) : 0,
      answers: r?.answers ?? 0,
      searchedAnswers: r?.searched_answers ?? 0,
      sessionsStarted: r?.sessions_started ?? 0,
      plan: r ? planOf(r.plan) : null,
      future: day > today,
    });
  }

  const active = days.filter((d) => d.plan !== null);
  const peak = active.reduce<UsageDay | null>((best, d) => (!best || d.percent > best.percent ? d : best), null);
  const sum = (f: (d: UsageDay) => number) => active.reduce((n, d) => n + f(d), 0);

  const current = today.slice(0, 7);
  const first = firstDay ? firstDay.slice(0, 7) : current;
  return {
    month,
    today,
    prevMonth: month > first ? shiftMonth(month, -1) : null,
    nextMonth: month < current ? shiftMonth(month, 1) : null,
    days,
    summary: {
      activeDays: active.length,
      sessionsStarted: sum((d) => d.sessionsStarted),
      answers: sum((d) => d.answers),
      searchedAnswers: sum((d) => d.searchedAnswers),
      averagePercent: active.length ? Math.round(sum((d) => d.percent) / active.length) : 0,
      fullDays: active.filter((d) => d.percent >= 100).length,
      peak: peak && peak.percent > 0 ? { day: peak.day, percent: peak.percent } : null,
    },
  };
}

/** 내 한 달 사용량. month 는 YYYY-MM (없거나 범위 밖이면 가장 가까운 달) */
export async function getUsageHistory(userId: string, requested?: string | null): Promise<UsageHistory> {
  const admin = createAdminClient();
  const today = koreaDay();
  const { data: first, error: firstError } = await admin
    .from("usage_daily")
    .select("day")
    .eq("user_id", userId)
    .order("day", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (firstError) console.error("usage history first day failed", firstError);
  const firstDay = (first?.day as string | undefined) ?? null;

  const month = resolveMonth(requested, today, firstDay);
  const { data, error } = await admin
    .from("usage_daily")
    .select("day, plan, limit_usd, cost, answers, searched_answers, sessions_started")
    .eq("user_id", userId)
    .gte("day", `${month}-01`)
    .lte("day", `${month}-${daysInMonth(month)}`);
  if (error) {
    console.error("usage history failed", error);
    throw error;
  }
  return buildHistory((data ?? []) as DailyRow[], month, today, firstDay);
}
