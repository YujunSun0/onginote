"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

export default function PlusSuccessPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Suspense fallback={<p className="text-sm text-muted">결제하는 중…</p>}>
        <Finish />
      </Suspense>
    </main>
  );
}

/** 카드 등록이 끝나고 돌아온 화면: 서버에서 빌링키 발급 + 첫 달 결제 */
function Finish() {
  const params = useSearchParams();
  const router = useRouter();
  const authKey = params.get("authKey");
  const customerKey = params.get("customerKey");
  const [state, setState] = useState<{ kind: "busy" } | { kind: "error"; message: string }>(() =>
    authKey && customerKey ? { kind: "busy" } : { kind: "error", message: "카드 등록 정보가 없어요." },
  );
  const sent = useRef(false); // authKey 는 한 번만 쓸 수 있다 (개발 모드에서 effect 가 두 번 돌아도 한 번만 보낸다)

  useEffect(() => {
    if (sent.current || !authKey || !customerKey) return;
    sent.current = true;
    fetch("/api/billing/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authKey, customerKey }),
    })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "결제하지 못했어요.");
        // 결제가 끝나면 영수증 화면으로 (뒤로 가기로 이 화면에 돌아오지 않게 replace)
        router.replace(`/plus/receipt/${encodeURIComponent(j.orderId)}?new=1`);
      })
      .catch((e) => setState({ kind: "error", message: e instanceof Error ? e.message : "결제하지 못했어요." }));
    // 주소창에서 authKey 를 지운다 (새로고침해도 다시 보내지 않게)
    window.history.replaceState(null, "", "/plus/success");
  }, [authKey, customerKey, router]);

  if (state.kind === "busy") return <p className="text-sm text-muted">결제하는 중이에요. 창을 닫지 말아 주세요…</p>;
  if (state.kind === "error") {
    return (
      <>
        <p className="font-display text-xl">결제하지 못했어요</p>
        <p className="mt-2 max-w-sm text-sm text-ink-soft">{state.message}</p>
        <Link href="/plus" replace className="mt-6 flex h-12 items-center rounded-full bg-accent px-6 font-bold text-white">
          다시 시도하기
        </Link>
      </>
    );
  }
  return null;
}
