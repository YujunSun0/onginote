"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { PlusIcon } from "@/components/Icons";
import { birthdayLabel, daysUntilBirthday } from "@/lib/format";
import type { Person } from "@/lib/types";

export default function PeoplePage() {
  const [persons, setPersons] = useState<Person[] | null>(null);
  useEffect(() => {
    fetch("/api/persons").then((r) => r.json()).then(setPersons);
  }, []);

  return (
    <main className="px-5 pb-28 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[26px]">내 사람들</h1>
        <Link href="/people/new" className="flex h-10 items-center gap-1 rounded-full bg-accent px-4 text-sm font-bold text-white">
          <PlusIcon size={16} /> 추가
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted">상담하면서 알게 된 정보가 여기에 쌓여요</p>

      {persons?.length === 0 && (
        <p className="mt-10 rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">
          아직 등록한 사람이 없어요. 고민 상대를 추가하면 상담할 때 기억해 줘요.
        </p>
      )}

      <ul className="mt-5 grid gap-2.5 md:grid-cols-2">
        {persons?.map((p) => {
          const d = daysUntilBirthday(p.birthday);
          return (
            <li key={p.id}>
              <Link href={`/people/${p.id}`} className="flex items-center gap-3.5 rounded-2xl border border-line bg-white px-4 py-3.5">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-bubble bg-white font-display text-xl text-accent-text">
                  {p.name.slice(0, 1)}
                </span>
                <span className="flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="text-[15px] font-bold">{p.name}</span>
                    <span className="rounded-lg bg-peach px-2 py-0.5 text-[11px] font-medium text-accent-text">{p.relation}</span>
                  </span>
                  <span className="block text-xs text-muted">
                    {[p.mbti, p.age && `${p.age}세`, d !== null && `생일 ${birthdayLabel(p.birthday)} (D-${d})`].filter(Boolean).join(" · ") || "정보 없음"}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <BottomNav />
    </main>
  );
}
