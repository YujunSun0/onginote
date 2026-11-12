import type { Metadata, Viewport } from "next";
import { Jua, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const jua = Jua({ weight: "400", variable: "--font-jua", preload: false });
const noto = Noto_Sans_KR({ weight: ["400", "500", "700"], variable: "--font-noto", preload: false });

const DESCRIPTION = "연애, 친구, 가족 등 사람 사이 고민을 AI 캐릭터에게 털어놓고, 상황 정리와 다음에 할 일까지 남겨 주는 상담 노트";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://onginote.vercel.app"),
  title: "온기노트",
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "온기노트",
    locale: "ko_KR",
    title: "온기노트 · 사람 때문에 고민될 때, 털어놓고 정리까지",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#FFE7D6",
};

/** 화면 틀은 (app)/layout.tsx(서비스 화면)와 landing(소개 화면)이 각자 정한다 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={`${jua.variable} ${noto.variable}`}>
      <body>{children}</body>
    </html>
  );
}
