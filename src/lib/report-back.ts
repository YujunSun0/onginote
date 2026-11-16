"use client";

/**
 * 결제창에서 돌아왔을 때 어느 리포트 화면으로 갈지.
 * 결제창을 열기 직전에 적어 두고, 성공·실패 화면이 읽는다 (같은 탭이라 sessionStorage 로 충분하다).
 */
const KEY = "onginote:report-back";

export function rememberReportBack(path: string) {
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    // 저장이 막혀 있으면 기본 리포트 화면으로 돌아간다
  }
}

export function reportBackHref(): string {
  try {
    const v = sessionStorage.getItem(KEY);
    if (v && v.startsWith("/") && !v.startsWith("//")) return v;
  } catch {
    // 위와 같음
  }
  return "/report";
}
