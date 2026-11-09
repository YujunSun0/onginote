"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BackIcon } from "@/components/Icons";

const RELATIONS = ["썸", "연인", "전 연인", "짝사랑", "친구", "가족", "직장"];

export default function NewPerson() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("썸");
  const [mbti, setMbti] = useState("");
  const [age, setAge] = useState("");
  const [birthday, setBirthday] = useState(""); // yyyy-mm-dd from <input type=date>
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/persons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, relation, mbti, age, birthday: birthday ? birthday.slice(5) : undefined }),
    });
    const j = await res.json();
    if (!res.ok) return setError(j.error);
    const next = new URLSearchParams(window.location.search).get("next");
    router.push(next === "new" ? `/new?person=${j.id}` : `/people/${j.id}`);
  }

  const field = "h-12 w-full rounded-2xl border border-line-strong bg-white px-4 text-[15px] outline-none focus:border-accent";

  return (
    <main className="px-5 pb-12 pt-3">
      <button onClick={() => router.back()} aria-label="뒤로" className="-ml-2 flex h-11 w-11 items-center justify-center">
        <BackIcon />
      </button>
      <h1 className="font-display text-[26px]">누구에 대한 고민이야?</h1>
      <p className="mt-1 text-sm text-muted">이름 대신 별명이나 이니셜도 괜찮아요. 나머지는 상담하면서 채워져요.</p>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium">이름(별명) *</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="예: 유준, ㅇㅈ" required />
        </div>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">관계</legend>
          <div className="flex flex-wrap gap-2">
            {RELATIONS.map((r) => (
              <button
                type="button"
                key={r}
                aria-pressed={r === relation}
                onClick={() => setRelation(r)}
                className={`h-10 rounded-full px-4 text-sm ${r === relation ? "bg-ink text-white" : "border border-line-strong bg-white"}`}
              >
                {r}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="mbti" className="text-sm font-medium">MBTI</label>
            <input id="mbti" value={mbti} onChange={(e) => setMbti(e.target.value)} maxLength={4} className={field} placeholder="ISFJ" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="age" className="text-sm font-medium">나이</label>
            <input id="age" value={age} onChange={(e) => setAge(e.target.value)} inputMode="numeric" className={field} placeholder="27" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="birthday" className="text-sm font-medium">생일</label>
          <input id="birthday" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className={field} />
        </div>
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <button type="submit" className="h-13 rounded-full bg-accent text-base font-bold text-white">저장하기</button>
        <Link href="/" className="text-center text-sm text-muted">취소</Link>
      </form>
    </main>
  );
}
