"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { CharacterAvatar } from "@/components/CharacterFace";
import { SummaryBadge } from "@/components/SummaryBadge";
import { CHARACTERS } from "@/lib/characters";
import { josa, relativeTime } from "@/lib/format";
import type { CharacterId, Person, SummaryState } from "@/lib/types";

interface SessionRow {
  id: string;
  characterId: CharacterId;
  personId: string | null;
  createdAt: string;
  lastAt: string;
  title?: string;
  summaryState: SummaryState;
  lastText?: string;
  userMessages: number;
}

type StateFilter = "all" | "open" | "done";
const STATE_FILTERS: { id: StateFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "open", label: "대화 중" },
  { id: "done", label: "정리됨" },
];

/** 마지막 대화 시각으로 묶는다 */
function groupLabel(iso: string, now: number): string {
  const day = (t: number) => {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const diff = Math.round((day(now) - day(new Date(iso).getTime())) / 86_400_000);
  if (diff <= 0) return "오늘";
  if (diff === 1) return "어제";
  if (diff < 7) return "이번 주";
  if (diff < 31) return "이번 달";
  return "그 전";
}

export default function ChatsPage() {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [persons, setPersons] = useState<Person[]>([]);
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [personFilter, setPersonFilter] = useState<string>("all"); // "all" | "none" | person id
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([fetch("/api/sessions").then((r) => r.json()), fetch("/api/persons").then((r) => r.json())]).then(
      ([s, p]: [SessionRow[], Person[]]) => {
        setSessions(s);
        setPersons(p);
        setNow(Date.now());
      },
    );
  }, []);

  const personName = (id: string | null) => persons.find((p) => p.id === id)?.name;
  const hasMine = sessions?.some((s) => s.personId === null) ?? false;

  const visible = (sessions ?? [])
    .filter((s) => (stateFilter === "all" ? true : stateFilter === "done" ? s.summaryState === "done" : s.summaryState !== "done"))
    .filter((s) => (personFilter === "all" ? true : personFilter === "none" ? s.personId === null : s.personId === personFilter))
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));

  const groups: { label: string; rows: SessionRow[] }[] = [];
  if (now !== null) {
    for (const s of visible) {
      const label = groupLabel(s.lastAt, now);
      const g = groups.at(-1);
      if (g?.label === label) g.rows.push(s);
      else groups.push({ label, rows: [s] });
    }
  }

  return (
    <main className="pb-28">
      <div className="flex items-center justify-between px-5 pb-2 pt-5">
        <h1 className="font-display text-2xl">상담</h1>
        <Link href="/new" className="flex h-10 items-center rounded-full bg-accent px-4 text-sm font-bold text-white">
          + 새 상담
        </Link>
      </div>

      {sessions && sessions.length > 0 && (
        <div className="flex flex-col gap-2 px-4 pb-1 pt-1">
          <div className="flex gap-1.5" role="group" aria-label="정리 상태">
            {STATE_FILTERS.map((f) => (
              <FilterChip key={f.id} active={stateFilter === f.id} onClick={() => setStateFilter(f.id)}>
                {f.label}
              </FilterChip>
            ))}
          </div>
          {(persons.length > 0 || hasMine) && (
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4" role="group" aria-label="사람">
              <FilterChip tone="soft" active={personFilter === "all"} onClick={() => setPersonFilter("all")}>
                모든 사람
              </FilterChip>
              {persons.map((p) => (
                <FilterChip key={p.id} tone="soft" active={personFilter === p.id} onClick={() => setPersonFilter(p.id)}>
                  {p.name}
                </FilterChip>
              ))}
              {hasMine && (
                <FilterChip tone="soft" active={personFilter === "none"} onClick={() => setPersonFilter("none")}>
                  내 이야기
                </FilterChip>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4 px-4 pt-3">
        {sessions === null && <p className="px-1 text-sm text-muted">불러오는 중…</p>}

        {sessions?.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-line bg-white px-6 py-10 text-center">
            <CharacterAvatar id="mongle" tint={CHARACTERS.mongle.tint} size={64} />
            <p className="text-sm text-muted">아직 나눈 상담이 없어요.<br />고민이 생기면 편하게 털어놔요.</p>
            <Link href="/new" className="flex h-11 items-center rounded-full bg-accent px-5 text-sm font-bold text-white">
              첫 상담 시작하기
            </Link>
          </div>
        )}

        {sessions && sessions.length > 0 && visible.length === 0 && (
          <p className="px-1 py-6 text-center text-sm text-muted">조건에 맞는 상담이 없어요.</p>
        )}

        {groups.map((g) => (
          <section key={g.label} className="flex flex-col gap-2">
            <h2 className="px-1 text-xs font-bold text-muted">{g.label}</h2>
            <ul className="flex flex-col gap-2">
              {g.rows.map((s) => {
                const c = CHARACTERS[s.characterId];
                const who = personName(s.personId);
                return (
                  <li key={s.id}>
                    <Link href={`/chat/${s.id}?from=chats`} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3">
                      <CharacterAvatar id={c.id} tint={c.tint} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className="truncate text-sm font-medium">{s.title ?? `${josa(c.name, "과", "와")}의 상담`}</span>
                          <span className="ml-auto shrink-0 text-[11px] text-muted">{relativeTime(s.lastAt)}</span>
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {who ? `${who} 이야기` : "내 이야기"} · {c.name}
                          {s.lastText ? ` · ${s.lastText}` : ""}
                        </span>
                      </span>
                      <SummaryBadge state={s.summaryState} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <BottomNav />
    </main>
  );
}

function FilterChip({
  active, onClick, children, tone = "strong",
}: { active: boolean; onClick: () => void; children: React.ReactNode; tone?: "strong" | "soft" }) {
  const on = tone === "strong" ? "bg-ink text-white border-ink" : "bg-peach text-accent-text border-bubble";
  return (
    <button
      aria-pressed={active}
      onClick={onClick}
      className={`h-8.5 shrink-0 rounded-full border px-3.5 text-[13px] ${active ? `${on} font-bold` : "border-line-strong bg-white text-ink"}`}
    >
      {children}
    </button>
  );
}
