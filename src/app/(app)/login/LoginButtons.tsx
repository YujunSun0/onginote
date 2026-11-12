"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Provider = "kakao" | "google";

export function LoginButtons({ next }: { next: string }) {
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(provider: Provider) {
    setPending(provider);
    setError(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      // 카카오: Supabase 가 이메일·닉네임·프로필 사진 동의를 기본으로 요청한다.
      // 카카오 개발자 콘솔의 동의항목에서 셋 다 켜 둬야 한다 (docs/DEVELOPMENT.md 의 설정 안내 참고).
      options: { redirectTo },
    });
    if (error) {
      setError("로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.");
      setPending(null);
    }
    // 성공하면 카카오/구글 화면으로 이동한다
  }

  return (
    <div className="flex flex-col gap-3 pt-8">
      <button
        type="button"
        onClick={() => signIn("kakao")}
        disabled={pending !== null}
        className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-[#FEE500] text-[15px] font-bold text-black/85 disabled:opacity-60"
      >
        <KakaoMark />
        {pending === "kakao" ? "카카오로 이동하는 중…" : "카카오로 시작하기"}
      </button>
      <button
        type="button"
        onClick={() => signIn("google")}
        disabled={pending !== null}
        className="flex h-13 items-center justify-center gap-2 rounded-2xl border border-line-strong bg-white text-[15px] font-bold text-ink disabled:opacity-60"
      >
        <GoogleMark />
        {pending === "google" ? "구글로 이동하는 중…" : "구글로 시작하기"}
      </button>
      {error && (
        <p role="alert" className="text-center text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function KakaoMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3C6.48 3 2 6.48 2 10.78c0 2.78 1.86 5.22 4.66 6.6l-.95 3.48c-.08.3.26.54.52.37l4.15-2.74c.53.06 1.07.09 1.62.09 5.52 0 10-3.48 10-7.8S17.52 3 12 3z"
      />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.29 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.28a12 12 0 0 0 0 10.78l4.01-3.1z" />
      <path fill="#EA4335" d="M12 4.76c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.28 6.61l4.01 3.1C6.23 6.87 8.88 4.76 12 4.76z" />
    </svg>
  );
}
