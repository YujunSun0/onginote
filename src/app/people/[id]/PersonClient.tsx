"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { CharacterAvatar } from "@/components/CharacterFace";
import { BackIcon, CakeIcon, LockIcon, XIcon } from "@/components/Icons";
import { CHARACTERS } from "@/lib/characters";
import { birthdayLabel, daysUntilBirthday, josa, relativeTime } from "@/lib/format";
import { SummaryBadge } from "@/components/SummaryBadge";
import type { CharacterId, Person, SummaryState } from "@/lib/types";

type ListField = "likes" | "dislikes" | "notes";

export default function PersonClient({ id }: { id: string }) {
  const router = useRouter();
  const [person, setPerson] = useState<Person | null>(null);
  const [sessions, setSessions] = useState<{ id: string; characterId: CharacterId; createdAt: string; title?: string; summaryState?: SummaryState }[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    fetch(`/api/persons/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return router.replace("/people");
        setPerson(j.person);
        setSessions(j.sessions);
      });
  }, [id, router]);

  if (!person) return <main className="p-6 text-muted">불러오는 중…</main>;
  const mongle = CHARACTERS.mongle;
  const dday = daysUntilBirthday(person.birthday);

  async function patch(update: Partial<Person>) {
    const res = await fetch(`/api/persons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    setPerson(await res.json());
  }

  function addItem(field: ListField, value: string) {
    const v = value.trim();
    if (!v || !person || person[field].includes(v)) return;
    patch({ [field]: [...person[field], v] });
  }

  function removeItem(field: ListField, value: string) {
    if (!person) return;
    patch({ [field]: person[field].filter((x) => x !== value) });
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    setAnswer(null);
    const res = await fetch(`/api/persons/${id}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const j = await res.json();
    setAnswer(res.ok ? j.answer : j.error);
    setAsking(false);
  }

  async function deleteAll() {
    if (!person) return;
    if (!confirm(`${person.name}에 대한 프로필과 상담 기록을 모두 지울까요? 되돌릴 수 없어요.`)) return;
    await fetch(`/api/persons/${id}`, { method: "DELETE" });
    router.push("/people");
  }

  return (
    <main className="pb-28">
      <section className="rounded-b-[36px] bg-peach px-3 pb-6 pt-3">
        <Link href="/people" aria-label="뒤로" className="flex h-11 w-11 items-center justify-center">
          <BackIcon />
        </Link>
        <div className="flex flex-col items-center gap-2">
          <span className="flex h-21 w-21 items-center justify-center rounded-full border-[3px] border-bubble bg-white font-display text-4xl text-accent-text">
            {person.name.slice(0, 1)}
          </span>
          <h1 className="font-display text-[28px]">{person.name}</h1>
          <div className="flex flex-wrap justify-center gap-1.5 text-xs font-medium">
            <span className="rounded-xl bg-accent px-2.5 py-1 font-bold text-white">{person.relation}</span>
            <InlineEdit label="MBTI" value={person.mbti} placeholder="MBTI 추가" onSave={(v) => patch({ mbti: v.toUpperCase() })} />
            <InlineEdit label="나이" value={person.age ? `${person.age}` : undefined} suffix="세" placeholder="나이 추가" onSave={(v) => patch({ age: v })} />
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 px-4 pt-4">
        <div className="flex items-center gap-3 rounded-[20px] border border-line bg-white px-4 py-3.5">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-peach text-accent-text"><CakeIcon size={22} /></span>
          <span className="flex-1">
            <span className="block text-[15px] font-bold">{person.birthday ? `생일 ${birthdayLabel(person.birthday)}` : "생일을 아직 몰라요"}</span>
            <span className="block text-xs text-muted">
              {person.birthday ? "다가오면 선물 고르기를 도와줄게요" : "상담 중에 알게 되면 기록해 줄게요"}
            </span>
          </span>
          {dday !== null && <span className="font-display text-[22px] text-accent-text">D-{dday}</span>}
        </div>

        <form onSubmit={ask} className="flex flex-col gap-2 rounded-[24px] border-[1.5px] border-bubble bg-white p-2">
          <div className="flex items-center gap-2">
            <CharacterAvatar id="mongle" tint={mongle.tint} size={36} />
            <label htmlFor="ask" className="sr-only">{person.name}에 대해 물어보기</label>
            <input
              id="ask"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={`${josa(person.name, "이", "가")} 뭐 좋아했더라?`}
              className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            <button disabled={asking} className="h-10 rounded-full bg-accent px-4 text-sm font-bold text-white disabled:opacity-60">
              {asking ? "…" : "물어보기"}
            </button>
          </div>
          {answer && <p className="rounded-2xl bg-cream px-3.5 py-3 text-sm leading-relaxed">{answer}</p>}
        </form>

        <section className="flex flex-col gap-5 rounded-[22px] border border-line bg-white p-4.5">
          <ChipList title="좋아하는 것" items={person.likes} tone="peach" onAdd={(v) => addItem("likes", v)} onRemove={(v) => removeItem("likes", v)} />
          <ChipList title="싫어하는 것" items={person.dislikes} tone="gray" onAdd={(v) => addItem("dislikes", v)} onRemove={(v) => removeItem("dislikes", v)} />
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-[17px]">연락 스타일</h2>
            <InlineText value={person.contactStyle} placeholder="예: 저녁에 몰아서 답장" onSave={(v) => patch({ contactStyle: v })} />
          </div>
          <ChipList title="성격 메모" items={person.notes} tone="text" onAdd={(v) => addItem("notes", v)} onRemove={(v) => removeItem("notes", v)} />
        </section>

        <Timeline items={person.timeline} onChange={(timeline) => patch({ timeline })} />

        {sessions.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="px-1 font-display text-[17px]">상담 기록</h2>
            {sessions
              .slice()
              .reverse()
              .map((s) => {
                const c = CHARACTERS[s.characterId];
                return (
                  <Link key={s.id} href={`/chat/${s.id}?from=person`} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-sm">
                    <CharacterAvatar id={c.id} tint={c.tint} size={36} />
                    <span className="flex-1">
                      {s.title ?? `${josa(c.name, "과", "와")}의 상담`}
                      <span className="block text-xs text-muted">{relativeTime(s.createdAt)}</span>
                    </span>
                    <SummaryBadge state={s.summaryState} />
                  </Link>
                );
              })}
          </section>
        )}

        <Link href={`/new?person=${person.id}`} className="flex h-12 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
          {person.name} 얘기 상담하기
        </Link>

        <p className="flex items-center gap-2.5 rounded-2xl bg-teal-bg px-3.5 py-3 text-xs leading-normal text-teal">
          <LockIcon className="shrink-0" />
          프로토타입에서는 이 기록이 이 컴퓨터(data/db.json)에만 저장돼요.
        </p>
        <button onClick={deleteAll} className="h-11 self-start px-1.5 text-sm text-danger">
          {person.name} 기록 전체 삭제
        </button>
      </div>
      <BottomNav />
    </main>
  );
}

function ChipList({
  title, items, tone, onAdd, onRemove,
}: { title: string; items: string[]; tone: "peach" | "gray" | "text"; onAdd: (v: string) => void; onRemove: (v: string) => void }) {
  const [draft, setDraft] = useState("");
  const chip =
    tone === "peach" ? "bg-peach text-accent-text" : tone === "gray" ? "bg-[#F3ECE6] text-ink" : "bg-cream text-ink";
  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-display text-[17px]">{title}</h2>
      <ul className={tone === "text" ? "flex flex-col gap-1.5" : "flex flex-wrap gap-1.5"}>
        {items.map((v) => (
          <li key={v} className={`flex items-center gap-1 rounded-2xl py-1.5 pl-3 pr-1 text-[13px] font-medium ${chip}`}>
            {v}
            <button aria-label={`${v} 삭제`} onClick={() => onRemove(v)} className="flex h-6 w-6 items-center justify-center opacity-60 hover:opacity-100">
              <XIcon size={12} />
            </button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onAdd(draft);
          setDraft("");
        }}
      >
        <label className="sr-only" htmlFor={`add-${title}`}>{title} 추가</label>
        <input
          id={`add-${title}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="+ 직접 추가"
          className="h-9 w-full rounded-xl border border-dashed border-line-strong bg-transparent px-3 text-[13px] outline-none focus:border-accent"
        />
      </form>
    </div>
  );
}

function InlineEdit({ label, value, suffix = "", placeholder, onSave }: { label: string; value?: string; suffix?: string; placeholder: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft.trim());
          setEditing(false);
        }}
      >
        <label className="sr-only" htmlFor={`edit-${label}`}>{label}</label>
        <input id={`edit-${label}`} autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => setEditing(false)} className="h-6 w-20 rounded-xl bg-white px-2 outline-none" />
      </form>
    );
  }
  return (
    <button onClick={() => setEditing(true)} className="rounded-xl bg-white px-2.5 py-1">
      {value ? `${value}${suffix}` : placeholder}
    </button>
  );
}

function InlineText({ value, placeholder, onSave }: { value?: string; placeholder: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value ?? "");
  return (
    <input
      aria-label="연락 스타일"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== (value ?? "") && onSave(draft.trim())}
      placeholder={placeholder}
      className="h-9 w-full rounded-xl bg-transparent text-sm outline-none placeholder:text-muted focus:bg-cream focus:px-2"
    />
  );
}

type TimelineItem = Person["timeline"][number];

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateLabel(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const sameYear = y === new Date().getFullYear();
  return `${sameYear ? "" : `${y}년 `}${m}월 ${d}일`;
}

/** 우리 이야기: 상담 정리로 쌓이고, 직접 쓰고 고치고 지울 수도 있다. 최신이 위. */
function Timeline({ items, onChange }: { items: TimelineItem[]; onChange: (items: TimelineItem[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState(localToday);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const sorted = (list: TimelineItem[]) => [...list].sort((a, b) => b.date.localeCompare(a.date));

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onChange(sorted([{ date, text: text.trim() }, ...items]));
    setText("");
    setDate(localToday());
    setAdding(false);
  }

  function saveEdit(i: number) {
    const v = editText.trim();
    setEditing(null);
    if (!v || v === items[i].text) return;
    onChange(items.map((t, j) => (j === i ? { ...t, text: v } : t)));
  }

  return (
    <section className="flex flex-col gap-3 rounded-[22px] border border-line bg-white p-4.5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-[17px]">우리 이야기</h2>
        {!adding && (
          <button onClick={() => setAdding(true)} className="h-8 rounded-full bg-peach px-3 text-[13px] font-medium text-accent-text">
            + 직접 쓰기
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={add} className="flex flex-col gap-2 rounded-2xl bg-cream p-3">
          <label className="flex items-center gap-2 text-xs text-muted">
            날짜
            <input
              type="date"
              value={date}
              max={localToday()}
              onChange={(e) => setDate(e.target.value || localToday())}
              className="h-8 rounded-lg bg-white px-2 text-[13px] text-ink outline-none"
            />
          </label>
          <label htmlFor="timeline-new" className="sr-only">있었던 일</label>
          <textarea
            id="timeline-new"
            autoFocus
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="예: 처음으로 둘이 밥 먹음"
            className="w-full resize-none rounded-lg bg-white px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent"
          />
          <div className="flex justify-end gap-1.5">
            <button type="button" onClick={() => { setAdding(false); setText(""); }} className="h-9 rounded-full px-3.5 text-[13px] text-muted">
              취소
            </button>
            <button disabled={!text.trim()} className="h-9 rounded-full bg-accent px-4 text-[13px] font-bold text-white disabled:opacity-50">
              남기기
            </button>
          </div>
        </form>
      )}

      {items.length === 0 && !adding ? (
        <p className="text-sm text-muted">직접 쓰거나 상담을 정리하면 여기에 쌓여요.</p>
      ) : (
        <ol className="flex flex-col">
          {items.map((t, i) => (
            <li key={`${t.date}-${i}`} className="group flex gap-3">
              <span className="flex w-3 flex-col items-center">
                <span className={`mt-1 h-3 w-3 rounded-full ${i === 0 ? "bg-bubble" : "bg-line-strong"}`} />
                {i < items.length - 1 && <span className="w-0.5 flex-1 bg-line" />}
              </span>
              <div className="min-w-0 flex-1 pb-4">
                <span className="block text-xs text-muted">{dateLabel(t.date)}</span>
                {editing === i ? (
                  <textarea
                    aria-label="기록 고치기"
                    autoFocus
                    rows={2}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={() => saveEdit(i)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        saveEdit(i);
                      }
                      if (e.key === "Escape") setEditing(null);
                    }}
                    className="mt-0.5 w-full resize-none rounded-lg bg-cream px-2 py-1 text-sm font-medium outline-none focus:ring-1 focus:ring-accent"
                  />
                ) : (
                  <button
                    onClick={() => { setEditing(i); setEditText(t.text); }}
                    className="block w-full rounded-lg text-left text-sm font-medium hover:bg-cream"
                    aria-label={`${t.text} 고치기`}
                  >
                    {t.text}
                  </button>
                )}
              </div>
              <button
                aria-label={`${t.text} 지우기`}
                onClick={() => confirm("이 기록을 지울까요?") && onChange(items.filter((_, j) => j !== i))}
                className="flex h-7 w-7 shrink-0 items-center justify-center text-muted opacity-60 hover:opacity-100"
              >
                <XIcon size={12} />
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
