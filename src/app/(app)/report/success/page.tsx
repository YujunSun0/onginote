"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

export default function ReportSuccessPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Suspense fallback={<p className="text-sm text-muted">결제를 확인하는 중…</p>}>
        <Finish />
      </Suspense>
    </main>
  );
}

/** 결제창에서 돌아온 화면: 서버가 금액을 확인하고 승인한 뒤 리포트로 보낸다 */
function Finish() {
  const params = useSearchParams();
  const router = useRouter();
  const paymentKey = params.get("paymentKey");
  const orderId = params.get("orderId");
  const amount = params.get("amount");
  const [error, setError] = useState<string | null>(() => (paymentKey && orderId && amount ? null : "결제 정보가 없어요."));
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current || !paymentKey || !orderId || !amount) return;
    sent.current = true;
    fetch("/api/reports/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
    })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "결제를 확인하지 못했어요.");
        router.replace("/report");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "결제를 확인하지 못했어요."));
    window.history.replaceState(null, "", "/report/success");
  }, [paymentKey, orderId, amount, router]);

  if (!error) return <p className="text-sm text-muted">결제를 확인하는 중이에요. 창을 닫지 말아 주세요…</p>;
  return (
    <>
      <p className="font-display text-xl">결제를 마치지 못했어요</p>
      <p className="mt-2 max-w-sm text-sm text-ink-soft">{error}</p>
      <Link href="/report" replace className="mt-6 flex h-12 items-center rounded-full bg-accent px-6 font-bold text-white">
        리포트로 돌아가기
      </Link>
    </>
  );
}
