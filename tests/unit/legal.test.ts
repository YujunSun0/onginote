import { afterEach, describe, expect, it } from "vitest";
import { BUSINESS, CONSENT_VERSION, businessReady, hasConsented } from "@/lib/legal";
import { summaryState, messageImages, type ChatMessage } from "@/lib/types";

describe("hasConsented: 로그인 토큰으로 동의 여부 확인", () => {
  it("지금 버전에 동의했으면 통과", () => {
    expect(hasConsented({ app_metadata: { consent_version: CONSENT_VERSION } })).toBe(true);
  });
  it("예전 버전이면 다시 동의 (약관 변경)", () => {
    expect(hasConsented({ app_metadata: { consent_version: "2026-01-01" } })).toBe(false);
  });
  it("동의 기록이 없거나 로그인 정보가 없으면 거부", () => {
    expect(hasConsented({ app_metadata: {} })).toBe(false);
    expect(hasConsented({})).toBe(false);
    expect(hasConsented(null)).toBe(false);
  });
  it("사용자가 고칠 수 있는 user_metadata 는 보지 않는다", () => {
    const claims = { app_metadata: {}, user_metadata: { consent_version: CONSENT_VERSION } };
    expect(hasConsented(claims)).toBe(false);
  });
});

describe("businessReady: 사업자 정보가 다 있어야 실제 결제를 연다", () => {
  const saved = { ...BUSINESS };
  afterEach(() => Object.assign(BUSINESS, saved));

  it("지금(등록 전)은 닫혀 있다", () => {
    expect(businessReady()).toBe(false);
  });
  it("모두 채우면 열린다", () => {
    for (const k of Object.keys(BUSINESS) as (keyof typeof BUSINESS)[]) BUSINESS[k] = "값";
    expect(businessReady()).toBe(true);
  });
  it("하나라도 비거나 공백이면 닫힌다", () => {
    for (const k of Object.keys(BUSINESS) as (keyof typeof BUSINESS)[]) BUSINESS[k] = "값";
    BUSINESS.phone = "  ";
    expect(businessReady()).toBe(false);
  });
});

describe("summaryState: 정리 배지", () => {
  const summary = { messageCount: 6 } as Parameters<typeof summaryState>[0];
  it("정리 전", () => expect(summaryState(null, 6)).toBe("none"));
  it("정리한 그대로", () => expect(summaryState(summary, 6)).toBe("done"));
  it("정리 후 이어서 얘기함 → 다시 정리", () => expect(summaryState(summary, 8)).toBe("stale"));
});

describe("messageImages: 예전 한 장짜리 기록도 읽는다", () => {
  const img = { path: "a.png", mediaType: "image/png" } as NonNullable<ChatMessage["image"]>;
  it("images 배열", () => expect(messageImages({ images: [img, img] } as ChatMessage)).toHaveLength(2));
  it("예전 image 필드", () => expect(messageImages({ image: img } as ChatMessage)).toEqual([img]));
  it("사진 없음", () => expect(messageImages({} as ChatMessage)).toEqual([]));
});
