export type CharacterId = "mongle" | "yeoul" | "olly" | "daon";

/** 상담 모드. 고정된 단계가 아니라 대화 흐름에 따라 오간다. */
export type Mode = "chat" | "listen" | "explore" | "interpret" | "react" | "offer_plan" | "plan";

export interface Person {
  id: string;
  name: string;
  relation: string; // 썸, 연인, 친구, 가족, 직장 ...
  mbti?: string;
  age?: string;
  birthday?: string; // "MM-DD"
  likes: string[];
  dislikes: string[];
  contactStyle?: string;
  notes: string[]; // 메모 (성격, 습관 등 자유롭게)
  timeline: { date: string; text: string }[];
  createdAt: string;
}

export interface ChatImage {
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  /** base64. 브라우저가 보낼 때와, 서버가 Claude 에 넘기려고 내려받았을 때만 있다 */
  data?: string;
  /** Storage(chat-images) 안의 경로. DB 에는 이것만 저장한다 */
  path?: string;
  /** 화면에 보여줄 임시 서명 URL (1시간) */
  url?: string;
}

/** 웹 검색으로 참고한 것. 답변 아래에 출처로 보여준다 */
export interface MessageSources {
  queries: string[];
  links: { title: string; url: string }[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  images?: ChatImage[];
  /** @deprecated 예전 데이터(사진 1장)용. 읽을 때는 messageImages()를 쓴다. */
  image?: ChatImage;
  mode?: Mode; // assistant 메시지가 어떤 모드에서 나왔는지
  sources?: MessageSources;
  at: string;
}

/** none: 아직 정리 안 함 / done: 정리함 / stale: 정리한 뒤 이어서 얘기함 */
export type SummaryState = "none" | "done" | "stale";

export function summaryState(summary: Summary | null | undefined, messageCount: number): SummaryState {
  if (!summary) return "none";
  return messageCount > (summary.messageCount ?? messageCount) ? "stale" : "done";
}

/** 한 메시지에 붙일 수 있는 사진 수 */
export const MAX_IMAGES = 5;
/** 메시지 하나의 최대 글자 수 */
export const MAX_INPUT_CHARS = 2000;
/** 상담 하나의 남은 메시지가 이만큼 이하가 되면 남은 횟수를 알려준다. 상담 길이는 요금제마다 다르다 (plans.ts). */
export const WARN_REMAINING_MESSAGES = 5;
/** 남은 메시지가 이만큼 이하면 캐릭터가 마무리하고 정리로 이끈다 */
export const WRAP_UP_MESSAGES = 2;

export function messageImages(m: ChatMessage): ChatImage[] {
  return m.images ?? (m.image ? [m.image] : []);
}

export type ProfileField =
  | "likes"
  | "dislikes"
  | "contactStyle"
  | "notes"
  | "timeline"
  | "mbti"
  | "age"
  | "birthday";

export interface ProfileSuggestion {
  field: ProfileField;
  value: string;
}

export interface Summary {
  title: string;
  situation: string;
  interpretation: string;
  todo: string[];
  /** 할 것 체크 여부 (todo 와 같은 순서). 홈의 "상담에서 정한 할 일"에서 체크한다 */
  todoDone?: boolean[];
  dont: string[];
  /** @deprecated 예전 정리 카드에만 있음. 사용자 말투를 모르는 초안은 도움이 안 돼서 더 만들지 않는다. */
  messageDraft?: string;
  suggestions: ProfileSuggestion[];
  applied: boolean;
  /** 정리할 때의 메시지 수. 이보다 메시지가 많으면 정리 이후에 이어서 얘기한 것 */
  messageCount?: number;
}

export interface FollowUp {
  dueAt: string; // ISO
  message: string; // 캐릭터 말투의 선톡
  dismissed: boolean; // 이미 열어봄
  muted?: boolean; // 사용자가 이 선톡을 끔
}

export interface Session {
  id: string;
  characterId: CharacterId;
  personId: string | null;
  voice: boolean;
  mode: Mode;
  planOfferedAt: number | null; // 플랜을 제안한 메시지 인덱스
  messages: ChatMessage[];
  summary?: Summary;
  followUp?: FollowUp;
  createdAt: string;
}

/** 목록 화면용: 메시지 없이 상담 정보와 마지막 메시지만 */
export interface SessionMeta extends Omit<Session, "messages"> {
  messageCount: number;
  userMessageCount: number;
  lastText: string | null;
  lastAt: string | null;
}

export type UsageKind = "router" | "chat" | "summary" | "ask" | "report";

