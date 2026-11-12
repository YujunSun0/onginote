"use client";

import { useEffect } from "react";

/** 서비스 워커 등록 (설치·오프라인 안내용). 개발 중에는 화면 갱신을 방해하지 않도록 등록하지 않는다. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}
