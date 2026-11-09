import type { Metadata, Viewport } from "next";
import { Jua, Noto_Sans_KR } from "next/font/google";
import { SideRail } from "@/components/SideRail";
import "./globals.css";

const jua = Jua({ weight: "400", variable: "--font-jua", preload: false });
const noto = Noto_Sans_KR({ weight: ["400", "500", "700"], variable: "--font-noto", preload: false });

export const metadata: Metadata = {
  title: "온기노트",
  description: "캐릭터와 함께하는 연애·관계 고민 상담",
};

export const viewport: Viewport = {
  themeColor: "#FFE7D6",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={`${jua.variable} ${noto.variable}`}>
      <body>
        {/* 모바일·태블릿: 가운데 한 줄 화면. PC(lg 이상): 왼쪽 세로 메뉴 + 화면 전체 */}
        <div className="lg:flex">
          <SideRail />
          <div className="relative mx-auto min-h-dvh max-w-2xl bg-cream md:shadow-[0_0_40px_rgba(43,26,18,0.08)] lg:mx-0 lg:min-w-0 lg:max-w-none lg:flex-1 lg:shadow-none">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
