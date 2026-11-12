"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SearchIcon } from "@/components/Icons";
import { daysUntilBirthday, relativeTime } from "@/lib/format";
import type { Person } from "@/lib/types";

interface SessionLite {
  personId: string | null;
  lastAt: string;
}

/** PC 사람들 화면의 왼쪽 목록 */
function PeopleSidebarInner() {
  const path = usePathname();
  const activeId = path.startsWith("/people/") ? path.split("/")[2] : null;
  const [persons, setPersons] = useState<Person[] | null>(null);
  const [sessions, setSessions] = useState<SessionLite[]>([]);
  const [query, setQuery] = useState("");
  const [relation, setRelation] = useState<string>("all");

  useEffect(() => {
    const load = () =>
      Promise.all([fetch("/api/persons").then((r) => r.json()), fetch("/api/sessions").then((r) => r.json())]).then(
        ([p, s]: [Person[], SessionLite[]]) => {
          setPersons(p);
          setSessions(s);
        },
      );
    load();
    window.addEventListener("onginote:persons", load);
    return () => window.removeEventListener("onginote:persons", load);
  }, [path]);

  const relations = [...new Set((persons ?? []).map((p) => p.relation).filter(Boolean))];
  const q = query.trim().toLowerCase();
  const visible = (persons ?? [])
    .filter((p) => relation === "all" || p.relation === relation)
    .filter((p) => !q || [p.name, p.relation, p.mbti].some((v) => v?.toLowerCase().includes(q)));

  const stats = (id: string) => {
    const mine = sessions.filter((s) => s.personId === id);
    const last = mine.map((s) => s.lastAt).sort().at(-1);
    return { count: mine.length, last };
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-4.5 pb-3 pt-5">
        <h1 className="font-display text-2xl">사람들</h1>
        <Link href="/people/new" className="flex h-9 items-center rounded-full bg-accent px-3.5 text-[13px] font-bold text-white">
          + 새 사람
        </Link>
      </div>

      {persons && persons.length > 0 && (
        <div className="flex flex-col gap-2 px-4.5 pb-1">
          <label className="flex h-10 items-center gap-2 rounded-xl border border-line-strong bg-white px-3 text-muted focus-within:border-accent">
            <SearchIcon />
            <span className="sr-only">사람 찾기</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름, 관계로 찾기"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
            />
          </label>
          {relations.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="관계">
              {["all", ...relations].map((r) => (
                <button
                  key={r}
                  aria-pressed={relation === r}
                  onClick={() => setRelation(r)}
                  className={`h-8 rounded-full border px-3 text-xs ${relation === r ? "border-ink bg-ink font-bold text-white" : "border-line-strong bg-white"}`}
                >
                  {r === "all" ? `전체 ${persons.length}` : r}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 pb-4 pt-2">
        {persons === null && <li className="px-2 text-sm text-muted">불러오는 중…</li>}
        {persons?.length === 0 && (
          <li className="mx-2 rounded-2xl border border-dashed border-line-strong p-5 text-center text-sm text-muted">
            아직 등록한 사람이 없어요.
          </li>
        )}
        {visible.map((p) => {
          const { count, last } = stats(p.id);
          const d = daysUntilBirthday(p.birthday);
          const active = p.id === activeId;
          return (
            <li key={p.id}>
              <Link
                href={`/people/${p.id}`}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-2xl border px-2.5 py-2.5 ${active ? "border-peach-deep bg-white" : "border-transparent hover:bg-white/70"}`}
              >
                <span className="flex h-10.5 w-10.5 shrink-0 items-center justify-center rounded-full border-2 border-bubble bg-white font-display text-lg text-accent-text">
                  {p.name.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className={`truncate text-sm ${active ? "font-bold" : "font-medium"}`}>{p.name}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-muted">{last ? relativeTime(last) : "상담 전"}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-xs text-muted">
                      {[p.relation, p.mbti, count > 0 && `상담 ${count}번`].filter(Boolean).join(" · ")}
                    </span>
                    {d !== null && d <= 30 && (
                      <span className="shrink-0 rounded-md bg-peach px-1.5 text-[10px] font-bold text-accent-text">생일 D-{d}</span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * 주소(usePathname)는 동적 주소(/chat/[id] 등)에서 요청 때만 알 수 있어서 Suspense 로 감싼다.
 * 정적 주소에서는 빌드 때 그대로 그려진다.
 */
export function PeopleSidebar() {
  return (
    <Suspense fallback={<p className="p-5 text-sm text-muted">불러오는 중…</p>}>
      <PeopleSidebarInner />
    </Suspense>
  );
}
