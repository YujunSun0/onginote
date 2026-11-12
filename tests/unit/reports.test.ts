import { describe, expect, it } from "vitest";
import { LOVE_TYPES, REPORT_UNLOCK_SESSIONS, TYPE_IDS, isFullReport, type PersonalityReport } from "@/lib/report-types";
import { reportProgress, toView, type ReportRow } from "@/lib/reports";

const content: PersonalityReport = {
  type: "checker",
  headline: "답장 하나에도 마음을 다 쓰는 사람",
  keywords: ["섬세함", "확인", "배려"],
  emotions: [{ name: "불안", desc: "답이 늦으면 불안해져요", evidence: "3번 중 2번에서 '내가 너무 매달리나'라고 했어요" }],
  values: [{ title: "꾸준한 연락", desc: "비밀 값", evidence: "비밀 근거" }],
  patterns: [{ situation: "답장이 늦을 때", reaction: "비밀 반응", evidence: "비밀" }],
  strengths: [{ title: "비밀 강점", desc: "비밀" }],
  stumbles: [{ title: "비밀 지점", desc: "비밀", tryThis: "비밀 행동" }],
  characterNote: "비밀 한마디",
};
const row = (over: Partial<ReportRow> = {}): ReportRow => ({
  id: "r1",
  content,
  source_count: 3,
  paid_at: null,
  order_id: null,
  created_at: "2026-11-12T00:00:00Z",
  ...over,
});

describe("toView: 결제 전에는 미리보기만", () => {
  it("결제 전: 유형·한 줄·키워드·감정만 내보내고 나머지는 응답에 아예 없다", () => {
    const v = toView(row(), "mongle");
    expect(v.paid).toBe(false);
    expect(isFullReport(v.content)).toBe(false);
    expect(Object.keys(v.content).sort()).toEqual(["emotions", "headline", "keywords", "type"]);
    expect(JSON.stringify(v)).not.toContain("비밀");
  });

  it("결제 후: 전체", () => {
    const v = toView(row({ paid_at: "2026-11-12T01:00:00Z", order_id: "P-1" }), "yeoul");
    expect(v.paid).toBe(true);
    expect(isFullReport(v.content)).toBe(true);
    expect(v.orderId).toBe("P-1");
    expect(v.characterId).toBe("yeoul");
  });
});

describe("reportProgress: 정리한 상담 수로 해금", () => {
  it("처음에는 정리한 상담 N개가 필요하다", () => {
    expect(reportProgress(0, null)).toEqual({ canCreate: false, remaining: REPORT_UNLOCK_SESSIONS, summarized: 0 });
    expect(reportProgress(REPORT_UNLOCK_SESSIONS - 1, null).remaining).toBe(1);
    expect(reportProgress(REPORT_UNLOCK_SESSIONS, null).canCreate).toBe(true);
  });

  it("리포트를 만든 뒤에는 그때보다 N개 더 쌓여야 새로 만든다", () => {
    expect(reportProgress(4, 3)).toMatchObject({ canCreate: false, remaining: REPORT_UNLOCK_SESSIONS - 1 });
    expect(reportProgress(3 + REPORT_UNLOCK_SESSIONS, 3).canCreate).toBe(true);
  });

  it("상담을 지워서 수가 줄어도 남은 수는 음수가 되지 않는다", () => {
    expect(reportProgress(1, 5)).toMatchObject({ canCreate: false, remaining: REPORT_UNLOCK_SESSIONS + 4 });
  });
});

describe("유형 8개", () => {
  it("이름·색·설명이 모두 있다", () => {
    expect(TYPE_IDS).toHaveLength(8);
    for (const id of TYPE_IDS) {
      expect(LOVE_TYPES[id].name).toMatch(/형$/);
      expect(LOVE_TYPES[id].color).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
});
