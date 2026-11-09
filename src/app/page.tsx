"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { CharacterAvatar, CharacterFace } from "@/components/CharacterFace";
import { PlusIcon } from "@/components/Icons";
import { CHARACTERS } from "@/lib/characters";
import { daysUntilBirthday, josa, relativeTime, todayLabel } from "@/lib/format";
import { SummaryBadge } from "@/components/SummaryBadge";
import type { CharacterId, FollowUp, Person, SummaryState } from "@/lib/types";

interface SessionRow {
  id: string;
  characterId: CharacterId;
  personId: string | null;
  createdAt: string;
  title?: string;
  summaryState?: SummaryState;
  followUp?: FollowUp;
}

export default function Home() {
  const router = useRouter();
  const [persons, setPersons] = useState<Person[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [now, setNow] = useState<number | null>(null);
  const [usage, setUsage] = useState<number | null>(null); // 오늘 사용량 %

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
  }, []);
  const today = now ? todayLabel(now) : "";

  const followUps = sessions
    .filter((s) => s.followUp && !s.followUp.dismissed && !s.followUp.muted)
    .sort((a, b) => a.followUp!.dueAt.localeCompare(b.followUp!.dueAt));

  const recent = [...sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);

  async function openFollowUp(s: SessionRow) {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId: s.characterId, personId: s.personId, fromFollowUpOf: s.id }),
    });
    const created = await res.json();
    router.push(`/chat/${created.id}`);
  }

  const personName = (id: string | null) => persons.find((p) => p.id === id)?.name;

  return (
    <main className="pb-28">
      <section className="rounded-b-[36px] bg-peach px-5 pb-6 pt-6">
        <div className="flex items-center justify-between">
          <span className="font-display text-2xl text-accent-text">온기노트</span>
          {usage !== null && (
            <span className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-xs text-ink-soft" title="하루 대화량 중 오늘 쓴 비율">
              오늘 사용량
              <span className="h-1.5 w-12 overflow-hidden rounded-full bg-line" aria-hidden>
                <span className={`block h-full rounded-full ${usage >= 80 ? "bg-accent" : "bg-teal"}`} style={{ width: `${Math.max(usage, 2)}%` }} />
              </span>
              <span className="font-bold tabular-nums">{usage}%</span>
            </span>
          )}
        </div>
        <p className="pt-2 text-sm text-muted">{today}</p>
        <div className="flex items-end gap-3 pt-3">
          <CharacterFace id="mongle" size={96} />
          <div className="mb-3 flex-1 rounded-[20px_20px_20px_6px] bg-white px-4 py-3">
            <p className="font-display text-xl leading-snug">왔구나! 오늘은<br />누구 얘기 해볼까?</p>
          </div>
        </div>
        <Link
          href="/new"
          className="mt-4 flex h-13 items-center justify-center rounded-full bg-accent text-base font-bold text-white"
        >
          이야기 시작하기
        </Link>
      </section>

      {followUps.length > 0 && (
        <section className="px-5 pt-6">
          <h2 className="mb-2.5 font-display text-lg">먼저 온 메시지</h2>
          <ul className="overflow-hidden rounded-[22px] border border-line bg-white">
            {followUps.map((s) => {
              const c = CHARACTERS[s.characterId];
              const due = now !== null && new Date(s.followUp!.dueAt).getTime() <= now;
              return (
                <li key={s.id} className="border-b border-line last:border-b-0">
                  <button
                    onClick={() => openFollowUp(s)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                  >
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

      <section className="px-5 pt-6">
        <h2 className="mb-3 font-display text-lg">내 사람들</h2>
        <div className="flex flex-wrap gap-4">
          {persons.map((p) => {
            const d = daysUntilBirthday(p.birthday);
            return (
              <Link key={p.id} href={`/people/${p.id}`} className="flex flex-col items-center gap-1.5">
                <span className="relative flex h-15 w-15 items-center justify-center rounded-full border-2 border-bubble bg-white font-display text-2xl text-accent-text">
                  {p.name.slice(0, 1)}
                  {d !== null && d <= 30 && (
                    <span className="absolute -bottom-1.5 -right-2.5 rounded-lg bg-accent px-1.5 py-0.5 font-sans text-[10px] font-bold text-white">
                      D-{d}
                    </span>
                  )}
                </span>
                <span className="text-[13px] font-medium">{p.name}</span>
              </Link>
            );
          })}
          <Link href="/people/new" className="flex flex-col items-center gap-1.5 text-muted">
            <span className="flex h-15 w-15 items-center justify-center rounded-full border-2 border-dashed border-line-strong">
              <PlusIcon />
            </span>
            <span className="text-[13px]">추가</span>
          </Link>
        </div>
      </section>

      {recent.length > 0 && (
        <section className="px-5 pt-6">
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="font-display text-lg">최근 상담</h2>
            {sessions.length > recent.length && (
              <Link href="/chats" className="px-1 py-1 text-[13px] text-muted">
                전체 {sessions.length}개 보기 ›
              </Link>
            )}
          </div>
          <ul className="flex flex-col gap-2">
            {recent.map((s) => {
              const c = CHARACTERS[s.characterId];
              return (
                <li key={s.id}>
                  <Link href={`/chat/${s.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3">
                    <CharacterAvatar id={c.id} tint={c.tint} size={40} />
                    <span className="flex-1 text-sm">
                      <span className="font-medium">{s.title ?? `${josa(c.name, "과", "와")}의 상담`}</span>
                      <span className="block text-xs text-muted">
                        {personName(s.personId) ? `${personName(s.personId)} 이야기 · ` : ""}
                        {relativeTime(s.createdAt)}
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

      <BottomNav />
    </main>
  );
}
