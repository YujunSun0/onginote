"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LEGAL_PATHS } from "@/lib/legal";
import { NAV_ITEMS, isNavActive } from "./BottomNav";

/** 메뉴 없이 보여주는 화면: 로그인, 동의, 인쇄용 기록, 약관 문서 */
const BARE_PATHS = ["/login", "/welcome", "/me/print", "/plus/success", "/plus/fail", ...LEGAL_PATHS];

/** PC(lg 이상) 왼쪽 세로 메뉴. 아래쪽에 오늘 사용량을 보여준다. */
export function SideRail() {
  const path = usePathname();
  const [usage, setUsage] = useState<number | null>(null);

  // 화면을 옮길 때마다, 그리고 답변이 끝날 때마다 사용량을 다시 읽는다
  useEffect(() => {
    if (BARE_PATHS.includes(path)) return;
    const load = () =>
      fetch("/api/usage")
        .then((r) => r.json())
        .then((u: { percent?: number }) => setUsage(typeof u.percent === "number" ? u.percent : null))
        .catch(() => {});
    load();
    window.addEventListener("onginote:sessions", load);
    return () => window.removeEventListener("onginote:sessions", load);
  }, [path]);

  if (BARE_PATHS.includes(path)) return null;

  const r = 13;
  const c = 2 * Math.PI * r;

  return (
    <nav
      aria-label="메인 메뉴"
      className="sticky top-0 hidden h-dvh w-[76px] shrink-0 flex-col items-center gap-1.5 border-r border-line bg-white py-4.5 lg:flex"
    >
      <Link href="/" aria-label="온기노트 홈" className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-[14px] bg-accent font-display text-[22px] text-white">
        온
      </Link>
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const active = isNavActive(href, path);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex h-14 w-15 flex-col items-center justify-center gap-0.5 rounded-[14px] text-[11px] ${
              active ? "bg-peach font-bold text-accent-text" : "text-muted hover:bg-cream"
            }`}
          >
            <Icon />
            {label}
          </Link>
        );
      })}
      {usage !== null && (
        <div className="mt-auto flex flex-col items-center gap-1 text-[10px] text-muted" title="하루 대화량 중 오늘 쓴 비율">
          <svg width="34" height="34" viewBox="0 0 34 34" role="img" aria-label={`오늘 사용량 ${usage}%`} className="-rotate-90">
            <circle cx="17" cy="17" r={r} fill="none" stroke="var(--color-line)" strokeWidth="4" />
            <circle
              cx="17" cy="17" r={r} fill="none" strokeWidth="4" strokeLinecap="round"
              stroke={usage >= 80 ? "var(--color-accent)" : "var(--color-teal)"}
              strokeDasharray={c} strokeDashoffset={c * (1 - usage / 100)}
            />
          </svg>
          오늘 {usage}%
        </div>
      )}
    </nav>
  );
}
