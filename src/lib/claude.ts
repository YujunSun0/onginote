import Anthropic from "@anthropic-ai/sdk";

// ANTHROPIC_API_KEY 는 .env.local 에서 읽는다.
// 키가 없을 때 서버 전체가 죽지 않도록 처음 쓸 때 만든다.
let _client: Anthropic | null = null;

export class MissingKeyError extends Error {}

export function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new MissingKeyError("ANTHROPIC_API_KEY is not set");
  }
  if (!_client) _client = new Anthropic();
  return _client;
}

// 기본은 Claude Opus 5.5. 비용을 줄이고 싶으면 .env.local 에서 바꾼다.
// (예: ONGI_ROUTER_MODEL=claude-haiku-5-5 로 모드 판단만 저렴한 모델에 맡기기)
export const CHAT_MODEL = process.env.ONGI_CHAT_MODEL || "claude-opus-5-5";
export const ROUTER_MODEL = process.env.ONGI_ROUTER_MODEL || "claude-opus-5-5";

export function apiErrorMessage(err: unknown): string {
  if (err instanceof MissingKeyError) {
    return "API 키가 설정되지 않았어요. .env.local 에 ANTHROPIC_API_KEY 를 넣고 서버를 다시 켜 주세요.";
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return "API 키가 없거나 잘못됐어요. .env.local 의 ANTHROPIC_API_KEY 를 확인해 주세요.";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.";
  }
  if (err instanceof Anthropic.APIError) {
    return `Claude API 오류 (${err.status}): ${err.message}`;
  }
  return "알 수 없는 오류가 났어요.";
}
