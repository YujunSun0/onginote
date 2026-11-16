"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { ReportCheckout } from "@/components/ReportCheckout";
import { BackIcon } from "@/components/Icons";
import { CHARACTERS } from "@/lib/characters";
import { josa } from "@/lib/format";
import { LOVE_TYPES, REPORT_UNLOCK_SESSIONS, isFullReport, type PersonalityReport, type ReportView } from "@/lib/report-types";
import { drawShareCard, shareOrSave } from "@/lib/share-card";

interface Progress {
  canCreate: boolean;
  remaining: number;
  summarized: number;
}
interface Data {
  progress: Progress;
  report: ReportView | null;
  price: number;
}

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

export default function ReportPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/reports", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setLoadError(true));
  }
  useEffect(load, []);

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "리포트를 만들지 못했어요.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "리포트를 만들지 못했어요.");
    } finally {
      setCreating(false);
    }
  }

  const report = data?.report ?? null;
  return (
    <main className="px-5 pb-32 pt-4 lg:mx-auto lg:max-w-3xl lg:px-10 lg:pb-12 lg:pt-7">
      <div className="flex items-center gap-1">
        <Link href="/me" aria-label="마이페이지로" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-peach">
          <BackIcon size={22} />
        </Link>
        <h1 className="font-display text-[22px]">나의 연애 성향 리포트</h1>
      </div>

      {loadError && <p className="mt-6 text-sm text-danger">정보를 불러오지 못했어요. 새로고침해 주세요.</p>}
      {!data && !loadError && <p className="mt-6 text-sm text-muted">불러오는 중…</p>}
      {error && <p className="mt-4 rounded-xl bg-cream px-3 py-2 text-sm text-danger">{error}</p>}

      {data && creating && <Creating />}
      {data && !creating && !report && <Intro progress={data.progress} price={data.price} onCreate={create} />}
      {data && !creating && report && (
        <div className="mt-4 flex flex-col gap-4">
          <TypeCard report={report} />
          <Emotions report={report} />
          {isFullReport(report.content) ? <FullSections content={report.content} report={report} /> : <Locked report={report} price={data.price} />}
          {data.progress.canCreate && (
            <section className="rounded-3xl border border-dashed border-line-strong bg-white p-5 text-center">
              <p className="font-bold">상담이 더 쌓였어요</p>
              <p className="pt-1 text-sm text-ink-soft">지금까지의 상담으로 새 리포트를 만들 수 있어요.</p>
              <button onClick={create} className="mt-3 h-11 rounded-full border border-line-strong px-5 text-sm font-bold">
                새 리포트 만들기
              </button>
            </section>
          )}
          {!data.progress.canCreate && (
            <p className="text-center text-xs text-muted">정리한 상담이 {data.progress.remaining}개 더 쌓이면 새 리포트를 만들 수 있어요.</p>
          )}
        </div>
      )}
      <BottomNav />
    </main>
  );
}

/** 아직 리포트가 없을 때: 진행도 또는 만들기 */
function Intro({ progress, price, onCreate }: { progress: Progress; price: number; onCreate: () => void }) {
  const done = Math.min(progress.summarized, REPORT_UNLOCK_SESSIONS);
  return (
    <section className="mt-4 rounded-3xl bg-ink p-6 text-white">
      <p className="text-xs font-bold text-peach-deep">나의 연애 성향 리포트</p>
      <h2 className="pt-2 font-display text-[24px] leading-snug">
        내 상담을 읽고 찾은
        <br />
        나의 연애 유형
      </h2>
      <p className="pt-2 text-sm text-white/75">
        고민할 때 자주 나오는 감정, 관계에서 중요하게 여기는 것, 불안할 때의 패턴과 나의 강점까지. 내가 실제로 한 말을 근거로 정리해요.
      </p>
      <div className="mt-5 flex gap-1.5" aria-label={`정리한 상담 ${done}/${REPORT_UNLOCK_SESSIONS}개`}>
        {Array.from({ length: REPORT_UNLOCK_SESSIONS }, (_, i) => (
          <span key={i} className={`h-2 flex-1 rounded-full ${i < done ? "bg-bubble" : "bg-white/15"}`} />
        ))}
      </div>
      {progress.canCreate ? (
        <>
          <p className="pt-2 text-sm">정리한 상담이 {progress.summarized}개 모였어요. 리포트를 만들 수 있어요!</p>
          <button onClick={onCreate} className="mt-4 h-12 w-full rounded-2xl bg-accent font-bold text-white">
            무료로 미리보기 만들기
          </button>
          <p className="pt-2 text-center text-[11px] text-white/60">유형 카드와 첫 항목은 무료 · 전체 리포트는 {won(price)}</p>
        </>
      ) : (
        <>
          <p className="pt-2 text-sm">
            리포트까지 <b>정리한 상담 {progress.remaining}개</b> 남았어요.
          </p>
          <Link href="/new" className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-accent font-bold text-white">
            상담하러 가기
          </Link>
          <p className="pt-2 text-center text-[11px] text-white/60">상담이 끝나면 &lsquo;정리하기&rsquo;를 눌러 정리 카드를 남겨 주세요.</p>
        </>
      )}
    </section>
  );
}

function Creating() {
  return (
    <section className="mt-6 rounded-3xl bg-white p-8 text-center">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-peach border-t-accent" aria-hidden />
      <p className="pt-4 font-bold">지금까지의 상담을 읽고 있어요</p>
      <p className="pt-1 text-sm text-muted">1분 정도 걸릴 수 있어요. 화면을 닫지 말아 주세요.</p>
    </section>
  );
}

/** 공유 카드 (화면용). 이미지는 share-card.ts 가 같은 내용으로 그린다 */
function TypeCard({ report }: { report: ReportView }) {
  const c = report.content;
  const type = LOVE_TYPES[c.type];
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function share() {
    setBusy(true);
    setNote(null);
    try {
      const blob = await drawShareCard(c, report.characterId);
      const r = await shareOrSave(blob, `나의 연애 유형: ${type.name}`);
      if (r === "saved") setNote("이미지를 저장했어요.");
    } catch {
      setNote("이미지를 만들지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl p-3" style={{ backgroundColor: type.color }}>
      <div className="rounded-[20px] bg-cream px-5 pb-6 pt-5 text-center">
        <Image src={`/characters/${report.characterId}.png`} alt="" width={96} height={96} className="mx-auto" />
        <p className="pt-2 text-xs text-muted">나의 연애 유형</p>
        <p className="pt-1 font-display text-[28px] leading-tight" style={{ color: type.color }}>
          {type.emoji} {type.name}
        </p>
        <p className="pt-3 font-bold leading-snug">{c.headline}</p>
        <div className="flex flex-wrap justify-center gap-1.5 pt-3">
          {c.keywords.map((k) => (
            <span key={k} className="rounded-full bg-peach px-3 py-1 font-display text-sm text-accent-text">
              #{k}
            </span>
          ))}
        </div>
        <p className="pt-3 text-xs text-ink-soft">{type.desc}</p>
      </div>
      <button onClick={share} disabled={busy} className="mt-3 h-11 w-full rounded-2xl bg-white/95 text-sm font-bold text-ink disabled:opacity-60">
        {busy ? "이미지 만드는 중…" : "카드 이미지로 공유하기"}
      </button>
      {note && <p className="pt-2 text-center text-xs text-white">{note}</p>}
      <p className="pt-1.5 text-center text-[11px] text-white/80">카드에는 상담 내용이 들어가지 않아요</p>
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-white p-5">
      <h2 className="pb-3 font-display text-lg">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Evidence({ text }: { text: string }) {
  return <p className="mt-1.5 rounded-xl bg-cream px-3 py-2 text-xs leading-relaxed text-ink-soft">💬 {text}</p>;
}

function Emotions({ report }: { report: ReportView }) {
  return (
    <Section title="고민할 때 자주 나오는 감정">
      {report.content.emotions.map((e, i) => (
        <div key={e.name}>
          <p className="font-bold">
            <span className="mr-1.5 text-accent">{i + 1}</span>
            {e.name}
          </p>
          <p className="pt-0.5 text-sm text-ink-soft">{e.desc}</p>
          <Evidence text={e.evidence} />
        </div>
      ))}
    </Section>
  );
}

function FullSections({ content, report }: { content: PersonalityReport; report: ReportView }) {
  const character = CHARACTERS[report.characterId];
  return (
    <>
      <Section title="관계에서 중요하게 여기는 것">
        {content.values.map((v) => (
          <div key={v.title}>
            <p className="font-bold">{v.title}</p>
            <p className="pt-0.5 text-sm text-ink-soft">{v.desc}</p>
            <Evidence text={v.evidence} />
          </div>
        ))}
      </Section>
      <Section title="불안하거나 갈등이 생길 때">
        {content.patterns.map((p) => (
          <div key={p.situation}>
            <p className="font-bold">{p.situation}</p>
            <p className="pt-0.5 text-sm text-ink-soft">→ {p.reaction}</p>
            <Evidence text={p.evidence} />
          </div>
        ))}
      </Section>
      <Section title="나의 연애 강점">
        {content.strengths.map((s) => (
          <div key={s.title} className="flex gap-3">
            <span aria-hidden>✨</span>
            <div>
              <p className="font-bold">{s.title}</p>
              <p className="pt-0.5 text-sm text-ink-soft">{s.desc}</p>
            </div>
          </div>
        ))}
      </Section>
      <Section title="자주 걸려 넘어지는 지점">
        {content.stumbles.map((s) => (
          <div key={s.title}>
            <p className="font-bold">{s.title}</p>
            <p className="pt-0.5 text-sm text-ink-soft">{s.desc}</p>
            <p className="mt-1.5 rounded-xl bg-teal-bg px-3 py-2 text-sm text-teal">
              <b>이렇게 해 봐요</b> · {s.tryThis}
            </p>
          </div>
        ))}
      </Section>
      <section className="flex gap-3 rounded-3xl bg-peach p-5">
        <Image src={`/characters/${report.characterId}.png`} alt="" width={52} height={52} className="h-[52px] w-[52px] shrink-0" />
        <div>
          <p className="text-xs font-bold text-accent-text">{josa(character.name, "이", "가")} 하는 말</p>
          <p className="pt-1 text-sm leading-relaxed">{content.characterNote}</p>
        </div>
      </section>
      <p className="text-center text-[11px] leading-relaxed text-muted">
        이 리포트는 상담 내용을 바탕으로 AI가 쓴 관찰이에요. 심리 검사나 진단이 아니에요.
        {report.orderId && (
          <>
            {" "}
            ·{" "}
            <Link href={`/plus/receipt/${encodeURIComponent(report.orderId)}`} className="underline">
              결제 내역
            </Link>
          </>
        )}
      </p>
    </>
  );
}

const LOCKED = ["관계에서 중요하게 여기는 것", "불안하거나 갈등이 생길 때", "나의 연애 강점", "자주 걸려 넘어지는 지점", "캐릭터의 한마디"];

/** 결제 전: 나머지 항목은 제목만 보이고 내용은 흐린 자리표시 (실제 내용은 서버가 보내지 않는다) */
function Locked({ report, price }: { report: ReportView; price: number }) {
  return (
    <ReportCheckout
      reportId={report.id}
      price={price}
      lockedTitles={LOCKED}
      pitch="남은 5개 항목을 열어요. 내가 실제로 한 말을 근거로, 다음에 해볼 만한 행동까지 담겨 있어요."
      backPath="/report"
    />
  );
}
