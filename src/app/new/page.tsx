"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CharacterAvatar } from "@/components/CharacterFace";
import { BackIcon, CheckIcon, MicIcon } from "@/components/Icons";
import { CHARACTERS, CHARACTER_LIST } from "@/lib/characters";
import { josa } from "@/lib/format";
import type { CharacterId, Person } from "@/lib/types";

export default function NewSession() {
  const router = useRouter();
  const [persons, setPersons] = useState<Person[]>([]);
  const [characterId, setCharacterId] = useState<CharacterId>("mongle");
  const [personId, setPersonId] = useState<string | null>(null);
  const [voice, setVoice] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const pre = new URLSearchParams(window.location.search).get("person");
    fetch("/api/persons")
      .then((r) => r.json())
      .then((list: Person[]) => {
        setPersons(list);
        if (pre && list.some((p) => p.id === pre)) setPersonId(pre);
        else if (list[0]) setPersonId(list[0].id);
      });
  }, []);

  const character = CHARACTERS[characterId];
  const person = persons.find((p) => p.id === personId);

  async function start() {
    setBusy(true);
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId, personId, voice }),
    });
    const s = await res.json();
    router.push(`/chat/${s.id}`);
  }

  return (
    <main className="pb-32">
      <div className="px-3 pt-3">
        {/* 홈, 상담 목록, 프로필 어디서 왔든 그 화면으로 돌아간다 */}
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
          aria-label="뒤로"
          className="flex h-11 w-11 items-center justify-center"
        >
          <BackIcon />
        </button>
      </div>
      <div className="px-5">
        <h1 className="font-display text-[26px]">누구랑 이야기할까?</h1>
        <p className="mt-1 text-sm text-muted">고민 스타일에 맞는 친구를 골라봐</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 px-4 pt-5 md:grid-cols-4">
        {CHARACTER_LIST.map((c) => {
          const selected = c.id === characterId;
          return (
            <button
              key={c.id}
              aria-pressed={selected}
              onClick={() => setCharacterId(c.id)}
              className={`relative flex flex-col items-start gap-1.5 rounded-[22px] border-2 bg-white p-3.5 text-left ${
                selected ? "border-accent" : "border-line"
              }`}
            >
              {selected && (
                <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white">
                  <CheckIcon size={14} />
                </span>
              )}
              <CharacterAvatar id={c.id} tint={c.tint} size={64} />
              <span className="font-display text-xl">{c.name}</span>
              <span className="rounded-lg bg-peach px-2 py-0.5 text-[11px] font-bold text-accent-text">
                {c.species} · {c.style}
              </span>
              <span className="text-[13px] leading-normal text-ink-soft">&ldquo;{c.tagline}&rdquo;</span>
            </button>
          );
        })}
      </div>

      <section className="px-5 pt-6">
        <h2 className="mb-2.5 font-display text-lg">누구 얘기야?</h2>
        <div className="flex flex-wrap gap-2">
          {persons.map((p) => (
            <button
              key={p.id}
              aria-pressed={p.id === personId}
              onClick={() => setPersonId(p.id)}
              className={`h-10 rounded-full px-4 text-sm ${
                p.id === personId ? "bg-ink font-medium text-white" : "border border-line-strong bg-white"
              }`}
            >
              {p.name}
            </button>
          ))}
          <Link href="/people/new?next=new" className="flex h-10 items-center rounded-full border border-line-strong bg-white px-4 text-sm">
            + 새 사람
          </Link>
          <button
            aria-pressed={personId === null}
            onClick={() => setPersonId(null)}
            className={`h-10 rounded-full px-4 text-sm ${
              personId === null ? "bg-ink font-medium text-white" : "border border-line-strong bg-white"
            }`}
          >
            그냥 내 얘기
          </button>
        </div>
      </section>

      <section className="px-5 pt-5">
        <div className="flex items-center gap-3 rounded-[18px] border border-line bg-white px-3.5 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-peach text-accent-text">
            <MicIcon size={18} />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-medium">목소리로 대화하기</span>
            <span className="block text-xs text-muted">
              {character.name} 목소리 · {character.voice.description}
            </span>
          </span>
          <button
            role="switch"
            aria-checked={voice}
            aria-label="목소리로 대화하기"
            onClick={() => setVoice((v) => !v)}
            className={`relative h-8 w-13 rounded-full transition-colors ${voice ? "bg-teal" : "bg-line-strong"}`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${voice ? "left-6" : "left-1"}`}
            />
          </button>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-6 mx-auto max-w-[min(42rem,calc(100%-32px))]">
        <button
          onClick={start}
          disabled={busy}
          className="flex h-14 w-full items-center justify-center rounded-full bg-accent text-base font-bold text-white disabled:opacity-60"
        >
          {josa(character.name, "이랑", "랑")} {person ? `${person.name} 얘기 ` : ""}시작하기
        </button>
      </div>
    </main>
  );
}
