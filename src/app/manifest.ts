import type { MetadataRoute } from "next";

/**
 * 홈 화면에 설치했을 때의 앱 정보.
 * 앱은 /login 으로 시작한다: 처음이면 로그인 화면, 이미 로그인했으면 proxy.ts 가 홈으로 보낸다 (소개 화면은 거치지 않음).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "온기노트",
    short_name: "온기노트",
    description: "사람 때문에 고민될 때, 털어놓고 정리까지",
    lang: "ko",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fff8f1",
    theme_color: "#ffe7d6",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // 아이콘 배경이 끝까지 차 있어서 안드로이드가 원·둥근 사각형으로 잘라도 곰이 잘리지 않는다
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
