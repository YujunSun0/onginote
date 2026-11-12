import type { CharacterId } from "./types";

/** 리포트 화면과 서버가 같이 쓰는 것 (서버 전용 코드를 import 하지 않는다) */

export const REPORT_UNLOCK_SESSIONS = 3;

// ─────────────────────────────────────────────
// 유형 8개. 카드 디자인이 통일되고 서로 비교하기 좋게 미리 정해 둔다. 설명 문장은 사람마다 AI 가 새로 쓴다.
// ─────────────────────────────────────────────
export const LOVE_TYPES = {
  checker: { name: "조심스러운 확인형", emoji: "🔍", color: "#5B7FA6", desc: "마음을 확인하고 싶어서 작은 신호도 꼼꼼히 읽는 사람" },
  expresser: { name: "솔직한 표현형", emoji: "💌", color: "#D9614C", desc: "좋으면 좋다고, 서운하면 서운하다고 말하는 사람" },
  caretaker: { name: "다정한 배려형", emoji: "🧺", color: "#E59A3B", desc: "내 마음보다 상대 마음을 먼저 챙기는 사람" },
  steady: { name: "느긋한 안정형", emoji: "🌿", color: "#6E9C6A", desc: "천천히, 하지만 단단하게 신뢰를 쌓는 사람" },
  thinker: { name: "깊은 고민형", emoji: "🌙", color: "#6B5FA8", desc: "말하기 전에 혼자 오래 생각하고 정리하는 사람" },
  romantic: { name: "설레는 로맨티스트형", emoji: "🌷", color: "#D46A93", desc: "의미 있는 순간과 설렘을 소중히 여기는 사람" },
  independent: { name: "단단한 독립형", emoji: "⛰️", color: "#4E8A8C", desc: "함께여도 나의 시간과 기준을 지키는 사람" },
  harmonizer: { name: "평화로운 조율형", emoji: "🕊️", color: "#8A7B6B", desc: "부딪히기보다 맞춰 가며 관계를 지키는 사람" },
} as const;
export type LoveTypeId = keyof typeof LOVE_TYPES;
export const TYPE_IDS = Object.keys(LOVE_TYPES) as [LoveTypeId, ...LoveTypeId[]];


/** 결제 전에 보여주는 부분: 공유 카드(유형·한 줄·키워드)와 첫 항목(감정) */
export interface ReportPreview {
  type: LoveTypeId;
  headline: string;
  keywords: string[];
  emotions: { name: string; desc: string; evidence: string }[];
}

/** 결제 후 전체 */
export interface PersonalityReport extends ReportPreview {
  values: { title: string; desc: string; evidence: string }[];
  patterns: { situation: string; reaction: string; evidence: string }[];
  strengths: { title: string; desc: string }[];
  stumbles: { title: string; desc: string; tryThis: string }[];
  characterNote: string;
}

/** 화면으로 내보내는 리포트. 결제 전이면 미리보기 부분만 담는다 */
export interface ReportView {
  id: string;
  paid: boolean;
  createdAt: string;
  sourceCount: number;
  orderId: string | null;
  content: ReportPreview | PersonalityReport;
  /** 내가 가장 많이 상담한 캐릭터 (카드 그림) */
  characterId: CharacterId;
}

export function isFullReport(c: ReportPreview | PersonalityReport): c is PersonalityReport {
  return "values" in c;
}
