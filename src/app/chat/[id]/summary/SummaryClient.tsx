"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CharacterAvatar } from "@/components/CharacterFace";
import { CheckIcon, XIcon } from "@/components/Icons";
import { CHARACTERS } from "@/lib/characters";
import { josa } from "@/lib/format";
import type { FollowUp, Person, ProfileField, Session, Summary } from "@/lib/types";

const FIELD_LABEL: Record<ProfileField, string> = {
  likes: "좋아하는 것",
  dislikes: "싫어하는 것",
  contactStyle: "연락 스타일",
  notes: "성격 메모",
  timeline: "우리 이야기",
  mbti: "MBTI",
  age: "나이",
  birthday: "생일",
};

export default function SummaryClient({ id }: { id: string }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [followUp, setFollowUp] = useState<FollowUp | null>(null);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [values, setValues] = useState<string[]>([]); // 사용자가 고친 값
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/sessions/${id}`);
      const { session, person } = (await r.json()) as { session: Session; person: Person | null };
      setSession(session);
      setPerson(person);
      const show = (s: Summary, f: FollowUp | null) => {
        // 정리에 '우리 이야기'가 없어도 직접 한 줄 쓸 수 있게 빈 칸을 하나 둔다
        const suggestions =
          person && !s.applied && !s.suggestions.some((x) => x.field === "timeline")
            ? [...s.suggestions, { field: "timeline" as const, value: "" }]
            : s.suggestions;
        setSummary({ ...s, suggestions });
        setFollowUp(f);
        setChecked(suggestions.map((x) => x.value.trim() !== ""));
        setValues(suggestions.map((x) => x.value));
      };
      const stale = session.summary && session.messages.length > (session.summary.messageCount ?? session.messages.length);
      if (session.summary && !stale) {
        show(session.summary, session.followUp ?? null);
        return;
      }
      // 처음 정리하거나, 정리한 뒤 이어서 얘기했으면 새로 정리한다
      setRefreshing(Boolean(stale));
      const res = await fetch(`/api/sessions/${id}/summary`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error);
        return;
      }
      show(j.summary, j.followUp);
    })();
  }, [id]);

  async function toggleFollowUp(on: boolean) {
    setFollowUp((f) => (f ? { ...f, muted: !on } : f));
    await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ followUpMuted: !on }),
    });
  }

  const factIdx = summary ? summary.suggestions.flatMap((x, i) => (x.field === "timeline" ? [] : [i])) : [];
  const storyIdx = summary ? summary.suggestions.flatMap((x, i) => (x.field === "timeline" ? [i] : [])) : [];
  const setCheck = (i: number, v: boolean) => setChecked((c) => c.map((x, j) => (j === i ? v : x)));
  const setValue = (i: number, v: string) => setValues((vs) => vs.map((x, j) => (j === i ? v : x)));

  const saveCount = summary ? summary.suggestions.filter((_, i) => checked[i] && values[i]?.trim()).length : 0;

  async function save() {
    if (!summary || !person) return;
    setSaving(true);
    const accepted = summary.suggestions
      .map((s, i) => ({ ...s, value: (values[i] ?? s.value).trim() }))
      .filter((s, i) => checked[i] && s.value);
    await fetch(`/api/sessions/${id}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accepted }),
    });
    router.push(`/people/${person.id}`);
  }

  const character = session ? CHARACTERS[session.characterId] : null;
  const date = new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
  const dueLabel = followUp
    ? new Date(followUp.dueAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })
    : "";

  return (
    <main className="pb-12">
      <div className="flex items-center justify-between px-5 pb-1.5 pt-3.5">
        <h1 className="font-display text-xl">상담 정리</h1>
        <Link href={`/chat/${id}`} aria-label="상담으로 돌아가기" className="flex h-11 w-11 items-center justify-center">
          <XIcon />
        </Link>
      </div>

      {!summary && !error && (
        <div className="flex flex-col items-center gap-3 px-5 pt-20 text-sm text-muted">
          {character && <CharacterAvatar id={character.id} tint={character.tint} size={72} />}
          {character && josa(character.name, "이", "가")}{" "}
          {refreshing ? "이어서 나눈 이야기까지 다시 정리하고 있어요…" : "오늘 이야기를 정리하고 있어요…"}
        </div>
      )}
      {error && <p className="mx-5 mt-6 rounded-xl bg-[#FDECEA] px-3 py-2 text-sm text-danger" role="alert">{error}</p>}

      {summary && character && (
        <div className="flex flex-col gap-3.5 px-4 pt-2">
          <article className="overflow-hidden rounded-3xl border border-line bg-white">
            <div className="flex items-center gap-3 bg-accent px-5 py-4 text-white">
              <CharacterAvatar id={character.id} tint="#FFFFFF" size={44} />
              <div>
                <p className="text-xs opacity-90">{date}{person ? ` · ${person.name}` : ""}</p>
                <p className="font-display text-xl leading-snug">{summary.title}</p>
              </div>
            </div>
            <div className="flex flex-col gap-4 px-5 py-4 text-sm leading-relaxed">
              <Block label="상황">{summary.situation}</Block>
              <Block label="해석">{summary.interpretation}</Block>
              {summary.todo.length > 0 && (
                <Block label="할 것">
                  <ul className="flex flex-col gap-1.5">
                    {summary.todo.map((t, i) => (
                      <li key={i} className="flex gap-2"><CheckIcon size={16} className="mt-1 shrink-0 text-teal" />{t}</li>
                    ))}
                  </ul>
                </Block>
              )}
              {summary.dont.length > 0 && (
                <Block label="하지 말 것">
                  <ul className="flex flex-col gap-1.5">
                    {summary.dont.map((t, i) => (
                      <li key={i} className="flex gap-2"><XIcon size={16} className="mt-1 shrink-0 text-danger" />{t}</li>
                    ))}
                  </ul>
                </Block>
              )}
            </div>
          </article>

          {followUp && (
            <div className={`flex items-center gap-3 rounded-[20px] border border-line bg-white px-4 py-3.5 ${followUp.muted ? "opacity-70" : ""}`}>
              <CharacterAvatar id={character.id} tint={character.tint} size={40} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">
                  {followUp.muted ? "다시 물어보지 않을게" : `${dueLabel}에 다시 물어볼게`}
                </p>
                <p className="text-xs text-muted">
                  {followUp.muted ? "홈 화면에 안부 메시지가 오지 않아요" : <>&ldquo;{followUp.message}&rdquo;</>}
                </p>
              </div>
              <Switch
                label="안부 메시지 받기"
                checked={!followUp.muted}
                onChange={(on) => toggleFollowUp(on)}
              />
            </div>
          )}

          {person && summary.suggestions.length > 0 && !summary.applied && (
            <>
              {factIdx.length > 0 && (
                <section className="flex flex-col gap-3.5 rounded-[20px] border border-line bg-white p-4">
                  <div>
                    <h2 className="text-[15px] font-bold">{person.name} 프로필에 저장할까요?</h2>
                    <p className="text-xs text-muted">대화에서 찾은 정보예요. 틀린 내용은 눌러서 고치고, 저장할 것만 체크해 주세요.</p>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {factIdx.map((i) => {
                      const s = summary.suggestions[i];
                      return (
                        <li key={i} className={`flex items-center gap-3 rounded-2xl bg-cream p-3 ${checked[i] ? "" : "opacity-60"}`}>
                          <input
                            type="checkbox"
                            aria-label={`${FIELD_LABEL[s.field]} 저장`}
                            checked={checked[i] ?? false}
                            onChange={(e) => setCheck(i, e.target.checked)}
                            className="h-5 w-5 shrink-0 accent-[#C4491B]"
                          />
                          <div className="min-w-0 flex-1">
                            <label htmlFor={`sug-${i}`} className="block text-[11px] text-muted">
                              {FIELD_LABEL[s.field]}
                              {values[i] !== s.value && <span className="ml-1 text-accent-text">· 고침</span>}
                            </label>
                            <input
                              id={`sug-${i}`}
                              value={values[i] ?? ""}
                              onChange={(e) => setValue(i, e.target.value)}
                              placeholder={s.field === "birthday" ? "예: 01-11" : undefined}
                              className="w-full border-b border-transparent bg-transparent py-0.5 text-sm font-medium outline-none hover:border-line-strong focus:border-accent"
                            />
                          </div>
                          <PencilIcon />
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {storyIdx.map((i) => (
                <section key={i} className="flex flex-col gap-3 rounded-[20px] border border-teal/30 bg-teal-bg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <h2 className="text-[15px] font-bold text-teal">우리 이야기에 한 줄 남길까요?</h2>
                      <p className="text-xs text-teal/80">
                        프로필의 &lsquo;우리 이야기&rsquo;에 오늘 날짜로 쌓여요. 내 말로 고쳐 써도 돼요.
                      </p>
                    </div>
                    <Switch label="우리 이야기에 남기기" checked={checked[i] ?? false} onChange={(v) => setCheck(i, v)} />
                  </div>
                  <div className={`flex gap-3 rounded-2xl bg-white p-3.5 ${checked[i] ? "" : "opacity-60"}`}>
                    <span className="flex w-3 flex-col items-center pt-1">
                      <span className="h-3 w-3 rounded-full bg-bubble" />
                      <span className="mt-1 w-0.5 flex-1 border-l-2 border-dashed border-line-strong" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <label htmlFor={`sug-${i}`} className="block text-xs text-muted">
                        {date} · 오늘
                        {summary.suggestions[i].value && values[i] !== summary.suggestions[i].value && (
                          <span className="ml-1 text-accent-text">· 고침</span>
                        )}
                      </label>
                      <textarea
                        id={`sug-${i}`}
                        rows={2}
                        value={values[i] ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          // 비어 있던 칸에 쓰기 시작하면 자동으로 켠다
                          if (!values[i] && v) setCheck(i, true);
                          setValue(i, v);
                        }}
                        placeholder="오늘 있었던 일을 한 줄로 남겨 보세요"
                        className="mt-0.5 w-full resize-none bg-transparent text-sm leading-relaxed font-medium outline-none placeholder:font-normal placeholder:text-muted"
                      />
                    </div>
                  </div>
                </section>
              ))}

              <button
                onClick={save}
                disabled={saving || saveCount === 0}
                className="h-12 rounded-full bg-accent text-sm font-bold text-white disabled:opacity-60"
              >
                {saveCount === 0 ? "저장할 항목이 없어요" : `${saveCount}개 저장하기`}
              </button>
              <Link href={`/people/${person.id}`} className="-mt-1.5 self-center px-3 py-2 text-[13px] text-muted">
                저장하지 않고 프로필 보기
              </Link>
            </>
          )}

          {person && (summary.applied || summary.suggestions.length === 0) && (
            <Link href={`/people/${person.id}`} className="flex h-12 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
              {person.name} 프로필 보기
            </Link>
          )}
          {!person && (
            <Link href="/" className="flex h-12 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
              홈으로
            </Link>
          )}

          <p className="px-1.5 text-xs leading-relaxed text-muted">
            건강, 연락처, 주소 같은 민감한 정보는 자동으로 저장하지 않아요. 온기노트는 자기계발·웰빙 도구이며 전문 심리상담이나 의료 서비스를 대신하지 않아요.
          </p>
        </div>
      )}
    </main>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-bold text-muted">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-accent" : "bg-line-strong"}`}
    >
      <span className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
    </button>
  );
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
