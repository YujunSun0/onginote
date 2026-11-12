import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { birthdayLabel, daysUntilBirthday, josa, relativeTime, splitBubbles } from "@/lib/format";

describe("josa: 이름 뒤 조사", () => {
  it("받침 있으면 앞의 것", () => {
    expect(josa("몽글", "이", "가")).toBe("몽글이");
    expect(josa("다온", "과", "와")).toBe("다온과");
  });
  it("받침 없으면 뒤의 것", () => {
    expect(josa("올리", "이", "가")).toBe("올리가");
    expect(josa("여울", "은", "는")).toBe("여울은");
    expect(josa("하린", "을", "를")).toBe("하린을");
    expect(josa("준호", "을", "를")).toBe("준호를");
  });
  it("한글이 아닌 이름은 받침 없는 쪽", () => {
    expect(josa("Kim", "이", "가")).toBe("Kim가");
  });
});

describe("생일", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 12, 15, 0)); // 2026-11-12 (기기 시간대 기준)
  });
  afterEach(() => vi.useRealTimers());

  it("남은 날", () => {
    expect(daysUntilBirthday("11-20")).toBe(8);
  });
  it("오늘이면 0", () => {
    expect(daysUntilBirthday("11-12")).toBe(0);
  });
  it("올해 지났으면 내년까지", () => {
    expect(daysUntilBirthday("11-11")).toBe(364);
  });
  it("형식이 틀리면 null", () => {
    expect(daysUntilBirthday("1120")).toBeNull();
    expect(daysUntilBirthday(undefined)).toBeNull();
    expect(birthdayLabel("abc")).toBeNull();
  });
  it("표시", () => {
    expect(birthdayLabel("03-05")).toBe("3월 5일");
  });
});

describe("relativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-12T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
  it.each([
    [10e3, "방금"],
    [5 * 60e3, "5분 전"],
    [3 * 3600e3, "3시간 전"],
    [2 * 86400e3, "2일 전"],
    [-3 * 86400e3, "3일 뒤"],
  ])("%i ms 전 → %s", (ms, label) => {
    expect(relativeTime(ago(ms))).toBe(label);
  });
});

describe("splitBubbles: 답변을 말풍선으로", () => {
  it("--- 한 줄로 나눈다", () => {
    expect(splitBubbles("첫 번째\n---\n두 번째\n  ----  \n세 번째")).toEqual(["첫 번째", "두 번째", "세 번째"]);
  });
  it("문장 안의 ---는 나누지 않는다", () => {
    expect(splitBubbles("A --- B")).toEqual(["A --- B"]);
  });
  it("빈 말풍선은 버린다", () => {
    expect(splitBubbles("---\n안녕\n---\n\n---")).toEqual(["안녕"]);
  });
});
