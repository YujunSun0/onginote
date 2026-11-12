"use client";

import { useEffect, useState } from "react";

/** 크롬·삼성 인터넷 등이 "설치할 수 있어요" 하고 알려 줄 때 오는 이벤트 (표준 타입에 아직 없음) */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "onginote:install-dismissed";
const DISMISS_DAYS = 14;

type Mode = "hidden" | "button" | "ios";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function dismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at > 0 && Date.now() - at < DISMISS_DAYS * 86400e3;
  } catch {
    return false;
  }
}

/**
 * 홈 화면에 앱으로 추가하라는 안내 카드.
 * - 안드로이드·PC 크롬: 브라우저가 설치 가능하다고 알려 주면 "설치하기" 버튼
 * - 아이폰·아이패드: 설치 버튼을 띄울 방법이 없어서 "공유 → 홈 화면에 추가" 안내
 * 이미 앱으로 열었거나, 닫은 지 2주가 안 됐거나, 카톡 같은 앱 안 브라우저면 보이지 않는다.
 */
export function InstallPrompt({ className = "" }: { className?: string }) {
  const [mode, setMode] = useState<Mode>("hidden");
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || dismissedRecently()) return;
    const ua = navigator.userAgent;
    const inApp = /KAKAOTALK|Instagram|FBAN|FBAV|NAVER|Line\//i.test(ua);
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
      setMode("button");
    };
    const onInstalled = () => setMode("hidden");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    // 브라우저가 알려 주는 이벤트를 기다리지 않고 바로 정하는 경우라 effect 안에서 상태를 바꾼다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ios && !inApp) setMode("ios");
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setMode("hidden");
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    setEvent(null);
    if (outcome === "accepted") setMode("hidden");
    else dismiss();
  }

  if (mode === "hidden") return null;

  return (
    <aside className={`flex items-center gap-3 rounded-[22px] border border-line bg-white px-4 py-3.5 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-bold">홈 화면에 온기노트 추가하기</p>
        {mode === "button" ? (
          <p className="text-xs text-muted">앱처럼 바로 열 수 있어요</p>
        ) : (
          <p className="text-xs leading-relaxed text-muted">
            브라우저의 <ShareIcon /> 공유 버튼을 누르고 &lsquo;홈 화면에 추가&rsquo;를 골라 주세요
          </p>
        )}
      </div>
      {mode === "button" && (
        <button onClick={install} className="shrink-0 rounded-full bg-accent px-3.5 py-2 text-xs font-bold text-white">
          설치하기
        </button>
      )}
      <button onClick={dismiss} aria-label="설치 안내 닫기" className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center text-muted">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <path d="M2 2l10 10M12 2L2 12" />
        </svg>
      </button>
    </aside>
  );
}

function ShareIcon() {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="inline-block -translate-y-px" aria-label="공유">
      <path d="M6 1v8M3 3.5L6 1l3 2.5M2.5 6H1.5v7h9V6h-1" />
    </svg>
  );
}
