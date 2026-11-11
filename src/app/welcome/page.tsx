"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CharacterFace } from "@/components/CharacterFace";

type Key = "age14" | "terms" | "privacy" | "sensitive" | "overseas";

const ITEMS: { key: Key; label: string; href?: string; detail: string }[] = [
  { key: "age14", label: "만 14세 이상이에요", detail: "만 14세 미만은 가입할 수 없어요." },
  { key: "terms", label: "이용약관 동의", href: "/terms", detail: "캐릭터 답변은 AI가 만들고, 전문 상담을 대신하지 않아요." },
  {
    key: "privacy",
    label: "개인정보 수집·이용 동의",
    href: "/privacy",
    detail: "이메일, 이름, 프로필 사진과 상담 내용을 서비스 제공에 써요. 탈퇴하면 바로 지워요.",
  },
  {
    key: "sensitive",
    label: "민감정보 처리 동의",
    href: "/privacy",
    detail: "상담 중에 직접 이야기한 건강, 연애·성생활 같은 민감한 내용을 답변을 만드는 데만 써요.",
  },
  {
    key: "overseas",
    label: "개인정보 국외 이전 동의",
    href: "/privacy",
    detail: "AI 답변을 만들려고 대화 내용과 사진을 미국의 Anthropic으로 보내요. Anthropic은 30일 안에 지우고 학습에 쓰지 않아요.",
  },
];

export default function WelcomePage() {
  return (
    <Suspense>
      <Welcome />
    </Suspense>
  );
}

function Welcome() {
  const router = useRouter();
  const params = useSearchParams();
  const nextParam = params.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";
  const [checked, setChecked] = useState<Record<Key, boolean>>({ age14: false, terms: false, privacy: false, sensitive: false, overseas: false });
  const [pending, setPending] = useState<"agree" | "leave" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const all = ITEMS.every((i) => checked[i.key]);

  async function agree() {
    setPending("agree");
    setError(null);
    const res = await fetch("/api/me/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(checked),
    });
    if (res.ok) {
      // 응답이 새 로그인 토큰(쿠키)을 줬으니 다음 화면부터 proxy 가 동의를 알아본다
      router.replace(next);
      return;
    }
    const body = await res.json().catch(() => ({}));
    setError(body.error ?? "저장하지 못했어요. 다시 시도해 주세요.");
    setPending(null);
  }

  async function leave() {
    setPending("leave");
    await fetch("/api/me/consent", { method: "DELETE" }).catch(() => {});
    router.replace("/login");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-10">
      <div className="flex flex-col items-center text-center">
        <CharacterFace id="mongle" size={88} />
        <h1 className="pt-3 font-display text-2xl">온기노트에 온 걸 환영해!</h1>
        <p className="pt-2 text-sm leading-relaxed text-ink-soft">
          시작하기 전에 아래 내용을 확인하고 동의해 줘.
          <br />
          몽글이랑 친구들은 <b>AI 캐릭터</b>야.
        </p>
      </div>

      <div className="mt-7 rounded-3xl border border-line bg-white p-4">
        <label className="flex cursor-pointer items-center gap-3 border-b border-line pb-3">
          <input
            type="checkbox"
            checked={all}
            onChange={(e) => setChecked(Object.fromEntries(ITEMS.map((i) => [i.key, e.target.checked])) as Record<Key, boolean>)}
            className="h-5 w-5 accent-[var(--color-accent)]"
          />
          <span className="text-[15px] font-bold">모두 동의해요</span>
        </label>
        <ul className="flex flex-col gap-3 pt-3">
          {ITEMS.map((i) => (
            <li key={i.key}>
              <div className="flex items-start gap-3">
                <input
                  id={`c-${i.key}`}
                  type="checkbox"
                  checked={checked[i.key]}
                  onChange={(e) => setChecked({ ...checked, [i.key]: e.target.checked })}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-accent)]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor={`c-${i.key}`} className="cursor-pointer text-sm font-medium">
                      <span className="text-accent-text">(필수)</span> {i.label}
                    </label>
                    {i.href && (
                      <Link href={i.href} target="_blank" className="shrink-0 text-xs text-muted underline underline-offset-2">
                        보기
                      </Link>
                    )}
                  </div>
                  <p className="pt-0.5 text-xs leading-relaxed text-muted">{i.detail}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="pt-3 text-xs leading-relaxed text-muted">
        모두 필수 항목이라 동의하지 않으면 서비스를 쓸 수 없어요. 힘든 순간에는 AI 대신{" "}
        <Link href="/ai-notice" target="_blank" className="underline">전문 상담 연락처</Link>로 연락해 줘.
      </p>

      {error && <p role="alert" className="pt-3 text-sm text-danger">{error}</p>}

      <button
        type="button"
        onClick={agree}
        disabled={!all || pending !== null}
        className="mt-6 h-13 rounded-full bg-accent text-base font-bold text-white disabled:opacity-40"
      >
        {pending === "agree" ? "시작하는 중…" : "동의하고 시작하기"}
      </button>
      <button type="button" onClick={leave} disabled={pending !== null} className="mt-3 py-2 text-xs text-muted underline underline-offset-2">
        동의하지 않고 나가기
      </button>
    </main>
  );
}
