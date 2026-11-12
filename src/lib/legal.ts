/** 약관·처리방침에 쓰는 운영 정보. 바뀌면 여기만 고친다. */
export const OPERATOR = {
  service: "온기노트",
  name: "온기노트 (개인 운영)",
  privacyOfficer: "온기노트 운영자",
  email: "yujunsun0@gmail.com",
};

/**
 * 사업자 정보. 유료 서비스를 팔려면 약관과 결제 화면에 표시해야 한다 (전자상거래법 제10조).
 * 사업자등록과 통신판매업 신고를 마치면 채운다. 하나라도 비어 있으면 실제(live) 결제를 막는다.
 */
export const BUSINESS: Record<"name" | "ceo" | "regNo" | "mailOrderNo" | "address" | "phone", string | null> = {
  name: null, // 상호
  ceo: null, // 대표자
  regNo: null, // 사업자등록번호
  mailOrderNo: null, // 통신판매업 신고번호 (면제 대상이면 "면제" 등 사유를 적는다)
  address: null, // 사업장 주소
  phone: null, // 고객센터 전화
};
export const BUSINESS_LABELS: Record<keyof typeof BUSINESS, string> = {
  name: "상호",
  ceo: "대표자",
  regNo: "사업자등록번호",
  mailOrderNo: "통신판매업 신고번호",
  address: "주소",
  phone: "전화",
};
export function businessReady(): boolean {
  return Object.values(BUSINESS).every((v) => !!v && v.trim().length > 0);
}

/**
 * 동의 버전. 약관·처리방침 내용이 바뀌어 다시 동의를 받아야 하면 날짜를 올린다.
 * 로그인한 사용자의 app_metadata.consent_version 이 이것과 다르면 /welcome 으로 보낸다.
 */
export const CONSENT_VERSION = "2026-11-12";
export const POLICY_DATE = "2026년 11월 12일";

/** 로그인 없이 볼 수 있는 문서 */
export const LEGAL_PATHS = ["/privacy", "/terms", "/ai-notice"];

/** JWT claims 에서 동의 여부를 본다 (DB 조회 없이) */
export function hasConsented(claims: { app_metadata?: Record<string, unknown> } | null | undefined): boolean {
  return claims?.app_metadata?.consent_version === CONSENT_VERSION;
}
