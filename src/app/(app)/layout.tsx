import { SideRail } from "@/components/SideRail";

/** 서비스 화면 틀. 모바일·태블릿: 가운데 한 줄 화면. PC(lg 이상): 왼쪽 세로 메뉴 + 화면 전체 */
export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="lg:flex">
      <SideRail />
      <div className="relative mx-auto min-h-dvh max-w-2xl bg-cream md:shadow-[0_0_40px_rgba(43,26,18,0.08)] lg:mx-0 lg:min-w-0 lg:max-w-none lg:flex-1 lg:shadow-none">
        {children}
      </div>
    </div>
  );
}
