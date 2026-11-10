import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CharacterFace } from "@/components/CharacterFace";
import { CHARACTERS } from "@/lib/characters";
import { getSession, listPersons, listSessions, type Ctx } from "@/lib/db";
import { birthdayLabel, splitBubbles } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { messageImages, type Person } from "@/lib/types";
import { PrintToolbar } from "./PrintToolbar";

export const metadata = { title: "내 기록 · 온기노트" };

/** 한국 시간 "2026년 11월 10일" (time 이면 "오후 3:05" 까지) */
function kDate(iso: string | null | undefined, time = false) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(time ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

/**
 * 내 기록 전체를 인쇄용으로 보여준다. 브라우저 인쇄 창에서 "PDF로 저장"을 고르면 PDF 가 된다.
 * RLS 때문에 로그인한 본인 기록만 나온다.
 */
export default function PrintPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-sm text-muted">기록을 모으는 중…</p>}>
      <PrintDocument />
    </Suspense>
  );
}

async function PrintDocument() {
  await connection(); // 요청마다 새로 만든다 (Supabase 토큰 확인과 "내려받은 날"이 현재 시각을 쓴다)
  const sb = await createClient();
  const { data: claims } = await sb.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login?next=/me/print");
  const ctx: Ctx = { sb, userId };

  const [{ data: userData }, { data: profile }, persons, metas] = await Promise.all([
    sb.auth.getUser(),
    sb.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    listPersons(ctx),
    listSessions(ctx),
  ]);
  const sessions = (
    await Promise.all([...metas].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((m) => getSession(ctx, m.id, { imageUrls: true })))
  ).filter((s) => s !== null);
  const personName = new Map(persons.map((p) => [p.id, p.name]));
  const nickname = profile?.display_name ?? "나";

  return (
    <main className="print-doc mx-auto max-w-[760px] bg-white px-6 py-8 text-[13px] leading-relaxed text-ink print:max-w-none print:px-0 print:py-0">
      <PrintToolbar />

      {/* 표지 */}
      <header className="flex flex-col items-center border-b border-line pb-8 pt-6 text-center">
        <CharacterFace id="mongle" size={72} />
        <p className="pt-3 font-display text-3xl text-accent-text">온기노트</p>
        <h1 className="pt-1 font-display text-xl">{nickname}의 기록</h1>
        <dl className="mt-4 grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-xs text-muted">
          <dt>이메일</dt>
          <dd className="text-left">{userData.user?.email}</dd>
          <dt>내려받은 날</dt>
          <dd className="text-left">{kDate(new Date().toISOString(), true)}</dd>
          <dt>담긴 기록</dt>
          <dd className="text-left">사람 {persons.length}명 · 상담 {sessions.length}개</dd>
        </dl>
        <p className="mt-5 rounded-xl bg-cream px-4 py-2 text-xs text-ink-soft">
          이 문서에는 민감한 개인 이야기가 담겨 있어요. 보관하거나 공유할 때 주의해 주세요.
        </p>
      </header>

      {/* 사람들 */}
      <section className="pt-8">
        <h2 className="font-display text-xl">내 사람들</h2>
        {persons.length === 0 && <p className="pt-2 text-muted">등록한 사람이 없어요.</p>}
        <div className="mt-3 flex flex-col gap-3">
          {persons.map((p) => (
            <PersonBlock key={p.id} p={p} />
          ))}
        </div>
      </section>

      {/* 상담 */}
      <section className="pt-8 print:break-before-page print:pt-0">
        <h2 className="font-display text-xl">상담 기록</h2>
        {sessions.length === 0 && <p className="pt-2 text-muted">상담 기록이 없어요.</p>}
        {sessions.map((s, si) => {
          const ch = CHARACTERS[s.characterId];
          const who = s.personId ? personName.get(s.personId) : null;
          return (
            <article
              key={s.id}
              className={`mt-5 border-t border-line pt-5 ${si === 0 ? "print:border-0 print:pt-0" : "print:break-before-page print:mt-0 print:border-0 print:pt-0"}`}
            >
              <header className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: ch.tint }}>
                  <CharacterFace id={s.characterId} size={34} />
                </span>
                <div>
                  <h3 className="font-display text-lg leading-tight">{s.summary?.title ?? `${ch.name}와의 상담`}</h3>
                  <p className="text-xs text-muted">
                    {kDate(s.createdAt)} · {ch.name}({ch.species}){who ? ` · ${who} 이야기` : ""}
                  </p>
                </div>
              </header>

              {s.summary && (
                <div className="mt-3 rounded-2xl bg-cream p-4 print:break-inside-avoid">
                  <p className="text-xs font-bold text-accent-text">정리 카드</p>
                  <Field label="상황">{s.summary.situation}</Field>
                  <Field label="해석">{s.summary.interpretation}</Field>
                  {s.summary.todo.length > 0 && (
                    <Field label="할 것">
                      <ul className="list-none">
                        {s.summary.todo.map((t, i) => (
                          <li key={i}>{s.summary?.todoDone?.[i] ? "☑" : "☐"} {t}</li>
                        ))}
                      </ul>
                    </Field>
                  )}
                  {s.summary.dont.length > 0 && (
                    <Field label="하지 말 것">
                      <ul className="list-disc pl-4">
                        {s.summary.dont.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </Field>
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-col gap-2">
                {s.messages.map((m, i) => {
                  const mine = m.role === "user";
                  const imgs = messageImages(m);
                  return (
                    <div key={i} className={`flex flex-col print:break-inside-avoid ${mine ? "items-end" : "items-start"}`}>
                      <span className="px-1 text-[10px] text-muted">
                        {mine ? nickname : ch.name} · {kDate(m.at, true)}
                      </span>
                      {imgs.length > 0 && (
                        <div className="flex flex-wrap justify-end gap-1.5 py-1">
                          {imgs.map((img, j) =>
                            img.url ? (
                              // 서명 URL(1시간)이라 next/image 대신 img
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={j} src={img.url} alt="첨부한 사진" className="max-h-56 max-w-[220px] rounded-lg border border-line object-contain" />
                            ) : (
                              <span key={j} className="rounded-lg border border-dashed border-line-strong px-3 py-2 text-xs text-muted">사진을 불러오지 못했어요</span>
                            ),
                          )}
                        </div>
                      )}
                      {(mine ? [m.text] : splitBubbles(m.text)).filter(Boolean).map((t, j) => (
                        <p
                          key={j}
                          className={`mt-0.5 max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 ${
                            mine ? "rounded-br-md bg-peach" : "rounded-bl-md border border-line bg-white"
                          }`}
                        >
                          <Bold text={t} />
                        </p>
                      ))}
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </section>

      <footer className="mt-10 border-t border-line pt-4 text-center text-[11px] text-muted">
        온기노트 · 캐릭터 답변은 AI가 만든 내용이라 틀릴 수 있어요.
      </footer>
    </main>
  );
}

/** 답변 속 **굵게** 표시를 실제 굵은 글씨로 바꾼다 */
function Bold({ text }: { text: string }) {
  return text.split(/(\*\*[^*\n]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <b key={i}>{part.slice(2, -2)}</b> : part,
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pt-2">
      <p className="text-[11px] font-bold text-muted">{label}</p>
      <div className="whitespace-pre-wrap">{children}</div>
    </div>
  );
}

function PersonBlock({ p }: { p: Person }) {
  const rows: [string, string | undefined][] = [
    ["관계", p.relation],
    ["MBTI", p.mbti],
    ["나이", p.age],
    ["생일", birthdayLabel(p.birthday) ?? undefined],
    ["연락 스타일", p.contactStyle],
    ["좋아하는 것", p.likes.join(", ") || undefined],
    ["싫어하는 것", p.dislikes.join(", ") || undefined],
    ["성격 메모", p.notes.join(" / ") || undefined],
  ];
  return (
    <div className="rounded-2xl border border-line p-4 print:break-inside-avoid">
      <p className="font-display text-lg">{p.name}</p>
      <dl className="mt-1 grid grid-cols-[88px_1fr] gap-y-0.5">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>
      {p.timeline.length > 0 && (
        <div className="pt-2">
          <p className="text-[11px] font-bold text-muted">우리 이야기</p>
          <ul className="list-none">
            {p.timeline.map((t, i) => (
              <li key={i}>
                <span className="text-muted">{t.date}</span> {t.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
