import type { CharacterId } from "./types";

/** 연말 결산: 화면과 서버가 같이 쓰는 것 (서버 전용 코드를 import 하지 않는다) */

export const RECAP_SEASON = {
  id: "2026",
  title: "온기노트 2026 결산",
  /** 볼 수 있는 기간 [openAt, closeAt) */
  openAt: "2026-12-15T00:00:00+09:00",
  closeAt: "2027-02-01T00:00:00+09:00",
  /** 이 시각 전의 상담만 넣는다 (12/31 까지) */
  dataEnd: "2027-01-01T00:00:00+09:00",
} as const;

/** 열리는 조건: 상담 수와 대화한 날 수 (2026-11-16 결정) */
export const RECAP_MIN_SESSIONS = 5;
export const RECAP_MIN_DAYS = 3;
/** 만든 뒤 상담이 이만큼 더 쌓이면 (12/31 전까지) 새 기록으로 다시 만들 수 있다 */
export const RECAP_REFRESH_SESSIONS = 3;

export type RecapState = "before" | "open" | "closed";

/**
 * 지금 결산을 볼 수 있는지. 개발 서버에서는 기간과 상관없이 열어서 미리 확인한다.
 * NEXT_PUBLIC_ONGI_RECAP_PREVIEW=1 이면 배포 환경에서도 미리 연다 (출시 전 확인용).
 */
export function recapState(now = Date.now()): RecapState {
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_ONGI_RECAP_PREVIEW === "1") return "open";
  if (now < Date.parse(RECAP_SEASON.openAt)) return "before";
  if (now >= Date.parse(RECAP_SEASON.closeAt)) return "closed";
  return "open";
}

/** 고민하는 시간대 (한국 시간, 내가 보낸 메시지 기준) */
export const TIME_BUCKETS = {
  dawn: { name: "새벽", range: "0~6시", label: "새벽 감성 고민러" },
  morning: { name: "아침", range: "6~12시", label: "아침형 고민러" },
  afternoon: { name: "오후", range: "12~18시", label: "한낮의 고민러" },
  evening: { name: "저녁", range: "18~22시", label: "퇴근길 고민러" },
  night: { name: "밤", range: "22~24시", label: "잠들기 전 고민러" },
} as const;
export type TimeBucket = keyof typeof TIME_BUCKETS;
export const TIME_BUCKET_IDS = Object.keys(TIME_BUCKETS) as TimeBucket[];

/** 캐릭터 답변 모드를 사용자가 원했던 것으로 묶는다 */
export const WANTS = {
  listen: { name: "그냥 들어줘", emoji: "🫂" },
  think: { name: "같이 생각해 줘", emoji: "🔍" },
  plan: { name: "어떻게 할지 정해 줘", emoji: "🗺️" },
} as const;
export type Want = keyof typeof WANTS;

export interface RecapStats {
  firstDay: string; // YYYY-MM-DD (한국)
  sessions: number;
  activeDays: number;
  summarized: number;
  people: number;
  /** 가장 많이 이야기한 사람. 이름은 저장하지 않고 화면에 줄 때 붙인다 (사람을 지우면 관계만 남는다) */
  topPerson: { personId: string; relation: string; sessions: number } | null;
  hours: Record<TimeBucket, number>;
  topBucket: TimeBucket;
  wants: Record<Want, number>;
  todos: { total: number; done: number };
  character: { id: CharacterId; sessions: number };
  /** 가장 길게 이야기한 날 */
  longestDay: { day: string; messages: number } | null;
}

/** DB 에 저장하는 결산 */
export interface RecapContent {
  season: string;
  stats: RecapStats;
  /** 자주 나온 고민 (많은 순, 최대 3개) */
  topics: { name: string; count: number }[];
  headline: string;
  letter: string;
}

/** 화면으로 내보내는 결산 */
export interface RecapView extends RecapContent {
  id: string;
  createdAt: string;
  /** 가장 많이 이야기한 사람 이름 (지금도 있으면) */
  topPersonName: string | null;
}

export interface RecapProgress {
  sessions: number;
  days: number;
  ok: boolean;
}

export const recapOk = (sessions: number, days: number) => sessions >= RECAP_MIN_SESSIONS && days >= RECAP_MIN_DAYS;
