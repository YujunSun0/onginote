import { BUSINESS, BUSINESS_LABELS, OPERATOR, businessReady } from "@/lib/legal";

/** 사업자 정보 (약관 문서와 결제 화면 아래). 등록 전이면 안내만 보여준다. */
export function BusinessInfo({ className = "" }: { className?: string }) {
  const ready = businessReady();
  return (
    <div className={`text-[11px] leading-relaxed text-muted ${className}`}>
      <p className="font-bold">사업자 정보</p>
      {ready ? (
        <p>
          {(Object.keys(BUSINESS) as (keyof typeof BUSINESS)[]).map((k, i) => (
            <span key={k}>
              {i > 0 && " · "}
              {BUSINESS_LABELS[k]} {BUSINESS[k]}
            </span>
          ))}
          {" · "}이메일 {OPERATOR.email}
        </p>
      ) : (
        <p>사업자등록 후 표시돼요. · 문의 {OPERATOR.email}</p>
      )}
    </div>
  );
}
