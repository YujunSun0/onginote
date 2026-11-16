import { describe, expect, it } from "vitest";
import { bucketOf, canRefresh, computeStats, countTopics, progressOf, wantOf, type StatMessage, type StatSession } from "@/lib/recap";
import { RECAP_MIN_DAYS, RECAP_MIN_SESSIONS, recapOk } from "@/lib/recap-types";

// 한국 시간 → ISO
const kst = (s: string) => new Date(`${s}+09:00`).toISOString();
const summary = (todo: string[], done: boolean[]) => ({ title: "t", situation: "s", interpretation: "i", todo, todoDone: done, dont: [], suggestions: [], applied: false });

const sessions: StatSession[] = [
  { id: "s1", characterId: "mongle", personId: "p1", summary: summary(["a", "b"], [true, false]) },
  { id: "s2", characterId: "mongle", personId: "p1", summary: null },
  { id: "s3", characterId: "yeoul", personId: "p2", summary: summary(["c"], [true]) },
  { id: "s4", characterId: "olly", personId: null, summary: null }, // 내가 말한 적 없음 → 빠짐
  { id: "s5", characterId: "olly", personId: null, summary: null }, // 1월 메시지만 → 빠짐
];
const messages: StatMessage[] = [
  { sessionId: "s1", role: "user", mode: null, createdAt: kst("2026-11-20T23:30:00") },
  { sessionId: "s1", role: "assistant", mode: "listen", createdAt: kst("2026-11-20T23:31:00") },
  { sessionId: "s1", role: "user", mode: null, createdAt: kst("2026-11-21T01:10:00") },
  { sessionId: "s1", role: "assistant", mode: "interpret", createdAt: kst("2026-11-21T01:11:00") },
  { sessionId: "s2", role: "user", mode: null, createdAt: kst("2026-11-21T02:00:00") },
  { sessionId: "s2", role: "assistant", mode: "plan", createdAt: kst("2026-11-21T02:01:00") },
  { sessionId: "s3", role: "user", mode: null, createdAt: kst("2026-12-01T14:00:00") },
  { sessionId: "s3", role: "assistant", mode: "react", createdAt: kst("2026-12-01T14:01:00") },
  { sessionId: "s4", role: "assistant", mode: "chat", createdAt: kst("2026-12-02T10:00:00") },
  { sessionId: "s5", role: "user", mode: null, createdAt: kst("2027-01-02T10:00:00") },
];
const relations = new Map([
  ["p1", "썸"],
  ["p2", "친구"],
]);

describe("computeStats", () => {
  const s = computeStats(sessions, messages, relations)!;
  it("내가 말한 상담만, 12/31 까지만 센다", () => {
    expect(s.sessions).toBe(3);
    expect(s.activeDays).toBe(3); // 11/20, 11/21, 12/1 (한국 날짜)
    expect(s.firstDay).toBe("2026-11-20");
    expect(s.summarized).toBe(2);
  });
  it("가장 많이 이야기한 사람과 캐릭터", () => {
    expect(s.topPerson).toEqual({ personId: "p1", relation: "썸", sessions: 2 });
    expect(s.people).toBe(2);
    expect(s.character).toEqual({ id: "mongle", sessions: 2 });
  });
  it("고민하는 시간대 (한국 시간)", () => {
    expect(s.hours).toEqual({ dawn: 2, morning: 0, afternoon: 1, evening: 0, night: 1 });
    expect(s.topBucket).toBe("dawn");
  });
  it("원했던 것: 들어줘(listen·react·chat), 생각(explore·interpret), 계획(offer_plan·plan)", () => {
    expect(s.wants).toEqual({ listen: 2, think: 1, plan: 1 });
  });
  it("할 일과 가장 길게 이야기한 날", () => {
    expect(s.todos).toEqual({ total: 3, done: 2 });
    expect(s.longestDay).toEqual({ day: "2026-11-21", messages: 2 });
  });
  it("내가 말한 상담이 없으면 null", () => {
    expect(computeStats(sessions, [], relations)).toBeNull();
  });
});

describe("열리는 조건", () => {
  it(`상담 ${RECAP_MIN_SESSIONS}개, 대화한 날 ${RECAP_MIN_DAYS}일`, () => {
    expect(recapOk(5, 3)).toBe(true);
    expect(recapOk(4, 3)).toBe(false);
    expect(recapOk(9, 2)).toBe(false);
  });
  it("12/31 이후 메시지는 진행도에 안 셈", () => {
    const p = progressOf([
      { sessionId: "a", createdAt: kst("2026-12-30T10:00:00") },
      { sessionId: "a", createdAt: kst("2026-12-31T23:59:00") },
      { sessionId: "b", createdAt: kst("2027-01-01T00:00:00") },
    ]);
    expect(p).toEqual({ sessions: 1, days: 2, ok: false });
  });
  it("다시 만들기: 12/31 전, 상담 3개 더 쌓였을 때만", () => {
    const before = Date.parse(kst("2026-12-20T00:00:00"));
    const after = Date.parse(kst("2027-01-05T00:00:00"));
    expect(canRefresh({ source_count: 5 }, { sessions: 8, days: 4, ok: true }, before)).toBe(true);
    expect(canRefresh({ source_count: 5 }, { sessions: 7, days: 4, ok: true }, before)).toBe(false);
    expect(canRefresh({ source_count: 5 }, { sessions: 9, days: 4, ok: true }, after)).toBe(false);
    expect(canRefresh(null, { sessions: 9, days: 4, ok: true }, before)).toBe(false);
  });
});

describe("작은 계산", () => {
  it("시간대 경계", () => {
    expect([0, 5, 6, 11, 12, 17, 18, 21, 22, 23].map(bucketOf)).toEqual([
      "dawn",
      "dawn",
      "morning",
      "morning",
      "afternoon",
      "afternoon",
      "evening",
      "evening",
      "night",
      "night",
    ]);
  });
  it("모드 묶기", () => {
    expect(wantOf("offer_plan")).toBe("plan");
    expect(wantOf("explore")).toBe("think");
    expect(wantOf(null)).toBeNull();
  });
  it("고민 주제: 상담마다 한 번, 많은 순 3개", () => {
    const t = countTopics(
      [
        { session: 1, topic: "답장 고민" },
        { session: 2, topic: "답장 고민" },
        { session: 2, topic: "중복" },
        { session: 3, topic: "서운함" },
        { session: 4, topic: "고백" },
        { session: 5, topic: "서운함" },
        { session: 6, topic: "데이트" },
        { session: 99, topic: "없는 상담" },
      ],
      6,
    );
    expect(t).toEqual([
      { name: "답장 고민", count: 2 },
      { name: "서운함", count: 2 },
      { name: "고백", count: 1 },
    ]);
  });
});
