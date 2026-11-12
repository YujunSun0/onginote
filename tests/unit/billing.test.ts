import { describe, expect, it } from "vitest";
import { addMonth, cardLabel, renewalOrderId } from "@/lib/billing";

/** 한국 시간 "YYYY-MM-DD HH:mm" → Date */
const kst = (s: string) => new Date(`${s.replace(" ", "T")}:00+09:00`);
/** Date → 한국 날짜 "YYYY-MM-DD" */
const kstDay = (d: Date) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);

describe("addMonth: 다음 결제일", () => {
  it("한 달 뒤 같은 날", () => {
    expect(kstDay(addMonth(kst("2026-03-15 10:00")))).toBe("2026-04-15");
  });

  it("31일 → 다음 달에 그날이 없으면 말일", () => {
    expect(kstDay(addMonth(kst("2027-01-31 10:00")))).toBe("2027-02-28");
    expect(kstDay(addMonth(kst("2026-05-31 10:00")))).toBe("2026-06-30");
  });

  it("윤년 2월은 29일", () => {
    expect(kstDay(addMonth(kst("2028-01-31 10:00")))).toBe("2028-02-29");
  });

  it("12월 → 다음 해 1월", () => {
    expect(kstDay(addMonth(kst("2026-12-20 10:00")))).toBe("2027-01-20");
  });

  it("서버가 UTC 여도 한국 날짜 기준 (한국 12월 1일 새벽 = UTC 11월 30일)", () => {
    const d = kst("2026-12-01 00:30");
    expect(d.toISOString().slice(0, 10)).toBe("2026-11-30");
    expect(kstDay(addMonth(d))).toBe("2027-01-01");
  });

  it("시각은 그대로 유지", () => {
    const next = addMonth(kst("2026-03-15 23:59"));
    expect(next.getTime() - kst("2026-04-15 23:59").getTime()).toBe(0);
  });
});

describe("renewalOrderId: 갱신 결제 주문번호 (중복 결제 방지 잠금)", () => {
  const user = "0d3f9c2a-1b2c-4d5e-8f90-123456789abc";
  const period = kst("2026-12-01 00:30");

  it("같은 기간·같은 시도는 늘 같은 번호", () => {
    expect(renewalOrderId(user, period, 0)).toBe(renewalOrderId(user, new Date(period), 0));
  });

  it("한국 날짜와 시도 횟수가 들어간다", () => {
    expect(renewalOrderId(user, period, 2)).toBe("R-0d3f9c2a1b2c-20261201-2");
  });

  it("재시도마다, 기간마다 번호가 달라진다", () => {
    const ids = new Set([
      renewalOrderId(user, period, 0),
      renewalOrderId(user, period, 1),
      renewalOrderId(user, addMonth(period), 0),
    ]);
    expect(ids.size).toBe(3);
  });

  it("토스 주문번호 규칙 (영문·숫자·-_, 6~64자)", () => {
    const id = renewalOrderId(user, period, 3);
    expect(id).toMatch(/^[A-Za-z0-9_-]{6,64}$/);
  });
});

describe("cardLabel: 화면에 보여 줄 카드 이름", () => {
  it("카드사 + 앞 4자리", () => {
    expect(cardLabel({ issuerCode: "31", number: "9410-12**-****-***1" })).toBe("BC카드 9410-****");
  });
  it("모르는 카드사는 '카드'", () => {
    expect(cardLabel({ issuerCode: "ZZ", number: "5555-55**-****-***5" })).toBe("카드 5555-****");
  });
  it("번호가 없으면 이름만", () => {
    expect(cardLabel({ issuerCode: "51" })).toBe("삼성카드");
  });
  it("카드 정보가 없으면 null", () => {
    expect(cardLabel(undefined)).toBeNull();
  });
});
