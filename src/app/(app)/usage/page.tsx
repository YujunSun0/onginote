"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { BackIcon } from "@/components/Icons";
import type { UsageDay, UsageHistory } from "@/lib/usage-history";

/** /api/usage 응답 중 화면에 쓰는 것 */
interface Status {
  plan: "free" | "plus";
  plusUntil: string | null;
  plusStatus: "active" | "canceled" | "past_due" | null;
  periodCapped: boolean;
  percent: number;
  searchesLeft: number;
  sessionsLeftToday: number | null;
  sessionsLeftMonth: number | null;
  monthlySessions: number | null;
}

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function dayLabel(day: string, withWeekday = true) {
  const d = new Date(`${day}T00:00:00Z`);
  const base = `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
  return withWeekday ? `${base} (${WEEKDAY[d.getUTCDay()]})` : base;
}
function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${y}년 ${m}월`;
}
function dateLabel(iso: string | null) {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 9 * 3600e3);
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
}
const barColor = (p: number) => (p >= 100 ? "bg-accent" : "bg-teal");

export default function UsagePage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [history, setHistory] = useState<UsageHistory | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetch("/api/usage", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setStatus)
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(`/api/usage/history${month ? `?month=${month}` : ""}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((h: UsageHistory) => alive && setHistory(h))
      .catch(() => alive && setLoadError(true));
    return () => {
      alive = false;
    };
  }, [month]);

  return (
    <main className="px-5 pb-28 pt-4 lg:mx-auto lg:max-w-3xl lg:px-10 lg:pb-12 lg:pt-7">
      <div className="flex items-center gap-1">
        <Link href="/me" aria-label="마이페이지로" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-peach">
          <BackIcon size={22} />
        </Link>
        <h1 className="font-display text-[22px]">사용량</h1>
      </div>

      {loadError && <p className="mt-6 text-sm text-danger">사용량을 불러오지 못했어요. 새로고침해 주세요.</p>}
      {!status && !loadError && <p className="mt-6 text-sm text-muted">불러오는 중…</p>}

      {status && (
        <div className="mt-4 flex flex-col gap-4">
          <Today status={status} />
          {history ? (
            <Monthly history={history} onMonth={setMonth} />
          ) : (
            !loadError && <p className="text-sm text-muted">날짜별 사용량을 불러오는 중…</p>
          )}
          <PlanNote status={status} />
        </div>
      )}
      <BottomNav />
    </main>
  );
}

function Today({ status }: { status: Status }) {
  const p = status.percent;
  const sessions =
    status.sessionsLeftToday === null
      ? "제한 없음"
      : status.sessionsLeftMonth !== null && status.sessionsLeftMonth < status.sessionsLeftToday
        ? `${status.sessionsLeftMonth}개`
        : `${status.sessionsLeftToday}개`;
  const items: [string, string, string?][] = [
    ["오늘 시작할 수 있는 상담", status.plan === "plus" ? "제한 없음" : sessions],
    ...(status.monthlySessions !== null && status.sessionsLeftMonth !== null
      ? ([["이번 달 상담", `${status.monthlySessions - status.sessionsLeftMonth}/${status.monthlySessions}개`]] as [string, string][])
      : []),
    ["오늘 남은 검색해서 답하기", `${status.searchesLeft}번`],
  ];
  return (
    <section className="rounded-3xl border border-line bg-white p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg">오늘</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.plan === "plus" ? "bg-accent text-white" : "bg-cream text-ink-soft"}`}>
          {status.plan === "plus" ? "온기 패스" : "무료"}
        </span>
      </div>
      <p className="pt-2 font-display text-[40px] leading-none tabular-nums">
        {p}
        <span className="pl-0.5 text-xl text-ink-soft">%</span>
      </p>
      <span className="mt-3 block h-2.5 overflow-hidden rounded-full bg-line" role="meter" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label="오늘 사용량">
        <span className={`block h-full rounded-full ${p >= 80 ? "bg-accent" : "bg-teal"}`} style={{ width: `${Math.max(p, 2)}%` }} />
      </span>
      <p className="pt-2 text-xs text-muted">
        {p >= 100 ? "오늘 나눌 수 있는 대화량을 다 썼어요. " : "하루에 나눌 수 있는 대화량 중 오늘 쓴 만큼이에요. "}
        한국 시간 자정에 다시 채워져요.
      </p>
      <dl className="mt-4 divide-y divide-line border-t border-line text-sm">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between py-2.5">
            <dt className="text-ink-soft">{label}</dt>
            <dd className="font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Monthly({ history, onMonth }: { history: UsageHistory; onMonth: (m: string) => void }) {
  const { days, summary, today } = history;
  const isCurrent = history.month === today.slice(0, 7);
  const defaultDay = isCurrent ? today : (summary.peak?.day ?? days[0].day);
  const [selected, setSelected] = useState(defaultDay);
  const [hover, setHover] = useState<string | null>(null);
  // 달을 바꾸면 고른 날도 그 달의 기본값으로
  const [shownMonth, setShownMonth] = useState(history.month);
  if (shownMonth !== history.month) {
    setShownMonth(history.month);
    setSelected(defaultDay);
    setHover(null);
  }
  const focus = days.find((d) => d.day === (hover ?? selected)) ?? days[0];

  const tiles: [string, string, string?][] = [
    ["대화한 날", `${summary.activeDays}일`],
    ["시작한 상담", `${summary.sessionsStarted}개`],
    ["하루 평균", `${summary.averagePercent}%`, "대화한 날 기준"],
    ["가장 많이 쓴 날", summary.peak ? dayLabel(summary.peak.day, false) : "-", summary.peak ? `${summary.peak.percent}%` : undefined],
  ];

  return (
    <section className="rounded-3xl border border-line bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg">날짜별 사용량</h2>
        <div className="flex items-center">
          <MonthButton label="이전 달" target={history.prevMonth} onMonth={onMonth}>
            ‹
          </MonthButton>
          <span className="min-w-[88px] text-center text-sm font-bold tabular-nums">{monthLabel(history.month)}</span>
          <MonthButton label="다음 달" target={history.nextMonth} onMonth={onMonth}>
            ›
          </MonthButton>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map(([label, value, sub]) => (
          <div key={label} className="rounded-2xl bg-cream px-3 py-2.5">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="pt-0.5 font-bold tabular-nums">
              {value}
              {sub && <span className="pl-1 text-xs font-normal text-muted">{sub}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <Chart days={days} today={today} active={focus.day} onHover={setHover} onSelect={setSelected} />

      <DayDetail day={focus} today={today} />

      <p className="pt-3 text-[11px] leading-relaxed text-muted">
        막대 하나가 하루예요. 그날 쓸 수 있던 대화량 중 쓴 만큼을 보여줘요. 다 쓴 날은 주황색이에요. 리포트 만들기는 대화량에 들어가지 않아요.
      </p>

      {summary.activeDays > 0 && (
        <details className="mt-3 rounded-2xl border border-line">
          <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-ink-soft">날짜별 숫자로 보기</summary>
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="border-t border-line text-xs text-muted">
                <th className="px-4 py-2 text-left font-normal">날짜</th>
                <th className="px-2 py-2 text-right font-normal">사용량</th>
                <th className="px-2 py-2 text-right font-normal">답변</th>
                <th className="px-4 py-2 text-right font-normal">새 상담</th>
              </tr>
            </thead>
            <tbody>
              {days
                .filter((d) => d.plan !== null)
                .map((d) => (
                  <tr key={d.day} className="border-t border-line">
                    <td className="px-4 py-2">{dayLabel(d.day)}</td>
                    <td className="px-2 py-2 text-right font-bold">{d.percent}%</td>
                    <td className="px-2 py-2 text-right">{d.answers}</td>
                    <td className="px-4 py-2 text-right">{d.sessionsStarted}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}

function MonthButton({ label, target, onMonth, children }: { label: string; target: string | null; onMonth: (m: string) => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={!target}
      onClick={() => target && onMonth(target)}
      className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-ink-soft hover:bg-cream disabled:text-line-strong disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

/** 하루 사용량 막대 (0~100%). 막대를 누르거나 올리면 아래에 그날 숫자가 나온다 */
function Chart({
  days,
  today,
  active,
  onHover,
  onSelect,
}: {
  days: UsageDay[];
  today: string;
  active: string;
  onHover: (d: string | null) => void;
  onSelect: (d: string) => void;
}) {
  // 1, 5, 10, … 일. "오늘" 글자와 겹치지 않게 오늘 바로 옆 눈금은 숨긴다
  const todayIndex = days.findIndex((d) => d.day === today);
  const tick = (i: number) => (i === 0 || (i + 1) % 5 === 0) && (todayIndex < 0 || Math.abs(i - todayIndex) > 1);
  return (
    <div className="mt-5 grid grid-cols-[30px_1fr] gap-x-1.5">
      {/* 세로축: 0 / 50 / 100% */}
      <div className="relative h-40 text-right text-[10px] text-muted tabular-nums" aria-hidden>
        <span className="absolute right-0 top-0 -translate-y-1/2">100%</span>
        <span className="absolute right-0 top-1/2 -translate-y-1/2">50%</span>
        <span className="absolute bottom-0 right-0 translate-y-1/2">0</span>
      </div>
      <div className="relative h-40" onPointerLeave={() => onHover(null)}>
        <span className="absolute inset-x-0 top-0 border-t border-line" aria-hidden />
        <span className="absolute inset-x-0 top-1/2 border-t border-line" aria-hidden />
        <span className="absolute inset-x-0 bottom-0 border-t border-line-strong" aria-hidden />
        <div className="relative grid h-full gap-[2px]" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((d) => {
            const on = d.day === active;
            return (
              <button
                key={d.day}
                type="button"
                disabled={d.future}
                aria-label={`${dayLabel(d.day)} ${d.plan ? `${d.percent}%` : "대화 없음"}`}
                aria-pressed={on}
                onPointerEnter={(e) => e.pointerType === "mouse" && onHover(d.day)}
                onFocus={() => onHover(d.day)}
                onBlur={() => onHover(null)}
                onClick={() => onSelect(d.day)}
                className={`group relative flex h-full items-end justify-center rounded-t-md outline-offset-0 ${on ? "bg-cream" : ""} disabled:cursor-default`}
              >
                {d.plan !== null && (
                  <span
                    className={`block w-full max-w-6 rounded-t-[4px] ${barColor(d.percent)} ${on ? "" : "opacity-85 group-hover:opacity-100"}`}
                    style={{ height: `${Math.max(d.percent, 1.5)}%` }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
      {/* 가로축: 1, 5, 10, … 일과 오늘 */}
      <div />
      <div className="grid gap-[2px] pt-1.5 text-[10px] text-muted tabular-nums" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }} aria-hidden>
        {days.map((d, i) => (
          <span key={d.day} className={`whitespace-nowrap text-center ${d.day === today ? "font-bold text-accent-text" : ""}`}>
            {d.day === today ? "오늘" : tick(i) ? i + 1 : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function DayDetail({ day, today }: { day: UsageDay; today: string }) {
  const title = day.day === today ? `오늘 · ${dayLabel(day.day)}` : dayLabel(day.day);
  return (
    <div className="mt-4 rounded-2xl bg-cream px-4 py-3" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-bold">{title}</p>
        {day.plan !== null && (
          <p className="font-display text-xl tabular-nums">
            {day.percent}%{day.percent >= 100 && <span className="pl-1.5 align-middle text-xs font-bold text-accent-text">다 씀</span>}
          </p>
        )}
      </div>
      {day.future ? (
        <p className="pt-1 text-sm text-muted">아직 오지 않은 날이에요.</p>
      ) : day.plan === null ? (
        <p className="pt-1 text-sm text-muted">이날은 대화하지 않았어요.</p>
      ) : (
        <p className="pt-1 text-sm text-ink-soft">
          답변 {day.answers}개 · 새 상담 {day.sessionsStarted}개 · 검색해서 답하기 {day.searchedAnswers}번
          {day.plan === "plus" && <span className="pl-1.5 text-xs font-bold text-accent-text">온기 패스</span>}
        </p>
      )}
    </div>
  );
}

function PlanNote({ status }: { status: Status }) {
  if (status.plan === "plus") {
    const when =
      status.plusStatus === "canceled"
        ? `해지했어요. ${dateLabel(status.plusUntil)}까지 온기 패스로 쓸 수 있어요.`
        : status.plusStatus === "past_due"
          ? "결제가 안 돼서 다시 시도하고 있어요. 결제 수단을 확인해 주세요."
          : `다음 결제일은 ${dateLabel(status.plusUntil)}이에요.`;
    return (
      <section className="rounded-3xl border border-line bg-white p-5">
        <h2 className="font-display text-lg">온기 패스</h2>
        <p className="pt-1 text-sm text-ink-soft">{when}</p>
        {status.periodCapped && (
          <p className="mt-2 rounded-xl bg-cream px-3 py-2 text-xs text-ink-soft">
            이번 달 온기 패스 사용량을 다 써서, 다음 결제일까지는 하루 대화량과 검색이 무료와 같은 수준이에요. 상담 수와 길이는 그대로예요.
          </p>
        )}
        <Link href="/plus" className="mt-3 flex h-11 items-center justify-center rounded-full border border-line-strong bg-white text-sm font-bold">
          구독 관리
        </Link>
      </section>
    );
  }
  return (
    <section className="rounded-3xl bg-peach p-5">
      <h2 className="font-display text-lg">더 이야기하고 싶다면</h2>
      <p className="pt-1 text-sm text-ink-soft">
        온기 패스는 하루 대화량이 더 많고, 상담 수 제한 없이 더 길게 이야기할 수 있어요. 답변은 똑같은 캐릭터가 해요.
      </p>
      <Link href="/plus" className="mt-3 flex h-11 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
        온기 패스 알아보기
      </Link>
    </section>
  );
}
