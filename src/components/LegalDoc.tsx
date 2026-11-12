import Link from "next/link";
import { POLICY_DATE } from "@/lib/legal";
import { BusinessInfo } from "./BusinessInfo";
import { LegalClose } from "./LegalClose";

/** 약관·처리방침·AI 안내 공통 틀. 로그인 없이도 열린다. */
export function LegalDoc({ title, intro, children }: { title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-16 pt-2 text-[14px] leading-relaxed text-ink-soft lg:px-10 lg:pt-5">
      <div className="sticky top-0 z-10 -mx-5 flex items-center justify-between gap-3 border-b border-line bg-cream px-5 py-1.5 lg:-mx-10 lg:px-10">
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <Link href="/" className="font-bold text-accent-text">온기노트</Link>
          <Link href="/terms" replace className="hover:underline">이용약관</Link>
          <Link href="/privacy" replace className="hover:underline">개인정보 처리방침</Link>
          <Link href="/ai-notice" replace className="hover:underline">AI 답변 안내</Link>
        </nav>
        <LegalClose />
      </div>
      <div className="pb-4" />
      <h1 className="font-display text-[28px] text-ink">{title}</h1>
      <p className="pt-1 text-xs text-muted">시행일 {POLICY_DATE}</p>
      {intro && <div className="pt-4">{intro}</div>}
      <div className="flex flex-col gap-7 pt-6">{children}</div>
      <BusinessInfo className="mt-10 border-t border-line pt-4" />
    </main>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="pb-2 text-[16px] font-bold text-ink">{title}</h2>
      <div className="flex flex-col gap-2 [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc">{children}</div>
    </section>
  );
}

export function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <>
      {/* 휴대폰: 행마다 카드 하나 (첫 칸이 제목) */}
      <div className="flex flex-col gap-2 sm:hidden">
        {rows.map((r, i) => (
          <dl key={i} className="rounded-xl border border-line bg-white px-3.5 py-3 text-[13px]">
            <dt className="font-bold text-ink">{r[0]}</dt>
            {r.slice(1).map((c, j) => (
              <dd key={j} className="pt-1">
                {head.length > 2 && <span className="text-[11px] text-muted">{head[j + 1]} · </span>}
                {c}
              </dd>
            ))}
          </dl>
        ))}
      </div>
      <TableWide head={head} rows={rows} />
    </>
  );
}

function TableWide({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="hidden overflow-x-auto rounded-xl border border-line bg-white sm:block">
      <table className="w-full text-left text-[13px]">
        <thead className="bg-cream text-ink">
          <tr>{head.map((h) => <th key={h} className="px-3 py-2 font-bold">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line align-top">
              {r.map((c, j) => <td key={j} className="px-3 py-2">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
