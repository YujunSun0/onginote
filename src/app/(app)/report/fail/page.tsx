"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

export default function ReportFailPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Suspense fallback={null}>
        <Reason />
      </Suspense>
    </main>
  );
}

function Reason() {
  const params = useSearchParams();
  const canceled = params.get("code") === "PAY_PROCESS_CANCELED" || params.get("code") === "USER_CANCEL";
  return (
    <>
      <p className="font-display text-xl">{canceled ? "결제를 취소했어요" : "결제하지 못했어요"}</p>
      {!canceled && <p className="mt-2 max-w-sm text-sm text-ink-soft">{params.get("message") ?? "잠시 후 다시 시도해 주세요."}</p>}
      <p className="mt-2 text-xs text-muted">결제되지 않았어요.</p>
      <Link href="/report" replace className="mt-6 flex h-12 items-center rounded-full bg-accent px-6 font-bold text-white">
        리포트로 돌아가기
      </Link>
    </>
  );
}
