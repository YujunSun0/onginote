/** 약관·처리방침에 쓰는 운영 정보. 바뀌면 여기만 고친다. */
export const OPERATOR = {
  service: "온기노트",
  name: "온기노트 (개인 운영)",
  privacyOfficer: "온기노트 운영자",
  email: "yujunsun0@gmail.com",
};

/**
 * 동의 버전. 약관·처리방침 내용이 바뀌어 다시 동의를 받아야 하면 날짜를 올린다.
 * 로그인한 사용자의 app_metadata.consent_version 이 이것과 다르면 /welcome 으로 보낸다.
 */
export const CONSENT_VERSION = "2026-11-11";
export const POLICY_DATE = "2026년 11월 11일";

/** 로그인 없이 볼 수 있는 문서 */
export const LEGAL_PATHS = ["/privacy", "/terms", "/ai-notice"];

/** JWT claims 에서 동의 여부를 본다 (DB 조회 없이) */
export function hasConsented(claims: { app_metadata?: Record<string, unknown> } | null | undefined): boolean {
  return claims?.app_metadata?.consent_version === CONSENT_VERSION;
}
