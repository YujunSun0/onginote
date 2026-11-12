"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { BusinessInfo } from "@/components/BusinessInfo";
import { BackIcon } from "@/components/Icons";

type SubStatus = "active" | "canceled" | "past_due";
interface Payment {
  order_id: string;
  kind: "first" | "renewal";
  status: "paid" | "refunded" | "failed";
  amount: number;
  card_label: string | null;
  receipt_url: string | null;
  approved_at: string | null;
  refunded_at: string | null;
  created_at: string;
}
interface Limits {
  dailySearches: number;
  sessionMessages: number;
  dailySessions: number | null;
  monthlySessions: number | null;
}
interface Billing {
  plan: "free" | "plus";
  subscription: { status: SubStatus; current_period_end: string; card_label: string | null; grace_until: string | null } | null;
  payments: Payment[];
  refundable: boolean;
  price: number;
  refundDays: number;
  limits: { free: Limits; plus: Limits };
}

function dateLabel(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 9 * 3600e3);
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
}
const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
/** "하루 1개 · 한 달 10개" / 패스는 하루 상한이 안전장치라 "제한 없음"으로 보여준다 */
const sessionsLabel = (l: Limits) =>
  l.monthlySessions === null ? "제한 없음" : `하루 ${l.dailySessions}개 · 한 달 ${l.monthlySessions}개`;

export default function PlusPage() {
  const [data, setData] = useState<Billing | null>(null);
  const [loadError, setLoadError] = useState(false);

  function load() {
    fetch("/api/billing", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setLoadError(true));
  }
  useEffect(load, []);

  const subscribed = data?.plan === "plus" && !!data.subscription;
  return (
    <main className={`px-5 pt-4 lg:mx-auto lg:max-w-3xl lg:px-10 lg:pb-12 lg:pt-7 ${subscribed ? "pb-28" : "pb-48"}`}>
      <div className="flex items-center gap-1">
        <Link href="/me" aria-label="마이페이지로" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-peach">
          <BackIcon size={22} />
        </Link>
        <h1 className="font-display text-[22px]">{subscribed ? "구독 관리" : "온기 패스"}</h1>
      </div>

      {loadError && <p className="mt-6 text-sm text-danger">정보를 불러오지 못했어요. 새로고침해 주세요.</p>}
      {!data && !loadError && <p className="mt-6 text-sm text-muted">불러오는 중…</p>}

      {data &&
        (subscribed ? (
          <div className="mt-4 flex flex-col gap-4">
            <Manage data={data} onChange={load} />
            <Amounts data={data} />
            {data.payments.length > 0 && <History payments={data.payments} />}
            <RefundLink data={data} onChange={load} />
          </div>
        ) : (
          <Join data={data} />
        ))}
      {/* 가입 화면은 아래에 결제 버튼이 고정돼 있어서 하단 메뉴를 숨긴다 */}
      {subscribed && <BottomNav />}
    </main>
  );
}

/** 무료와 온기 패스의 이용량 비교 (막대) */
function Amounts({ data }: { data: Billing }) {
  const { free, plus } = data.limits;
  const rows: { label: string; free: string; plus: string; ratio: number }[] = [
    { label: "상담 수", free: sessionsLabel(free), plus: sessionsLabel(plus), ratio: 0.1 },
    { label: "검색해서 답하기", free: `하루 ${free.dailySearches}번`, plus: `하루 ${plus.dailySearches}번`, ratio: free.dailySearches / plus.dailySearches },
    { label: "상담 하나의 길이", free: `메시지 ${free.sessionMessages}개`, plus: `메시지 ${plus.sessionMessages}개`, ratio: free.sessionMessages / plus.sessionMessages },
  ];
  return (
    <section className="rounded-3xl border border-line bg-white p-5">
      <h2 className="font-display text-lg">무료와 온기 패스</h2>
      <p className="pt-0.5 text-xs text-muted">답변은 똑같은 캐릭터가 해요. 이야기할 수 있는 양이 달라요.</p>
      <div className="space-y-4 pt-4">
        {rows.map((r) => (
          <div key={r.label}>
            <p className="pb-1.5 text-sm font-bold">{r.label}</p>
            <div className="grid grid-cols-[36px_1fr_auto] items-center gap-x-2 gap-y-1.5 text-xs">
              <span className="text-muted">무료</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-cream">
                <span className="block h-full rounded-full bg-line-strong" style={{ width: `${Math.max(r.ratio * 100, 6)}%` }} />
              </span>
              <span className="text-right text-muted">{r.free}</span>
              <span className="font-bold text-accent">패스</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-cream">
                <span className="block h-full w-full rounded-full bg-accent" />
              </span>
              <span className="text-right font-bold">{r.plus}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="pt-4 text-[11px] leading-relaxed text-muted">
        한 달 이용량이 아주 많으면 온기 패스 사용 한도에 닿을 수 있어요. 그러면 다음 결제일까지 하루 대화량과 검색은 무료와 같은 양으로, 상담 수와 길이는 그대로 쓸 수 있어요.
      </p>
    </section>
  );
}

/** 가입 화면 (C안: 한국 구독 서비스형) */
function Join({ data }: { data: Billing }) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const perDay = Math.round(data.price / 30 / 10) * 10;
  const { plus } = data.limits;

  async function start() {
    if (!agreed) {
      setError("결제 동의에 체크해 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agreed: true }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "준비하지 못했어요.");
      const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
      const toss = await loadTossPayments(j.clientKey);
      const payment = toss.payment({ customerKey: j.customerKey });
      await payment.requestBillingAuth({
        method: "CARD",
        successUrl: `${window.location.origin}/plus/success`,
        failUrl: `${window.location.origin}/plus/fail`,
        customerEmail: j.email ?? undefined,
      });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== "USER_CANCEL") setError(e instanceof Error ? e.message : "카드 등록 창을 열지 못했어요.");
      setBusy(false);
    }
  }

  const benefits = [
    { icon: "☀️", title: "상담 수 제한 없이", desc: "고민이 생길 때마다 언제든 새 상담을 시작해요" },
    { icon: "🔍", title: `검색해서 답하기 하루 ${plus.dailySearches}번`, desc: "비슷한 사례와 최신 정보를 찾아보고 답해요" },
    { icon: "📒", title: `상담 하나에 메시지 ${plus.sessionMessages}개`, desc: "긴 고민도 한 상담에서 흐름을 이어서" },
  ];
  const faq: [string, string][] = [
    ["해지는 어떻게 하나요?", "마이페이지 > 구독 관리에서 언제든 할 수 있어요. 해지하면 다음 결제일부터 결제되지 않고, 남은 기간까지는 온기 패스로 써요."],
    ["결제일은 언제예요?", "처음 결제한 날을 기준으로 매달 같은 날 결제돼요. 31일처럼 없는 날이 있는 달은 그달 말일에 결제돼요."],
    ["무료와 답변이 달라지나요?", "아니요, 같은 캐릭터가 같은 방식으로 답해요. 온기 패스는 상담 수 제한이 없고, 검색 횟수와 상담 길이가 늘어나요."],
    ["무료로 돌아가면 기록은요?", "상담 기록과 정리 카드는 그대로 남아요."],
    ["환불은 되나요?", `결제 후 ${data.refundDays}일 안에 상담을 한 번도 하지 않았다면 구독 관리에서 환불을 요청할 수 있어요.`],
  ];

  return (
    <>
      <section className="mt-3 rounded-3xl bg-ink p-5 text-white">
        <p className="text-xs font-bold text-peach-deep">온기 패스</p>
        <h2 className="pt-2 font-display text-[26px] leading-snug">
          하루 {perDay}원으로
          <br />
          끊기지 않는 상담
        </h2>
        <p className="pt-2 text-sm text-white/75">월 {won(data.price)} · 커피 두 잔 값으로 한 달 내내</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {["썸 탈 때", "다툰 뒤에", "고백 전", "이별 후"].map((t) => (
            <span key={t} className="rounded-full bg-white/10 px-3 py-1 text-xs">
              {t}
            </span>
          ))}
        </div>
      </section>

      <section className="pt-6">
        <h2 className="font-display text-lg">온기 패스 혜택</h2>
        <ul className="mt-3 space-y-2">
          {benefits.map((b) => (
            <li key={b.title} className="flex items-center gap-3.5 rounded-2xl bg-white p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-peach text-xl" aria-hidden>
                {b.icon}
              </span>
              <div>
                <p className="font-bold">{b.title}</p>
                <p className="pt-0.5 text-sm text-ink-soft">{b.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="pt-6">
        <Amounts data={data} />
      </div>

      <section className="pt-6">
        <h2 className="font-display text-lg">자주 묻는 질문</h2>
        <div className="mt-3 divide-y divide-line rounded-2xl bg-white">
          {faq.map(([q, a]) => (
            <details key={q} className="group px-4">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-sm [&::-webkit-details-marker]:hidden">
                {q}
                <span className="text-muted transition-transform group-open:rotate-180" aria-hidden>
                  ▾
                </span>
              </summary>
              <p className="pb-3 text-sm leading-relaxed text-ink-soft">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <ul className="mt-6 list-disc space-y-1 rounded-2xl bg-cream px-4 py-3 pl-8 text-[11px] leading-relaxed text-ink-soft">
        <li>매달 처음 결제한 날에 {won(data.price)}(부가세 포함)이 자동 결제돼요. 해지하면 다음 결제일부터 결제되지 않아요.</li>
        <li>
          결제 후 {data.refundDays}일 안에 상담을 한 번도 하지 않았다면 전액 환불돼요. 온기 패스는 바로 쓸 수 있는 디지털 서비스라, 결제 후 상담을 시작하면
          청약철회가 제한돼요.
        </li>
        <li>미성년자가 법정대리인 동의 없이 결제했다면 본인이나 법정대리인이 취소할 수 있어요.</li>
        <li>결제는 토스페이먼츠가 처리하고, 카드 번호는 온기노트에 저장되지 않아요.</li>
      </ul>
      <BusinessInfo className="pt-4 text-center" />

      {/* 아래 고정: 동의 + 결제 버튼 (PC 에서는 본문 아래에 둔다) */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white/95 px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:static lg:mt-6 lg:rounded-3xl lg:border lg:px-5 lg:py-4">
        <label className="flex cursor-pointer items-start gap-2 pb-2.5 text-xs text-ink-soft">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => {
              setAgreed(e.target.checked);
              setError(null);
            }}
            className="mt-px h-4 w-4 shrink-0 accent-[var(--color-accent)]"
          />
          <span>
            위 내용을 확인했고, 매달 {won(data.price)} 자동 결제와 결제 정보 처리(토스페이먼츠 위탁)에 동의해요{" "}
            <b className="text-accent">(필수)</b> ·{" "}
            <Link href="/terms" target="_blank" className="underline">
              이용약관
            </Link>{" "}
            ·{" "}
            <Link href="/privacy" target="_blank" className="underline">
              개인정보 처리방침
            </Link>
          </span>
        </label>
        {error && <p className="pb-2 text-xs text-danger">{error}</p>}
        <button
          onClick={start}
          disabled={busy}
          className={`h-[52px] w-full rounded-2xl bg-accent text-[15px] font-bold text-white shadow-[0_6px_16px_-6px_rgba(196,73,27,0.6)] disabled:opacity-50 ${agreed ? "" : "opacity-60"}`}
        >
          {busy ? "카드 등록 창을 여는 중…" : `월 ${won(data.price)}으로 시작하기`}
        </button>
        <p className="pt-1.5 text-center text-[11px] text-muted">언제든 해지 · 카드 등록 후 바로 시작</p>
      </div>
    </>
  );
}

/** 구독 중: 상태, 해지·해지 취소·환불, 결제 실패 시 카드 다시 등록 */
function Manage({ data, onChange }: { data: Billing; onChange: () => void }) {
  const sub = data.subscription!;
  const [confirming, setConfirming] = useState<"cancel" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "cancel" | "resume") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "처리하지 못했어요.");
      setConfirming(null);
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  const status =
    sub.status === "canceled"
      ? `해지했어요. ${dateLabel(sub.current_period_end)}까지 온기 패스로 쓸 수 있어요.`
      : sub.status === "past_due"
        ? `결제가 안 됐어요. 하루 한 번 다시 시도하고, ${dateLabel(sub.grace_until)}까지는 온기 패스로 쓸 수 있어요.`
        : `다음 결제일은 ${dateLabel(sub.current_period_end)}이에요 (${won(data.price)}).`;

  return (
    <section className="rounded-3xl border border-line bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg">온기 패스 이용 중</h2>
        <span className="rounded-full bg-accent px-3 py-1 text-sm font-bold text-white">패스</span>
      </div>
      <p className={`pt-2 text-sm ${sub.status === "past_due" ? "text-danger" : "text-ink-soft"}`}>{status}</p>
      {sub.card_label && <p className="pt-1 text-xs text-muted">결제 카드: {sub.card_label}</p>}

      {sub.status === "past_due" && (
        <p className="mt-3 rounded-xl bg-cream px-3 py-2 text-xs leading-relaxed text-ink-soft">
          카드를 바꾸려면 해지한 뒤 다시 가입해 주세요. 다시 가입하면 그날부터 한 달이 새로 시작돼요.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {confirming === "cancel" && (
        <div className="mt-4 rounded-2xl bg-cream p-4 text-sm">
          <p>
            {sub.status === "past_due"
              ? "해지하면 바로 무료로 바뀌어요."
              : `해지해도 ${dateLabel(sub.current_period_end)}까지는 온기 패스로 쓸 수 있고, 그 뒤로는 결제되지 않아요.`}
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => act("cancel")} disabled={busy} className="h-11 flex-1 rounded-full bg-ink text-sm font-bold text-white disabled:opacity-40">
              해지할게요
            </button>
            <button onClick={() => setConfirming(null)} className="h-11 flex-1 rounded-full border border-line-strong bg-white text-sm">
              그대로 둘게요
            </button>
          </div>
        </div>
      )}
      {!confirming && (
        <div className="mt-4 flex flex-wrap gap-2">
          {sub.status === "canceled" ? (
            <button onClick={() => act("resume")} disabled={busy} className="h-11 rounded-full bg-accent px-5 text-sm font-bold text-white disabled:opacity-40">
              해지 취소하고 계속 쓰기
            </button>
          ) : (
            <button onClick={() => setConfirming("cancel")} className="h-11 rounded-full border border-line-strong bg-white px-5 text-sm">
              해지하기
            </button>
          )}
        </div>
      )}
      {sub.status !== "canceled" && !confirming && <p className="pt-2 text-xs text-muted">해지하면 다음 결제일부터 결제되지 않아요.</p>}
    </section>
  );
}

function History({ payments }: { payments: Payment[] }) {
  const label = (p: Payment) => (p.status === "refunded" ? "환불됨" : p.status === "failed" ? "결제 실패" : p.kind === "first" ? "첫 결제" : "자동 결제");
  return (
    <section className="rounded-3xl border border-line bg-white p-5">
      <h2 className="pb-2 font-display text-lg">결제 내역</h2>
      <ul className="divide-y divide-line text-sm">
        {payments.map((p) => (
          <li key={p.order_id} className="relative flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p>
                {p.status !== "failed" && (
                  <Link href={`/plus/receipt/${encodeURIComponent(p.order_id)}`} className="absolute inset-0" aria-label="결제 상세 보기" />
                )}
                {dateLabel(p.approved_at ?? p.created_at)} · <span className={p.status === "paid" ? "" : "text-muted"}>{label(p)}</span>
              </p>
              {p.card_label && <p className="text-xs text-muted">{p.card_label}</p>}
            </div>
            <div className="shrink-0 text-right">
              <p className={`tabular-nums ${p.status === "paid" ? "font-bold" : "text-muted line-through"}`}>{won(p.amount)}</p>
              {p.receipt_url && (
                <a href={p.receipt_url} target="_blank" rel="noopener noreferrer" className="relative text-xs text-muted underline">
                  영수증
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * 환불 요청: 해지가 기본이고, 환불은 법이 정한 경우(결제 후 며칠 안, 미사용)에만.
 * 눈에 띄지 않게 맨 아래 작은 글씨로 두지만, 찾을 수는 있어야 한다 (청약철회를 막으면 안 됨).
 */
function RefundLink({ data, onChange }: { data: Billing; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refund() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refund" }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "환불하지 못했어요.");
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "환불하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mx-auto py-2 text-[11px] text-muted/80 underline underline-offset-2">
        환불 안내
      </button>
    );
  }
  return (
    <section className="rounded-2xl bg-cream p-4 text-xs leading-relaxed text-ink-soft">
      <p>
        결제 후 {data.refundDays}일 안이고 그 뒤로 상담을 한 번도 하지 않았다면 마지막 결제를 전액 환불받을 수 있어요. 환불하면 바로 무료로 바뀌고,
        카드사에 따라 3~7일 걸릴 수 있어요. 그 밖에는 해지하면 다음 결제일부터 결제되지 않아요.
      </p>
      {error && <p className="pt-2 text-danger">{error}</p>}
      <div className="flex gap-3 pt-3">
        {data.refundable ? (
          <button onClick={refund} disabled={busy} className="text-xs font-bold text-ink underline disabled:opacity-40">
            {busy ? "환불하는 중…" : "환불 요청하기"}
          </button>
        ) : (
          <span className="text-muted">지금은 환불 대상이 아니에요.</span>
        )}
        <button onClick={() => setOpen(false)} className="text-xs text-muted underline">
          닫기
        </button>
      </div>
    </section>
  );
}
