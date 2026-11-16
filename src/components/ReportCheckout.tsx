"use client";

import Link from "next/link";
import { useState } from "react";
import { rememberReportBack } from "@/lib/report-back";

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

/**
 * 결제 전 리포트: 잠긴 항목은 제목만 흐리게 보여주고(실제 내용은 서버가 보내지 않는다), 아래에 단건 결제.
 * 연애 성향 리포트와 관계 흐름 리포트가 같이 쓴다. 금액은 서버가 주문을 만들 때 다시 정한다.
 */
export function ReportCheckout({
  reportId,
  price,
  lockedTitles,
  pitch,
  backPath,
}: {
  reportId: string;
  price: number;
  lockedTitles: string[];
  pitch: string;
  /** 결제창에서 돌아올 리포트 화면 */
  backPath: string;
}) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    if (!agreed) {
      setError("결제 안내에 동의해 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agreed: true }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "결제를 준비하지 못했어요.");
      rememberReportBack(backPath);
      const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
      const toss = await loadTossPayments(j.clientKey);
      await toss.payment({ customerKey: j.customerKey }).requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: j.amount },
        orderId: j.orderId,
        orderName: j.orderName,
        successUrl: `${window.location.origin}/report/success`,
        failUrl: `${window.location.origin}/report/fail`,
        customerEmail: j.email ?? undefined,
      });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== "USER_CANCEL") setError(e instanceof Error ? e.message : "결제창을 열지 못했어요.");
      setBusy(false);
    }
  }

  return (
    <>
      <section className="relative overflow-hidden rounded-3xl border border-line bg-white p-5">
        <ul className="space-y-5" aria-hidden>
          {lockedTitles.map((t) => (
            <li key={t}>
              <p className="font-display text-lg text-ink/70">{t}</p>
              <div className="mt-2 space-y-1.5 blur-[3px]">
                <span className="block h-3 w-11/12 rounded-full bg-line-strong" />
                <span className="block h-3 w-4/5 rounded-full bg-line-strong" />
                <span className="block h-3 w-2/3 rounded-full bg-line" />
              </div>
            </li>
          ))}
        </ul>
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent" />
      </section>

      <section className="rounded-3xl border-2 border-accent bg-white p-5">
        <p className="font-display text-lg">전체 리포트 보기</p>
        <p className="pt-1 text-sm text-ink-soft">{pitch}</p>
        <p className="pt-3 font-display text-[28px]">
          {won(price)}
          <span className="ml-1 font-sans text-sm font-normal text-muted">한 번 결제</span>
        </p>
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-ink-soft">
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
            결제하면 바로 전체 리포트가 열리는 디지털 콘텐츠라, 결제 후에는 청약철회(환불)가 제한되는 것을 확인했어요. 내용은 위 미리보기로 먼저 볼 수
            있어요 <b className="text-accent">(필수)</b> ·{" "}
            <Link href="/terms" target="_blank" className="underline">
              이용약관
            </Link>
          </span>
        </label>
        {error && <p className="pt-2 text-xs text-danger">{error}</p>}
        <button
          onClick={pay}
          disabled={busy}
          className={`mt-3 h-[52px] w-full rounded-2xl bg-accent text-[15px] font-bold text-white disabled:opacity-50 ${agreed ? "" : "opacity-60"}`}
        >
          {busy ? "결제창을 여는 중…" : `${won(price)}으로 전체 보기`}
        </button>
        <p className="pt-1.5 text-center text-[11px] text-muted">결제는 토스페이먼츠가 처리하고, 카드 번호는 온기노트에 저장되지 않아요.</p>
      </section>
    </>
  );
}
