"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatIcon, HomeIcon, PeopleIcon } from "./Icons";

const items = [
  { href: "/", label: "홈", Icon: HomeIcon },
  { href: "/chats", label: "상담", Icon: ChatIcon },
  { href: "/people", label: "사람들", Icon: PeopleIcon },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="하단 메뉴"
      className="fixed inset-x-0 bottom-3 z-10 mx-auto grid h-16 max-w-[min(42rem,calc(100%-24px))] grid-cols-3 rounded-full border border-line bg-white"
    >
      {items.map(({ href, label, Icon }) => {
        const active =
          href === "/" ? path === "/" : href === "/chats" ? path === "/chats" || path === "/new" : path.startsWith(href);
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
