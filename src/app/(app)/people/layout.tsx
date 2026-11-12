import { PeopleSidebar } from "@/components/PeopleSidebar";

/** 사람 목록, 프로필, 새 사람 등록. PC(lg 이상)에서는 왼쪽에 사람 목록을 계속 띄운다. */
export default function PeopleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lg:flex">
      <aside
        aria-label="사람 목록"
        className="sticky top-0 hidden h-dvh w-[300px] shrink-0 flex-col border-r border-line bg-cream lg:flex"
      >
        <PeopleSidebar />
      </aside>
      <div className="min-w-0 lg:flex-1">{children}</div>
    </div>
  );
}
