import { SessionList } from "@/components/SessionList";

/** 상담 목록, 채팅, 정리 카드, 새 상담. PC(lg 이상)에서는 왼쪽에 상담 목록을 계속 띄운다. */
export default function SessionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lg:flex">
      <aside
        aria-label="상담 목록"
        className="sticky top-0 hidden h-dvh w-[300px] shrink-0 flex-col border-r border-line bg-cream lg:flex"
      >
        <SessionList variant="sidebar" />
      </aside>
      <div className="min-w-0 lg:flex-1">{children}</div>
    </div>
  );
}
