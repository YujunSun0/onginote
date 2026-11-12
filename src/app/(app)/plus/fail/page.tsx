"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

export default function PlusFailPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Suspense fallback={null}>
        <Reason />
      </Suspense>
      <Link href="/plus" replace className="mt-6 flex h-12 items-center rounded-full bg-accent px-6 font-bold text-white">
        돌아가기
      </Link>
    </main>
  );
}

/** 카드 등록을 취소했거나 실패했을 때. 결제는 일어나지 않았다. */
function Reason() {
  const params = useSearchParams();
  const code = params.get("code");
  const canceled = code === "PAY_PROCESS_CANCELED" || code === "USER_CANCEL";
  return (
    <>
      <p className="font-display text-xl">{canceled ? "카드 등록을 취소했어요" : "카드를 등록하지 못했어요"}</p>
      <p className="mt-2 max-w-sm text-sm text-ink-soft">
        {canceled ? "결제는 되지 않았어요." : (params.get("message") ?? "잠시 후 다시 시도해 주세요.") + " 결제는 되지 않았어요."}
      </p>
    </>
  );
}
