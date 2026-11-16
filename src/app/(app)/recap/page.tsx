"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { BackIcon } from "@/components/Icons";
import { CHARACTERS } from "@/lib/characters";
import { josa } from "@/lib/format";
import {
  RECAP_SEASON,
  TIME_BUCKETS,
  TIME_BUCKET_IDS,
  WANTS,
  type RecapProgress,
  type RecapState,
  type RecapView,
  type Want,
} from "@/lib/recap-types";
import { drawRecapCard, shareOrSave } from "@/lib/share-card";

interface Data {
  state: RecapState;
  need: { sessions: number; days: number };
  progress: RecapProgress;
  recap: RecapView | null;
  canRefresh: boolean;
  collecting: boolean;
}

function dayLabel(day: string) {
  const [, m, d] = day.split("-").map(Number);
  return `${m}월 ${d}일`;
}
const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

export default function RecapPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/recap", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setLoadError(true));
  }
  useEffect(load, []);

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/recap", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "결산을 만들지 못했어요.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "결산을 만들지 못했어요.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="break-keep px-5 pb-32 pt-4 lg:mx-auto lg:max-w-xl lg:px-10 lg:pb-12 lg:pt-7">
      <div className="flex items-center gap-1">
        <Link href="/" aria-label="홈으로" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-peach">
          <BackIcon size={22} />
        </Link>
        <h1 className="font-display text-[22px]">{RECAP_SEASON.title}</h1>
      </div>

      {loadError && <p className="mt-6 text-sm text-danger">정보를 불러오지 못했어요. 새로고침해 주세요.</p>}
      {!data && !loadError && <p className="mt-6 text-sm text-muted">불러오는 중…</p>}
      {error && <p className="mt-4 rounded-xl bg-cream px-3 py-2 text-sm text-danger">{error}</p>}

      {data && creating && <Creating />}
      {data && !creating && data.recap && (data.state !== "before") && (
        <>
          <Slides recap={data.recap} />
          {data.canRefresh && data.state === "open" && (
            <section className="mt-4 rounded-3xl border border-dashed border-line-strong bg-white p-5 text-center">
              <p className="font-bold">상담이 더 쌓였어요</p>
              <p className="pt-1 text-sm text-ink-soft">12월 31일까지의 새 기록으로 결산을 다시 만들 수 있어요.</p>
              <button onClick={create} className="mt-3 h-11 rounded-full border border-line-strong px-5 text-sm font-bold">
                새 기록으로 다시 만들기
              </button>
            </section>
          )}
        </>
      )}
      {data && !creating && (!data.recap || data.state === "before") && <Gate data={data} onCreate={create} />}
      <BottomNav />
    </main>
  );
}

/** 아직 결산이 없을 때: 열리기 전, 조건 진행도, 만들기, 마감 */
function Gate({ data, onCreate }: { data: Data; onCreate: () => void }) {
  const { progress, need, state } = data;
  const rows: [string, number, number][] = [
    ["상담", Math.min(progress.sessions, need.sessions), need.sessions],
    ["대화한 날", Math.min(progress.days, need.days), need.days],
  ];
  return (
    <section className="mt-4 rounded-3xl bg-accent p-6 text-white">
      <p className="text-xs font-bold text-peach">무료 · 12월 15일 ~ 1월 31일</p>
      <h2 className="pt-2 font-display text-[26px] leading-snug">
        온기노트와 함께한
        <br />첫 겨울을 돌아봐요
      </h2>
      <p className="pt-2 text-sm text-white/85">
        내가 고민하는 시간, 자주 나온 고민, 해낸 일, 그리고 캐릭터가 보내는 편지까지. 12월 31일까지의 상담으로 만들어요.
      </p>

      {state === "closed" ? (
        <p className="mt-5 rounded-2xl bg-white/15 px-4 py-3 text-sm">이번 결산은 마감됐어요. 다음 결산에서 만나요.</p>
      ) : (
        <>
          <dl className="mt-5 space-y-3">
            {rows.map(([label, n, max]) => (
              <div key={label}>
                <div className="flex justify-between text-sm">
                  <dt>{label}</dt>
                  <dd className="font-bold tabular-nums">
                    {n}/{max}
                    {label === "상담" ? "개" : "일"}
                  </dd>
                </div>
                <div className="mt-1.5 flex gap-1" aria-hidden>
                  {Array.from({ length: max }, (_, i) => (
                    <span key={i} className={`h-2 flex-1 rounded-full ${i < n ? "bg-white" : "bg-white/25"}`} />
                  ))}
                </div>
              </div>
            ))}
          </dl>
          {progress.ok ? (
            state === "open" ? (
              <button onClick={onCreate} className="mt-5 h-12 w-full rounded-2xl bg-white font-bold text-accent-text">
                내 결산 보기
              </button>
            ) : (
              <p className="mt-5 rounded-2xl bg-white/15 px-4 py-3 text-sm">조건을 다 채웠어요! 12월 15일에 열려요.</p>
            )
          ) : data.collecting ? (
            <>
              <p className="pt-4 text-sm">
                상담 {need.sessions}개, 대화한 날 {need.days}일이 모이면 볼 수 있어요.
              </p>
              <Link href="/new" className="mt-3 flex h-12 w-full items-center justify-center rounded-2xl bg-white font-bold text-accent-text">
                상담하러 가기
              </Link>
            </>
          ) : (
            <p className="mt-5 rounded-2xl bg-white/15 px-4 py-3 text-sm">12월 31일까지의 기록으로 만드는 결산이라, 이번에는 조건을 채우지 못했어요.</p>
          )}
        </>
      )}
    </section>
  );
}

function Creating() {
  return (
    <section className="mt-6 rounded-3xl bg-white p-8 text-center">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-peach border-t-accent" aria-hidden />
      <p className="pt-4 font-bold">한 해의 상담을 모으고 있어요</p>
      <p className="pt-1 text-sm text-muted">잠깐이면 돼요.</p>
    </section>
  );
}

/** 한 장씩 넘겨 보는 결산. 데이터가 없는 장은 건너뛴다 */
function Slides({ recap }: { recap: RecapView }) {
  const s = recap.stats;
  const character = CHARACTERS[s.character.id];
  const slides: { key: string; bg: string; node: React.ReactNode }[] = [
    {
      key: "cover",
      bg: "bg-accent text-white",
      node: (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <Image src={`/characters/${s.character.id}.png`} alt="" width={120} height={120} />
          <p className="pt-4 text-sm text-white/80">{RECAP_SEASON.title}</p>
          <p className="pt-2 font-display text-[30px] leading-snug">
            온기노트와 함께한
            <br />첫 겨울
          </p>
          <p className="pt-3 text-sm text-white/80">옆으로 넘기며 돌아봐요</p>
        </div>
      ),
    },
    {
      key: "time",
      bg: "bg-peach",
      node: (
        <Center>
          <Kicker>{dayLabel(s.firstDay)}, 처음 이야기했어요</Kicker>
          <Big>
            상담 {s.sessions}개
            <br />
            대화한 날 {s.activeDays}일
          </Big>
          {s.longestDay && (
            <Note>
              가장 길게 이야기한 날은 {dayLabel(s.longestDay.day)}이에요. 그날 메시지를 {s.longestDay.messages}개 보냈어요.
            </Note>
          )}
        </Center>
      ),
    },
  ];
  if (s.topPerson) {
    slides.push({
      key: "person",
      bg: "bg-teal text-white",
      node: (
        <Center>
          <Kicker light>가장 많이 이야기한 사람</Kicker>
          <Big>{recap.topPersonName ?? s.topPerson.relation ?? "소중한 사람"}</Big>
          {s.topPerson.relation && <span className="mt-3 rounded-full bg-white/20 px-3 py-1 text-sm font-bold">{s.topPerson.relation}</span>}
          <Note light>
            {s.topPerson.sessions}번의 상담에서 이 사람 이야기를 했어요.
            {s.people > 1 ? ` 모두 ${s.people}명의 이야기를 나눴어요.` : ""}
          </Note>
        </Center>
      ),
    });
  }
  const hourTotal = TIME_BUCKET_IDS.reduce((n, b) => n + s.hours[b], 0);
  slides.push({
    key: "hours",
    bg: "bg-white",
    node: (
      <Center>
        <Kicker>내가 고민하는 시간</Kicker>
        <Big>{TIME_BUCKETS[s.topBucket].label}</Big>
        <Note>
          {TIME_BUCKETS[s.topBucket].name}({TIME_BUCKETS[s.topBucket].range})에 보낸 메시지가 {pct(s.hours[s.topBucket], hourTotal)}%예요.
        </Note>
        <Bars
          rows={TIME_BUCKET_IDS.map((b) => ({ label: TIME_BUCKETS[b].name, value: pct(s.hours[b], hourTotal), strong: b === s.topBucket }))}
        />
      </Center>
    ),
  });
  const wantTotal = s.wants.listen + s.wants.think + s.wants.plan;
  if (wantTotal > 0) {
    const top = (Object.keys(WANTS) as Want[]).reduce((a, b) => (s.wants[b] > s.wants[a] ? b : a));
    slides.push({
      key: "wants",
      bg: "bg-cream",
      node: (
        <Center>
          <Kicker>내가 가장 많이 원했던 것</Kicker>
          <Big>
            {WANTS[top].emoji} {WANTS[top].name}
          </Big>
          <Bars rows={(Object.keys(WANTS) as Want[]).map((w) => ({ label: WANTS[w].name, value: pct(s.wants[w], wantTotal), strong: w === top }))} wide />
        </Center>
      ),
    });
  }
  if (recap.topics.length) {
    slides.push({
      key: "topics",
      bg: "bg-peach",
      node: (
        <Center>
          <Kicker>자주 나온 고민</Kicker>
          <ol className="mt-4 w-full space-y-2.5">
            {recap.topics.map((t, i) => (
              <li key={t.name} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left">
                <span className="font-display text-2xl text-accent">{i + 1}</span>
                <span className="flex-1 font-display text-xl">{t.name}</span>
                <span className="text-sm text-muted tabular-nums">{t.count}번</span>
              </li>
            ))}
          </ol>
        </Center>
      ),
    });
  }
  if (s.todos.total > 0) {
    slides.push({
      key: "todos",
      bg: "bg-teal-bg",
      node: (
        <Center>
          <Kicker>정리 카드에서 정한 할 일</Kicker>
          <Big>
            {s.todos.total}개 중 {s.todos.done}개를
            <br />
            해봤어요
          </Big>
          <Note>
            {s.todos.done > 0 ? "고민만 하지 않고 직접 움직여 봤어요. 그게 제일 어려운 일이에요." : "해본 일은 홈의 '상담에서 정한 할 일'에서 체크할 수 있어요."}
          </Note>
        </Center>
      ),
    });
  }
  slides.push(
    {
      key: "letter",
      bg: "bg-white",
      node: (
        <Center>
          <Image src={`/characters/${s.character.id}.png`} alt="" width={84} height={84} />
          <Kicker>
            {josa(character.name, "이", "가")} 보내는 편지 · 상담 {s.character.sessions}번을 함께했어요
          </Kicker>
          <p className="mt-3 whitespace-pre-line rounded-2xl bg-cream px-4 py-4 text-left text-[15px] leading-relaxed">{recap.letter}</p>
        </Center>
      ),
    },
    { key: "share", bg: "bg-accent text-white", node: <ShareSlide recap={recap} /> },
    {
      key: "next",
      bg: "bg-cream",
      node: (
        <Center>
          <Kicker>내년에도 함께해요</Kicker>
          <p className="pt-2 font-display text-2xl leading-snug">더 깊이 알고 싶다면</p>
          <div className="mt-4 w-full space-y-2.5 text-left">
            <Link href="/report" className="block rounded-2xl bg-white px-4 py-3 hover:bg-peach">
              <span className="block font-bold">🔍 나의 연애 성향 리포트</span>
              <span className="block text-sm text-ink-soft">내 상담으로 찾은 나의 연애 유형</span>
            </Link>
            <Link href="/people" className="block rounded-2xl bg-white px-4 py-3 hover:bg-peach">
              <span className="block font-bold">🌤️ 관계 흐름 리포트</span>
              <span className="block text-sm text-ink-soft">한 사람과 나, 지금 어디쯤 와 있을까</span>
            </Link>
          </div>
        </Center>
      ),
    },
  );

  const [i, setI] = useState(0);
  const at = Math.min(i, slides.length - 1);
  const go = (d: number) => setI((n) => Math.max(0, Math.min(slides.length - 1, n + d)));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const slide = slides[at];

  return (
    <section className="mt-4" aria-roledescription="슬라이드" aria-label={`${at + 1} / ${slides.length}`}>
      <div className="flex gap-1 pb-3" aria-hidden>
        {slides.map((x, n) => (
          <span key={x.key} className={`h-1 flex-1 rounded-full ${n <= at ? "bg-accent" : "bg-line"}`} />
        ))}
      </div>
      <div className={`relative flex min-h-[460px] flex-col rounded-[28px] p-6 ${slide.bg}`} aria-live="polite">
        {slide.node}
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={() => go(-1)} disabled={at === 0} className="h-12 flex-1 rounded-full border border-line-strong bg-white font-bold text-ink-soft disabled:opacity-40">
          이전
        </button>
        <button
          onClick={() => go(1)}
          disabled={at === slides.length - 1}
          className="h-12 flex-[2] rounded-full bg-accent font-bold text-white disabled:opacity-40"
        >
          {at === slides.length - 1 ? "끝" : "다음"}
        </button>
      </div>
    </section>
  );
}

function ShareSlide({ recap }: { recap: RecapView }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  async function share() {
    setBusy(true);
    setNote(null);
    try {
      const blob = await drawRecapCard(recap);
      const r = await shareOrSave(blob, RECAP_SEASON.title, "onginote-2026-recap.png");
      if (r === "saved") setNote("이미지를 저장했어요.");
    } catch {
      setNote("이미지를 만들지 못했어요.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center text-center">
      <p className="text-sm text-white/80">올해의 한 줄</p>
      <p className="pt-3 font-display text-[28px] leading-snug">{recap.headline}</p>
      <p className="pt-3 text-sm text-white/80">{TIME_BUCKETS[recap.stats.topBucket].label}</p>
      <button onClick={share} disabled={busy} className="mt-6 h-12 w-full rounded-2xl bg-white font-bold text-accent-text disabled:opacity-60">
        {busy ? "이미지 만드는 중…" : "결산 카드 공유하기"}
      </button>
      {note && <p className="pt-2 text-xs">{note}</p>}
      <p className="pt-2 text-[11px] text-white/80">카드에는 이름과 상담 내용이 들어가지 않아요</p>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full flex-1 flex-col items-center justify-center text-center">{children}</div>;
}
function Kicker({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return <p className={`pt-2 text-sm font-bold ${light ? "text-white/80" : "text-muted"}`}>{children}</p>;
}
function Big({ children }: { children: React.ReactNode }) {
  return <p className="pt-3 font-display text-[32px] leading-tight">{children}</p>;
}
function Note({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return <p className={`pt-4 text-sm leading-relaxed ${light ? "text-white/85" : "text-ink-soft"}`}>{children}</p>;
}

/** 한 계열 가로 막대 (값은 % 로, 글자에도 같이 적는다) */
function Bars({ rows, wide }: { rows: { label: string; value: number; strong: boolean }[]; wide?: boolean }) {
  return (
    <dl className="mt-5 w-full space-y-2 text-left text-sm">
      {rows.map((r) => (
        <div key={r.label} className={`grid items-center gap-2 ${wide ? "grid-cols-[136px_1fr_40px]" : "grid-cols-[40px_1fr_40px]"}`}>
          <dt className={r.strong ? "font-bold" : "text-ink-soft"}>{r.label}</dt>
          <dd className="h-3 overflow-hidden rounded-full bg-line">
            <span className={`block h-full rounded-full ${r.strong ? "bg-accent" : "bg-teal"}`} style={{ width: `${Math.max(r.value, r.value > 0 ? 3 : 0)}%` }} />
          </dd>
          <dd className="text-right font-bold tabular-nums">{r.value}%</dd>
        </div>
      ))}
    </dl>
  );
}
