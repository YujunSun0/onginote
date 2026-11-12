"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { ChatIcon, HomeIcon, MyIcon, PeopleIcon } from "./Icons";

export const NAV_ITEMS = [
  { href: "/", label: "홈", Icon: HomeIcon },
  { href: "/chats", label: "상담", Icon: ChatIcon },
  { href: "/people", label: "사람들", Icon: PeopleIcon },
  { href: "/me", label: "마이", Icon: MyIcon },
];

export function isNavActive(href: string, path: string): boolean {
  if (href === "/") return path === "/";
  if (href === "/chats") return path === "/chats" || path === "/new" || path.startsWith("/chat/");
  return path.startsWith(href);
}

/** 모바일 하단 메뉴. PC(lg 이상)에서는 왼쪽 세로 메뉴(SideRail)가 대신한다. */
function BottomNavInner() {
  const path = usePathname();
  return (
    <nav
      aria-label="하단 메뉴"
      className="fixed inset-x-0 bottom-3 z-10 mx-auto grid h-16 max-w-[min(42rem,calc(100%-24px))] grid-cols-4 rounded-full border border-line bg-white lg:hidden"
    >
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const active = isNavActive(href, path);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 text-[11px] ${
              active ? "font-bold text-accent-text" : "text-muted"
            }`}
          >
            <Icon />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * 주소(usePathname)는 동적 주소(/chat/[id] 등)에서 요청 때만 알 수 있어서 Suspense 로 감싼다.
 * 정적 주소에서는 빌드 때 그대로 그려진다.
 */
export function BottomNav() {
  return (
    <Suspense fallback={null}>
      <BottomNavInner />
    </Suspense>
  );
}
