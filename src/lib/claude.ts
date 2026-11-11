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

// 캐릭터 답변 모델은 요금제마다 다르다 (plans.ts).
// 모드 판단, 정리하기, 물어보기는 요금제와 상관없이 Haiku 5.5 (정해진 형식으로 짧게 답하는 일)
export const ROUTER_MODEL = process.env.ONGI_ROUTER_MODEL || "claude-haiku-5-5";
export const LIGHT_MODEL = process.env.ONGI_LIGHT_MODEL || "claude-haiku-5-5";

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
