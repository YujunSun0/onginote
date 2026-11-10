import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { rejoinBlockedUntil } from "@/lib/withdrawal";

/** 카카오/구글 로그인 뒤 돌아오는 곳. 받은 code 를 로그인 세션(쿠키)으로 바꾼다. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/";
  // 외부 주소로 보내는 오픈 리다이렉트를 막는다
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  const forwardedHost = request.headers.get("x-forwarded-host"); // 배포 환경의 로드밸런서 뒤 원래 주소
  const base = process.env.NODE_ENV !== "development" && forwardedHost ? `https://${forwardedHost}` : origin;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const user = data.user;
      // 방금 만들어진 계정인지 (기존 회원을 잘못 지우지 않도록)
      const isNew = Date.now() - new Date(user.created_at).getTime() < 10 * 60 * 1000;

      const reject = async (query: string) => {
        await supabase.auth.signOut();
        if (isNew) await createAdminClient().auth.admin.deleteUser(user.id);
        return NextResponse.redirect(`${base}/login?${query}`);
      };

      // 이메일은 재가입 제한과 계정 확인에 필요해서 필수다
      if (!user.email) return reject("error=email");
      const until = await rejoinBlockedUntil(user.email);
      if (until) return reject(`error=rejoin&until=${until}`);

      return NextResponse.redirect(`${base}${next}`);
    }
    console.error("auth callback failed", error);
  }
  return NextResponse.redirect(`${base}/login?error=auth`);
}
