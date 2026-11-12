import Link from "next/link";
import { Suspense } from "react";
import { CharacterFace } from "@/components/CharacterFace";
import { LoginButtons } from "./LoginButtons";
import { REJOIN_BLOCK_DAYS } from "@/lib/withdrawal";

export const metadata = { title: "로그인 · 온기노트" };

/** 로그인하지 않은 사람은 proxy.ts 가 여기로 보낸다. ?next= 는 로그인 뒤 돌아갈 곳. */
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <CharacterFace id="mongle" size={112} />
          <h1 className="pt-4 font-display text-3xl text-accent-text">온기노트</h1>
          <p className="pt-2 text-[15px] leading-relaxed text-ink-soft">
            누구에게도 말하기 어려운 연애 고민,
            <br />
            캐릭터랑 같이 정리해 봐요.
          </p>
        </div>

        {/* 주소의 ?next=, 안내 문구는 요청 때만 알 수 있어서 이 부분만 나중에 채운다 */}
        <Suspense fallback={<div className="min-h-[136px]" />}>
          <LoginBody searchParams={searchParams} />
        </Suspense>

        <p className="pt-6 text-center text-xs leading-relaxed text-muted">
          상담 내용은 로그인한 본인만 볼 수 있어요.
          <br />
          캐릭터는 AI예요. 답변은 AI가 만들어요.
        </p>
        <nav className="flex justify-center gap-3 pt-4 text-xs text-muted">
          <Link href="/terms" className="underline underline-offset-2">이용약관</Link>
          <Link href="/privacy" className="font-bold underline underline-offset-2">개인정보 처리방침</Link>
          <Link href="/ai-notice" className="underline underline-offset-2">AI 답변 안내</Link>
        </nav>
      </div>
    </main>
  );
}

async function LoginBody({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") ? sp.next : "/";
  const notice = loginNotice(sp);
  return (
    <>
      {notice && (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          className={`mt-6 rounded-2xl bg-white px-4 py-3 text-center text-sm leading-relaxed ${notice.tone === "error" ? "text-danger" : "text-ink-soft"}`}
        >
          {notice.lines.map((l) => (
            <p key={l}>{l}</p>
          ))}
        </div>
      )}
      <LoginButtons next={next} />
    </>
  );
}

type Notice = { tone: "error" | "info"; lines: string[] };

function loginNotice(sp: Record<string, string | string[] | undefined>): Notice | null {
  if (sp.withdrawn === "1")
    return {
      tone: "info",
      lines: [
        "탈퇴가 끝났어요. 그동안 고마웠어요.",
        "카카오로 가입했다면 카카오톡 > 설정 > 카카오계정 > 연결된 서비스 관리에서 온기노트 연결도 끊을 수 있어요.",
      ],
    };
  if (sp.error === "email")
    return { tone: "error", lines: ["이메일 제공에 동의해야 가입할 수 있어요.", "다시 로그인하면서 이메일 항목에 동의해 주세요."] };
  if (sp.error === "rejoin") {
    const until = typeof sp.until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.until) ? sp.until : null;
    const [, m, d] = until?.split("-").map(Number) ?? [];
    return {
      tone: "error",
      lines: [
        `탈퇴한 뒤 ${REJOIN_BLOCK_DAYS}일 동안은 같은 이메일로 다시 가입할 수 없어요.`,
        ...(until ? [`${m}월 ${d}일부터 다시 가입할 수 있어요.`] : []),
      ],
    };
  }
  if (sp.error === "auth") return { tone: "error", lines: ["로그인하지 못했어요. 다시 시도해 주세요."] };
  return null;
}
