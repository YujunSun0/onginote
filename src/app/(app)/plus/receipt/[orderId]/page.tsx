"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BackIcon } from "@/components/Icons";

interface Receipt {
  order_id: string;
  orderName: string;
  kind: "first" | "renewal";
  status: "paid" | "refunded";
  amount: number;
  period_start: string | null;
  period_end: string | null;
  card_label: string | null;
  receipt_url: string | null;
  approved_at: string | null;
  refunded_at: string | null;
  nextBillingAt: string | null;
}

function kst(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(new Date(iso).getTime() + 9 * 3600e3);
}
function dateLabel(iso: string | null | undefined) {
  const d = kst(iso);
  return d ? `${d.getUTCFullYear()}. ${d.getUTCMonth() + 1}. ${d.getUTCDate()}.` : "-";
}
function dateTimeLabel(iso: string | null | undefined) {
  const d = kst(iso);
  if (!d) return "-";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dateLabel(iso)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

export default function ReceiptPage() {
  return (
    <main className="min-h-dvh px-5 pb-12 pt-4 lg:mx-auto lg:max-w-md">
      <Suspense fallback={<p className="mt-10 text-center text-sm text-muted">불러오는 중…</p>}>
        <ReceiptView />
      </Suspense>
    </main>
  );
}

function ReceiptView() {
  const { orderId } = useParams<{ orderId: string }>();
  const isNew = useSearchParams().get("new") === "1";
  const [r, setR] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/billing/receipt?order=${encodeURIComponent(orderId)}`, { cache: "no-store" })
      .then(async (res) => {
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "불러오지 못했어요.");
        setR(j);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했어요."));
  }, [orderId]);

  if (error) return <p className="mt-10 text-center text-sm text-danger">{error}</p>;
  if (!r) return <p className="mt-10 text-center text-sm text-muted">불러오는 중…</p>;

  const refunded = r.status === "refunded";
  const rows: [string, string][] = [
    ["상품", r.orderName],
    ["결제 수단", r.card_label ?? "카드"],
    ["결제 일시", dateTimeLabel(r.approved_at)],
    ["이용 기간", `${dateLabel(r.period_start)} ~ ${dateLabel(r.period_end)}`],
    ...(r.nextBillingAt ? ([["다음 결제일", `${dateLabel(r.nextBillingAt)} (${won(r.amount)})`]] as [string, string][]) : []),
    ...(refunded ? ([["환불 일시", dateTimeLabel(r.refunded_at)]] as [string, string][]) : []),
    ["주문번호", r.order_id],
  ];

  return (
    <>
      {!isNew && (
        <Link href="/plus" aria-label="구독 정보로" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-peach">
          <BackIcon size={22} />
        </Link>
      )}

      <div className={`text-center ${isNew ? "pt-10" : "pt-2"}`}>
        {isNew && (
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-bg text-2xl text-teal" aria-hidden>
            ✓
          </div>
        )}
        <h1 className="pt-3 font-display text-[22px]">{isNew ? "결제가 완료됐어요" : refunded ? "환불된 결제예요" : "결제 상세"}</h1>
        {isNew && <p className="pt-1 text-sm text-ink-soft">지금부터 Plus로 이야기할 수 있어요.</p>}
      </div>

      {/* 영수증 */}
      <section className="relative mt-6 overflow-hidden rounded-3xl border border-line bg-white">
        <div className="px-5 pb-5 pt-6 text-center">
          <p className="text-xs text-muted">{refunded ? "환불 금액" : "결제 금액"}</p>
          <p className={`pt-1 font-display text-[32px] tabular-nums ${refunded ? "text-muted line-through" : ""}`}>{won(r.amount)}</p>
          <p className="text-xs text-muted">부가세 포함</p>
        </div>
        {/* 절취선 */}
        <div className="relative flex items-center" aria-hidden>
          <span className="absolute -left-3 h-6 w-6 rounded-full border border-line bg-cream" />
          <span className="mx-5 h-px flex-1 border-t border-dashed border-line-strong" />
          <span className="absolute -right-3 h-6 w-6 rounded-full border border-line bg-cream" />
        </div>
        <dl className="space-y-3 px-5 pb-6 pt-5 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="shrink-0 text-muted">{k}</dt>
              <dd className={`text-right ${k === "주문번호" ? "break-all font-mono text-xs leading-5 text-ink-soft" : ""}`}>{v}</dd>
            </div>
          ))}
        </dl>
        {r.receipt_url && (
          <a
            href={r.receipt_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 items-center justify-center border-t border-line text-sm text-ink-soft hover:bg-cream"
          >
            카드 영수증 보기 ↗
          </a>
        )}
      </section>

      <p className="pt-3 text-center text-xs leading-relaxed text-muted">
        {refunded ? "환불은 카드사에 따라 3~7일 걸릴 수 있어요." : "결제 내역은 마이페이지 > 구독 관리에서 언제든 볼 수 있어요."}
      </p>

      {isNew ? (
        <div className="mt-6 flex flex-col items-center gap-3">
          <Link href="/" replace className="flex h-12 w-full items-center justify-center rounded-full bg-accent font-bold text-white">
            이야기하러 가기
          </Link>
          <Link href="/plus" replace className="text-sm text-muted underline">
            구독 정보 보기
          </Link>
        </div>
      ) : null}
    </>
  );
}
