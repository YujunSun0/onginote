"use client";

import { useRouter } from "next/navigation";
import { LEGAL_PATHS } from "@/lib/legal";
import { XIcon } from "./Icons";

/**
 * 약관 문서 닫기. 앞 화면이 있으면 돌아가고, 새 탭으로 열렸으면 탭을 닫는다.
 * 탭이 안 닫히면 홈으로 보낸다 (로그인 전이면 proxy 가 로그인 화면으로 보낸다).
 */
export function LegalClose() {
  const router = useRouter();

  function close() {
    // 온기노트 안의 다른 화면에서 왔을 때만 뒤로 간다 (주소를 직접 연 탭에서 빈 화면으로 가지 않게).
    // 앱 안 링크 이동은 referrer 가 바뀌지 않으니, 이 탭이 처음 연 주소가 약관이 아닌 화면인지도 본다.
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const firstPath = nav ? new URL(nav.name).pathname : window.location.pathname;
    const openedInApp = !LEGAL_PATHS.includes(firstPath);
    const fromApp = openedInApp || document.referrer.startsWith(window.location.origin + "/");
    if (fromApp && window.history.length > 1) {
      router.back();
      return;
    }
    window.close();
    // 닫히지 않았으면(직접 주소로 연 탭 등) 홈으로
    setTimeout(() => router.replace("/"), 150);
  }

  return (
    <button
      type="button"
      onClick={close}
      aria-label="닫기"
      className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-peach"
    >
      <XIcon size={22} />
    </button>
  );
}
