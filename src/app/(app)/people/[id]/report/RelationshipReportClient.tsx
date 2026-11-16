"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { BackIcon } from "@/components/Icons";
import { ReportCheckout } from "@/components/ReportCheckout";
import { CHARACTERS } from "@/lib/characters";
import { josa } from "@/lib/format";
import {
  RELATIONSHIP_UNLOCK_SESSIONS,
  WEATHERS,
  isFullRelationship,
  type RelationshipPreview,
  type RelationshipReport,
  type RelationshipView,
} from "@/lib/report-types";
import { drawRelationshipCard, shareOrSave } from "@/lib/share-card";

interface Progress {
  canCreate: boolean;
  remaining: number;
  summarized: number;
}
interface Data {
  person: { id: string; name: string; relation: string };
  progress: Progress;
  report: RelationshipView | null;
  price: number;
  hasPersonality: boolean;
}

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const LOCKED = ["관계의 흐름", "이 사람과 반복되는 고민", "해봤던 것과 그 뒤", "이 사람 앞에서의 나", "지금 해볼 만한 것", "캐릭터의 한마디"];

function dayLabel(date: string) {
  const [, m, d] = date.split("-").map(Number);
  return `${m}/${d}`;
}

export default function RelationshipReportClient({ id }: { id: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch(`/api/persons/${id}/report`, { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 404) throw new Error("사람을 찾을 수 없어요.");
        if (!r.ok) throw new Error("정보를 불러오지 못했어요. 새로고침해 주세요.");
        return r.json();
      })
      .then(setData)
      .catch((e) => setLoadError(e instanceof Error ? e.message : "정보를 불러오지 못했어요."));
  }
  useEffect(load, [id]);

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/persons/${id}/report`, { method: "POST" });
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
        <Link href={`/people/${id}`} aria-label="사람 화면으로" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-peach">
          <BackIcon size={22} />
        </Link>
        <h1 className="font-display text-[22px]">{data ? `${josa(data.person.name, "과", "와")}의 관계 흐름` : "관계 흐름 리포트"}</h1>
      </div>

      {loadError && <p className="mt-6 text-sm text-danger">{loadError}</p>}
      {!data && !loadError && <p className="mt-6 text-sm text-muted">불러오는 중…</p>}
      {error && <p className="mt-4 rounded-xl bg-cream px-3 py-2 text-sm text-danger">{error}</p>}

      {data && creating && <Creating name={data.person.name} />}
      {data && !creating && !report && <Intro data={data} onCreate={create} />}
      {data && !creating && report && (
        <div className="mt-4 flex flex-col gap-4">
          <FlowCard report={report} relation={data.person.relation} />
          {isFullRelationship(report.content) ? (
            <FullSections content={report.content} report={report} hasPersonality={data.hasPersonality} />
          ) : (
            <ReportCheckout
              reportId={report.id}
              price={data.price}
              lockedTitles={LOCKED}
              pitch={`남은 6개 항목을 열어요. ${data.person.name}님과의 흐름을 시기별로 나누고, 내가 실제로 한 말을 근거로 지금 해볼 만한 것까지 담겨 있어요.`}
              backPath={`/people/${id}/report`}
            />
          )}
          {data.progress.canCreate ? (
            <section className="rounded-3xl border border-dashed border-line-strong bg-white p-5 text-center">
              <p className="font-bold">상담이 더 쌓였어요</p>
              <p className="pt-1 text-sm text-ink-soft">지금까지의 상담으로 새 리포트를 만들 수 있어요.</p>
              <button onClick={create} className="mt-3 h-11 rounded-full border border-line-strong px-5 text-sm font-bold">
                새 리포트 만들기
              </button>
            </section>
          ) : (
            <p className="text-center text-xs text-muted">
              {data.person.name}님과 정리한 상담이 {data.progress.remaining}개 더 쌓이면 새 리포트를 만들 수 있어요.
            </p>
          )}
        </div>
      )}
      <BottomNav />
    </main>
  );
}

/** 아직 리포트가 없을 때: 진행도 또는 만들기 */
function Intro({ data, onCreate }: { data: Data; onCreate: () => void }) {
  const { progress, person, price } = data;
  const done = Math.min(progress.summarized, RELATIONSHIP_UNLOCK_SESSIONS);
  return (
    <section className="mt-4 rounded-3xl bg-teal p-6 text-white">
      <p className="text-xs font-bold text-teal-bg">관계 흐름 리포트</p>
      <h2 className="pt-2 font-display text-[24px] leading-snug">
        {josa(person.name, "과", "와")} 나,
        <br />
        지금 어디쯤 와 있을까
      </h2>
      <p className="pt-2 text-sm text-white/80">
        {person.name}님 얘기를 할 때마다 내 마음이 어땠는지, 관계가 어떻게 흘러왔는지, 반복되는 고민과 해봤던 것까지. 내가 실제로 한 말을 근거로 정리해요.
      </p>
      <div className="mt-5 flex gap-1.5" aria-label={`정리한 상담 ${done}/${RELATIONSHIP_UNLOCK_SESSIONS}개`}>
        {Array.from({ length: RELATIONSHIP_UNLOCK_SESSIONS }, (_, i) => (
          <span key={i} className={`h-2 flex-1 rounded-full ${i < done ? "bg-peach" : "bg-white/20"}`} />
        ))}
      </div>
      {progress.canCreate ? (
        <>
          <p className="pt-2 text-sm">
            {person.name}님과 정리한 상담이 {progress.summarized}개 모였어요. 리포트를 만들 수 있어요!
          </p>
          <button onClick={onCreate} className="mt-4 h-12 w-full rounded-2xl bg-accent font-bold text-white">
            무료로 미리보기 만들기
          </button>
          <p className="pt-2 text-center text-[11px] text-white/70">한 줄 요약과 마음 날씨는 무료 · 전체 리포트는 {won(price)}</p>
        </>
      ) : (
        <>
          <p className="pt-2 text-sm">
            리포트까지 <b>{person.name}님과 정리한 상담 {progress.remaining}개</b> 남았어요.
          </p>
          <Link href={`/new?person=${person.id}`} className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-accent font-bold text-white">
            {person.name} 얘기 상담하기
          </Link>
          <p className="pt-2 text-center text-[11px] text-white/70">상담이 끝나면 &lsquo;정리하기&rsquo;를 눌러 정리 카드를 남겨 주세요.</p>
        </>
      )}
    </section>
  );
}

function Creating({ name }: { name: string }) {
  return (
    <section className="mt-6 rounded-3xl bg-white p-8 text-center">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-teal-bg border-t-teal" aria-hidden />
      <p className="pt-4 font-bold">{name}님과의 상담을 읽고 있어요</p>
      <p className="pt-1 text-sm text-muted">1분 정도 걸릴 수 있어요. 화면을 닫지 말아 주세요.</p>
    </section>
  );
}

/** 무료 미리보기 + 공유 카드: 한 줄, 키워드, 마음 날씨 흐름. 이미지는 share-card.ts 가 같은 내용으로 그린다 */
function FlowCard({ report, relation }: { report: RelationshipView; relation: string }) {
  const c: RelationshipPreview = report.content;
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function share() {
    setBusy(true);
    setNote(null);
    try {
      const blob = await drawRelationshipCard(c, report.characterId, relation);
      const r = await shareOrSave(blob, "우리의 관계 흐름", "onginote-relationship.png");
      if (r === "saved") setNote("이미지를 저장했어요.");
    } catch {
      setNote("이미지를 만들지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl bg-teal p-3">
      <div className="rounded-[20px] bg-cream px-5 pb-6 pt-5 text-center">
        <Image src={`/characters/${report.characterId}.png`} alt="" width={80} height={80} className="mx-auto" />
        <p className="pt-2 text-xs text-muted">우리의 관계 흐름</p>
        {relation && <span className="mt-1.5 inline-block rounded-full bg-teal px-3 py-1 font-display text-sm text-white">{relation}</span>}
        <p className="pt-3 font-display text-[22px] leading-snug">{c.headline}</p>
        <div className="flex flex-wrap justify-center gap-1.5 pt-3">
          {c.keywords.map((k) => (
            <span key={k} className="rounded-full bg-teal-bg px-3 py-1 font-display text-sm text-teal">
              #{k}
            </span>
          ))}
        </div>
        <Weather days={c.weather} />
      </div>
      <button onClick={share} disabled={busy} className="mt-3 h-11 w-full rounded-2xl bg-white/95 text-sm font-bold text-ink disabled:opacity-60">
        {busy ? "이미지 만드는 중…" : "카드 이미지로 공유하기"}
      </button>
      {note && <p className="pt-2 text-center text-xs text-white">{note}</p>}
      <p className="pt-1.5 text-center text-[11px] text-white/85">카드에는 이름과 상담 내용이 들어가지 않아요</p>
    </section>
  );
}

/** 상담마다의 내 마음 날씨 (오래된 순). 많으면 옆으로 넘겨 본다 */
function Weather({ days }: { days: RelationshipPreview["weather"] }) {
  if (!days.length) return null;
  return (
    <div className="mt-5 rounded-2xl bg-peach px-3 pb-3 pt-3 text-left">
      <p className="px-1 text-xs font-bold text-ink-soft">상담할 때마다 내 마음 날씨</p>
      <ol className="mt-2 flex gap-2 overflow-x-auto pb-1" aria-label="상담별 내 마음 날씨, 오래된 순">
        {days.map((d, i) => (
          <li key={`${d.date}-${i}`} className="flex w-[84px] shrink-0 flex-col items-center rounded-xl bg-white px-1.5 py-2.5 text-center">
            <span className="text-[28px] leading-none" aria-hidden>
              {WEATHERS[d.weather].emoji}
            </span>
            <span className="sr-only">{WEATHERS[d.weather].name}</span>
            <span className="pt-1 text-[11px] font-bold tabular-nums text-ink-soft">{dayLabel(d.date)}</span>
            <span className="pt-0.5 text-[11px] leading-snug text-muted">{d.note}</span>
          </li>
        ))}
      </ol>
    </div>
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

function FullSections({ content, report, hasPersonality }: { content: RelationshipReport; report: RelationshipView; hasPersonality: boolean }) {
  const character = CHARACTERS[report.characterId];
  return (
    <>
      <Section title="관계의 흐름">
        <ol className="relative space-y-4 border-l-2 border-teal-bg pl-4">
          {content.chapters.map((ch, i) => (
            <li key={`${ch.title}-${i}`} className="relative">
              <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-white bg-teal" aria-hidden />
              <p className="text-xs font-bold text-teal">{ch.period}</p>
              <p className="font-bold">{ch.title}</p>
              <p className="pt-0.5 text-sm text-ink-soft">{ch.desc}</p>
              <Evidence text={ch.evidence} />
            </li>
          ))}
        </ol>
      </Section>
      <Section title="이 사람과 반복되는 고민">
        {content.recurring.map((r, i) => (
          <div key={`${r.title}-${i}`}>
            <p className="font-bold">
              <span className="mr-1.5 text-accent">{i + 1}</span>
              {r.title}
            </p>
            <p className="pt-0.5 text-sm text-ink-soft">{r.desc}</p>
            <Evidence text={r.evidence} />
          </div>
        ))}
      </Section>
      <Section title="해봤던 것과 그 뒤">
        {content.tried.length ? (
          content.tried.map((t, i) => (
            <div key={`${t.action}-${i}`} className="rounded-2xl bg-teal-bg px-4 py-3">
              <p className="text-sm font-bold text-teal">✓ {t.action}</p>
              <p className="pt-1 text-sm text-ink-soft">→ {t.after}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-ink-soft">
            아직 정리 카드에서 정한 할 일을 해봤다고 체크한 게 없어요. 홈의 &lsquo;상담에서 정한 할 일&rsquo;에서 해본 것을 체크하면 다음 리포트에 담겨요.
          </p>
        )}
      </Section>
      <Section title="이 사람 앞에서의 나">
        <p className="text-sm text-ink-soft">{content.me.desc}</p>
        <Evidence text={content.me.evidence} />
        {content.me.differs ? (
          <p className="rounded-xl bg-peach px-3 py-2 text-sm">
            <b className="text-accent-text">평소의 나와 다른 점</b> · {content.me.differs}
          </p>
        ) : (
          !hasPersonality && (
            <Link href="/report" className="block rounded-xl border border-dashed border-line-strong px-3 py-2 text-xs text-ink-soft hover:bg-cream">
              나의 연애 성향 리포트가 있으면 &lsquo;평소의 나와 다른 점&rsquo;도 알려드려요 ›
            </Link>
          )
        )}
      </Section>
      <Section title="지금 해볼 만한 것">
        {content.nextSteps.map((n, i) => (
          <div key={`${n.title}-${i}`}>
            <p className="font-bold">{n.title}</p>
            <p className="mt-1 rounded-xl bg-teal-bg px-3 py-2 text-sm text-teal">{n.desc}</p>
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
        이 리포트는 내 상담 내용을 바탕으로 AI가 쓴 관찰이에요. 상대의 마음이나 성격을 판단하는 것이 아니에요.
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
