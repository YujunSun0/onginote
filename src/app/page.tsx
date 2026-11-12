"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { CharacterAvatar, CharacterFace } from "@/components/CharacterFace";
import { PlusIcon } from "@/components/Icons";
import { CHARACTERS } from "@/lib/characters";
import { birthdayLabel, daysUntilBirthday, josa, relativeTime, todayLabel } from "@/lib/format";
import { SummaryBadge } from "@/components/SummaryBadge";
import type { CharacterId, FollowUp, Person, SummaryState } from "@/lib/types";

interface SessionRow {
  id: string;
  characterId: CharacterId;
  personId: string | null;
  createdAt: string;
  lastAt: string;
  title?: string;
  summaryState?: SummaryState;
  followUp?: FollowUp;
  todos?: { text: string; done: boolean }[];
}

/** 홈 카드 제목 */
function CardTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <h2 className="font-display text-lg">{children}</h2>
      {action}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [persons, setPersons] = useState<Person[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [now, setNow] = useState<number | null>(null);
  const [usage, setUsage] = useState<number | null>(null); // 오늘 사용량 %
  const [nickname, setNickname] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/persons").then((r) => r.json()).then(setPersons);
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((rows: SessionRow[]) => {
        setSessions(rows);
        setNow(Date.now());
      });
    fetch("/api/usage")
      .then((r) => r.json())
      .then((u: { percent: number }) => setUsage(u.percent))
      .catch(() => {});
    fetch("/api/me")
      .then((r) => r.json())
      .then((m: { nickname?: string | null }) => setNickname(m.nickname || null))
      .catch(() => {});
  }, []);
  const today = now ? todayLabel(now) : "";

  const followUps = sessions
    .filter((s) => s.followUp && !s.followUp.dismissed && !s.followUp.muted)
    .sort((a, b) => a.followUp!.dueAt.localeCompare(b.followUp!.dueAt));

  const recent = [...sessions].sort((a, b) => b.lastAt.localeCompare(a.lastAt)).slice(0, 3); // 상담 목록과 같은 기준: 마지막 대화 순
  const personName = (id: string | null) => persons.find((p) => p.id === id)?.name;

  // 정리 카드의 "할 것"을 최근 상담부터 모은다. 안 한 것 먼저, 끝낸 것은 최근 두 개만.
  const allTodos = [...sessions]
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt))
    .flatMap((s) => (s.todos ?? []).map((t, index) => ({ ...t, index, session: s })));
  const todos = [...allTodos.filter((t) => !t.done).slice(0, 5), ...allTodos.filter((t) => t.done).slice(0, 2)];

  // 다가오는 생일
  const upcoming = persons
    .map((p) => ({ person: p, days: daysUntilBirthday(p.birthday) }))
    .filter((x): x is { person: Person; days: number } => x.days !== null)
    .sort((a, b) => a.days - b.days)
    .slice(0, 4);

  async function openFollowUp(s: SessionRow) {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId: s.characterId, personId: s.personId, fromFollowUpOf: s.id }),
    });
    const created = await res.json();
    router.push(`/chat/${created.id}`);
  }

  async function toggleTodo(sessionId: string, index: number, done: boolean) {
    setSessions((rows) =>
      rows.map((s) => (s.id === sessionId ? { ...s, todos: s.todos?.map((t, i) => (i === index ? { ...t, done } : t)) } : s)),
    );
    await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ todo: { index, done } }),
    });
  }

  return (
    <main className="pb-28 lg:mx-auto lg:max-w-6xl lg:px-10 lg:pb-12 lg:pt-9">
      {/* 모바일은 한 줄로 쌓이고, PC는 두 칸씩 (왼쪽이 넓게) */}
      <div className="lg:flex lg:items-stretch lg:gap-5">
        <section className="rounded-b-[36px] bg-peach px-5 pb-6 pt-6 lg:flex-[3] lg:rounded-[32px] lg:p-8">
          <div className="flex items-center justify-between">
            <span className="font-display text-2xl text-accent-text">온기노트</span>
            {usage !== null && (
              <span className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-xs text-ink-soft lg:hidden" title="하루 대화량 중 오늘 쓴 비율">
                오늘 사용량
                <span className="h-1.5 w-12 overflow-hidden rounded-full bg-line" aria-hidden>
                  <span className={`block h-full rounded-full ${usage >= 80 ? "bg-accent" : "bg-teal"}`} style={{ width: `${Math.max(usage, 2)}%` }} />
                </span>
                <span className="font-bold tabular-nums">{usage}%</span>
              </span>
            )}
          </div>
          <p className="pt-2 text-sm text-muted">{today}</p>
          <div className="flex items-end gap-3 pt-3 lg:gap-5">
            <CharacterFace id="mongle" size={96} />
            <div className="mb-3 flex-1 rounded-[20px_20px_20px_6px] bg-white px-4 py-3 lg:px-5 lg:py-4">
              <p className="font-display text-xl leading-snug lg:text-2xl">
                {nickname ? `${nickname}, 왔구나!` : "왔구나!"} 오늘은<br />누구 얘기 해볼까?
              </p>
            </div>
          </div>
          <Link
            href="/new"
            className="mt-4 flex h-13 items-center justify-center rounded-full bg-accent text-base font-bold text-white lg:inline-flex lg:px-8"
          >
            이야기 시작하기
          </Link>
        </section>

        {followUps.length > 0 && (
          <section className="px-5 pt-6 lg:flex-[2] lg:px-0 lg:pt-0">
            <CardTitle>먼저 온 메시지</CardTitle>
            <ul className="overflow-hidden rounded-[22px] border border-line bg-white">
              {followUps.map((s) => {
                const c = CHARACTERS[s.characterId];
                const due = now !== null && new Date(s.followUp!.dueAt).getTime() <= now;
                return (
                  <li key={s.id} className="border-b border-line last:border-b-0">
                    <button onClick={() => openFollowUp(s)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-cream">
                      <CharacterAvatar id={c.id} tint={c.tint} />
                      <span className="min-w-0 flex-1">
                        <span className="flex justify-between">
                          <span className="text-[15px] font-bold">{c.name}</span>
                          <span className="text-xs text-muted">
                            {due ? relativeTime(s.followUp!.dueAt) : `${relativeTime(s.followUp!.dueAt)} 도착 · 미리 보기`}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-[13px] leading-snug text-ink-soft">{s.followUp!.message}</span>
                      </span>
                      {due && <span className="h-2 w-2 shrink-0 rounded-full bg-bubble" aria-label="새 메시지" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      <div className="lg:mt-7 lg:flex lg:gap-5">
        <section className="px-5 pt-6 lg:flex-[3] lg:rounded-[28px] lg:border lg:border-line lg:bg-white lg:p-5.5">
          <CardTitle>내 사람들</CardTitle>
          {/* 모바일: 동그라미 한 줄. PC: 관계와 상담 수가 보이는 카드 두 칸 */}
          <div className="flex flex-wrap gap-4 lg:grid lg:grid-cols-2 lg:gap-2.5">
            {persons.map((p) => {
              const d = daysUntilBirthday(p.birthday);
              const count = sessions.filter((s) => s.personId === p.id).length;
              return (
                <Link key={p.id} href={`/people/${p.id}`} className="flex flex-col items-center gap-1.5 lg:flex-row lg:gap-3 lg:rounded-2xl lg:bg-cream lg:p-3 lg:hover:bg-peach">
                  <span className="relative flex h-15 w-15 shrink-0 items-center justify-center rounded-full border-2 border-bubble bg-white font-display text-2xl text-accent-text lg:h-12 lg:w-12 lg:text-xl">
                    {p.name.slice(0, 1)}
                    {d !== null && d <= 30 && (
                      <span className="absolute -bottom-1.5 -right-2.5 rounded-lg bg-accent px-1.5 py-0.5 font-sans text-[10px] font-bold text-white">
                        D-{d}
                      </span>
                    )}
                  </span>
                  <span className="flex min-w-0 flex-col items-center lg:items-start">
                    <span className="text-[13px] font-medium lg:text-[15px] lg:font-bold">{p.name}</span>
                    <span className="hidden truncate text-xs text-muted lg:block">
                      {[p.relation, p.mbti, count > 0 ? `상담 ${count}번` : "아직 상담 전"].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </Link>
              );
            })}
            <Link href="/people/new" className="flex flex-col items-center gap-1.5 text-muted lg:flex-row lg:gap-3 lg:rounded-2xl lg:border lg:border-dashed lg:border-line-strong lg:p-3">
              <span className="flex h-15 w-15 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-line-strong lg:h-12 lg:w-12">
                <PlusIcon />
              </span>
              <span className="text-[13px] lg:text-sm">추가</span>
            </Link>
          </div>
        </section>

        {recent.length > 0 && (
          <section className="px-5 pt-6 lg:flex-[2] lg:px-0 lg:pt-0">
            <CardTitle
              action={
                sessions.length > recent.length && (
                  <Link href="/chats" className="px-1 py-1 text-[13px] text-muted">
                    전체 {sessions.length}개 보기 ›
                  </Link>
                )
              }
            >
              최근 상담
            </CardTitle>
            <ul className="flex flex-col gap-2">
              {recent.map((s) => {
                const c = CHARACTERS[s.characterId];
                return (
                  <li key={s.id}>
                    <Link href={`/chat/${s.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 hover:border-line-strong">
                      <CharacterAvatar id={c.id} tint={c.tint} size={40} />
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="block truncate font-medium">{s.title ?? `${josa(c.name, "과", "와")}의 상담`}</span>
                        <span className="block text-xs text-muted">
                          {personName(s.personId) ? `${personName(s.personId)} 이야기 · ` : ""}
                          {relativeTime(s.lastAt)}
                        </span>
                      </span>
                      <SummaryBadge state={s.summaryState} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      {/* 상담에서 정한 할 일 + 다가오는 날. 내용이 없으면 모바일에서는 숨기고, PC에서는 안내로 자리를 채운다. */}
      <div className="lg:mt-7 lg:flex lg:gap-5">
        <section className={`px-5 pt-6 lg:block lg:flex-[3] lg:px-0 lg:pt-0 ${todos.length ? "" : "hidden"}`}>
          <CardTitle action={<span className="text-xs text-muted">정리 카드의 할 것에서 모아요</span>}>상담에서 정한 할 일</CardTitle>
          {todos.length === 0 ? (
            <p className="rounded-[22px] border border-dashed border-line-strong bg-white/60 px-5 py-6 text-sm text-muted">
              상담을 정리하면 그때 정한 할 일이 여기 모여요.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {todos.map((t) => {
                const c = CHARACTERS[t.session.characterId];
                const who = personName(t.session.personId) ?? "내 이야기";
                return (
                  <li key={`${t.session.id}-${t.index}`}>
                    <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 ${t.done ? "border-transparent bg-transparent" : "border-line bg-white"}`}>
                      <input
                        type="checkbox"
                        checked={t.done}
                        onChange={(e) => toggleTodo(t.session.id, t.index, e.target.checked)}
                        className="mt-0.5 h-5 w-5 shrink-0 accent-accent"
                      />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm leading-normal ${t.done ? "text-muted line-through" : ""}`}>{t.text}</span>
                        <span className="block truncate text-xs text-muted">
                          {who} · {t.session.title ?? `${josa(c.name, "과", "와")}의 상담`} · {c.name}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={`px-5 pt-6 lg:block lg:flex-[2] lg:px-0 lg:pt-0 ${upcoming.length ? "" : "hidden"}`}>
          <CardTitle>다가오는 날</CardTitle>
          {upcoming.length === 0 ? (
            <p className="rounded-[22px] bg-teal-bg px-5 py-6 text-sm text-teal">
              사람마다 생일을 기록해 두면 여기서 D-day를 알려줘요.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 rounded-[22px] bg-teal-bg p-2.5">
              {upcoming.map(({ person, days }) => (
                <li key={person.id}>
                  <Link href={`/people/${person.id}`} className="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-3">
                    <span className={`w-14 shrink-0 text-center font-display text-xl ${days <= 14 ? "text-accent-text" : "text-teal"}`}>
                      {days === 0 ? "오늘" : `D-${days}`}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">{person.name} 생일</span>
                      <span className="block truncate text-xs text-muted">
                        {[birthdayLabel(person.birthday), person.likes.length ? `좋아하는 것: ${person.likes.slice(0, 2).join(", ")}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <BottomNav />
    </main>
  );
}
