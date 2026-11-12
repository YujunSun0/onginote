"use client";

import Link from "next/link";
import { useEffect } from "react";

/** 인쇄 창 열기 버튼. 처음 열면 사진이 다 뜬 뒤 인쇄 창을 한 번 자동으로 띄운다. 인쇄물에는 안 나온다. */
export function PrintToolbar() {
  useEffect(() => {
    let cancelled = false;
    const imgs = [...document.images].filter((i) => !i.complete);
    const loaded = (i: HTMLImageElement) =>
      new Promise((done) => {
        i.addEventListener("load", done, { once: true });
        i.addEventListener("error", done, { once: true });
      });
    Promise.all(imgs.map(loaded))
      .then(() => document.fonts.ready)
      .then(() => {
        if (!cancelled) setTimeout(() => window.print(), 300);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="sticky top-0 z-10 -mx-6 mb-2 flex items-center justify-between gap-3 border-b border-line bg-white/95 px-6 py-3 print:hidden">
      <Link href="/me" className="text-sm text-muted">
        ← 마이페이지
      </Link>
      <div className="flex items-center gap-3">
        <p className="hidden text-xs text-muted sm:block">인쇄 창에서 대상을 &lsquo;PDF로 저장&rsquo;으로 골라 주세요</p>
        <button type="button" onClick={() => window.print()} className="h-10 rounded-full bg-accent px-5 text-sm font-bold text-white">
          PDF로 저장
        </button>
      </div>
    </div>
  );
}
