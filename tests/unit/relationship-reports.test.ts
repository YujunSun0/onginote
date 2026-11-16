import { describe, expect, it } from "vitest";
import { reportProduct } from "@/lib/billing";
import { RELATIONSHIP_REPORT_PRICE_KRW, REPORT_PRICE_KRW } from "@/lib/plans";
import { finalize, relationshipProgress, sourceText, toRelationshipView, topCharacterOf, type RelationshipRow } from "@/lib/relationship-reports";
import { RELATIONSHIP_UNLOCK_SESSIONS, isFullRelationship, type RelationshipReport } from "@/lib/report-types";
import { reportHref } from "@/lib/reports";

const content: RelationshipReport = {
  headline: "서운함을 지나 다시 천천히 가까워지는 중",
  keywords: ["기다림", "솔직함", "회복"],
  weather: [
    { date: "2026-11-01", weather: "sunny", note: "설레는 시작" },
    { date: "2026-11-05", weather: "rainy", note: "약속이 미뤄져 서운" },
  ],
  chapters: [{ title: "비밀 시기", period: "11월 초", desc: "비밀", evidence: "비밀 근거" }],
  recurring: [{ title: "비밀 고민", desc: "비밀", evidence: "비밀" }],
  tried: [{ action: "비밀 행동", after: "비밀" }],
  me: { desc: "비밀", evidence: "비밀", differs: null },
  nextSteps: [{ title: "비밀 다음", desc: "비밀" }],
  characterNote: "비밀 한마디",
};
const row = (over: Partial<RelationshipRow> = {}): RelationshipRow => ({
  id: "r1",
  content,
  source_count: 3,
  paid_at: null,
  order_id: null,
  created_at: "2026-11-16T00:00:00Z",
  ...over,
});

describe("toRelationshipView: 결제 전에는 미리보기만", () => {
  it("결제 전: 한 줄·키워드·마음 날씨만, 나머지는 응답에 없다", () => {
    const v = toRelationshipView(row(), "mongle");
    expect(v.paid).toBe(false);
    expect(isFullRelationship(v.content)).toBe(false);
    expect(Object.keys(v.content).sort()).toEqual(["headline", "keywords", "weather"]);
    expect(JSON.stringify(v)).not.toContain("비밀");
  });
  it("결제 후: 전체", () => {
    const v = toRelationshipView(row({ paid_at: "2026-11-16T01:00:00Z", order_id: "P-1" }), "daon");
    expect(isFullRelationship(v.content)).toBe(true);
    expect(v.characterId).toBe("daon");
    expect(v.orderId).toBe("P-1");
  });
});

describe("finalize: 모델 출력 → 저장 모양", () => {
  const base = {
    headline: "h",
    keywords: ["a", "b", "c", "d"],
    chapters: [],
    recurring: [],
    tried: [1, 2, 3, 4].map((n) => ({ action: `a${n}`, after: "x" })),
    me: { desc: "d", evidence: "e", differs: null },
    nextSteps: [],
    characterNote: "n",
  };
  it("상담 번호에 날짜를 붙이고, 범위 밖·중복은 버린다", () => {
    const out = finalize(
      {
        ...base,
        weather: [
          { session: 2, weather: "rainy", note: "둘" },
          { session: 1, weather: "sunny", note: "하나" },
          { session: 1, weather: "stormy", note: "중복" },
          { session: 9, weather: "cloudy", note: "없는 상담" },
        ],
      },
      ["2026-11-01", "2026-11-05", "2026-11-09"],
    );
    expect(out.weather).toEqual([
      { date: "2026-11-01", weather: "sunny", note: "하나" },
      { date: "2026-11-05", weather: "rainy", note: "둘" },
    ]);
    expect(out.keywords).toHaveLength(3);
    expect(out.tried).toHaveLength(3);
  });
});

describe("진행도와 기타", () => {
  it("그 사람과 정리한 상담 3개면 열리고, 만든 뒤에는 3개 더", () => {
    expect(relationshipProgress(2, null)).toEqual({ canCreate: false, remaining: 1, summarized: 2 });
    expect(relationshipProgress(RELATIONSHIP_UNLOCK_SESSIONS, null).canCreate).toBe(true);
    expect(relationshipProgress(4, 3)).toEqual({ canCreate: false, remaining: 2, summarized: 4 });
    expect(relationshipProgress(6, 3).canCreate).toBe(true);
  });
  it("가장 많이 상담한 캐릭터, 없으면 몽글", () => {
    expect(topCharacterOf(["yeoul", "olly", "yeoul"])).toBe("yeoul");
    expect(topCharacterOf([])).toBe("mongle");
  });
  it("가격은 종류별로 서버가 정한다", () => {
    expect(reportProduct("relationship").amount).toBe(RELATIONSHIP_REPORT_PRICE_KRW);
    expect(reportProduct("personality").amount).toBe(REPORT_PRICE_KRW);
    expect(RELATIONSHIP_REPORT_PRICE_KRW).toBe(3900);
  });
  it("리포트 화면 주소", () => {
    expect(reportHref("relationship", "p1")).toBe("/people/p1/report");
    expect(reportHref("personality", null)).toBe("/report");
  });
  it("프롬프트에 할 일 체크 여부와 평소의 나", () => {
    const text = sourceText(
      { relation: "썸", timeline: [{ date: "2026-11-02", text: "첫 데이트" }] },
      [
        {
          characterId: "mongle",
          date: "2026-11-03",
          summary: { title: "t", situation: "s", interpretation: "i", todo: ["먼저 연락", "기다리기"], todoDone: [true, false], dont: [], suggestions: [], applied: false },
          userMessages: ["답장이 늦어"],
        },
      ],
      null,
    );
    expect(text).toContain("먼저 연락 [했음] / 기다리기 [안 함]");
    expect(text).toContain("첫 데이트");
    expect(text).not.toContain("[평소의 나]");
  });
});
