import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { LEGAL_PATHS, hasConsented } from "@/lib/legal";

/**
 * 1) 요청마다 로그인 토큰을 갱신해서 쿠키에 다시 써 준다 (서버 컴포넌트는 쿠키를 못 쓴다).
 * 2) 로그인하지 않았으면 화면은 /login 으로 보내고, API 는 401 을 준다.
 * 3) 로그인했지만 약관·개인정보 동의 전이면 /welcome 으로 보내고, API 는 403 을 준다.
 *
 * 이건 화면 이동용 1차 확인일 뿐이다. 실제 권한 확인은 각 API 의 requireUser() 와 DB 의 RLS 가 한다.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          // 토큰이 갱신된 응답을 CDN 이 캐시해서 다른 사람에게 주지 않도록
          Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    },
  );

  // createServerClient 와 getClaims 사이에 다른 코드를 넣지 말 것 (무작위 로그아웃의 원인이 된다)
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  const path = request.nextUrl.pathname;
  const isLegal = LEGAL_PATHS.includes(path);
  // /api/billing/renew 는 스케줄러가 부른다 (로그인 대신 CRON_SECRET 으로 확인)
  const isPublic =
    path === "/login" ||
    path === "/landing" ||
    path === "/robots.txt" ||
    path === "/sitemap.xml" ||
    path.startsWith("/auth/") ||
    isLegal ||
    path === "/api/billing/renew";
  // 처음 온 사람이 첫 주소로 오면 소개 화면을 보여 준다 (주소는 / 그대로).
  // 앱은 시작 주소를 /login 으로 두므로 소개 화면 없이 바로 로그인한다.
  if (!signedIn && path === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/landing";
    return rewriteWithCookies(url, request, response);
  }
  if (!signedIn && !isPublic) {
    if (path.startsWith("/api/")) {
      return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = path === "/" ? "" : `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return redirectWithCookies(url, response);
  }
  if (signedIn && path === "/login") {
    return redirectWithCookies(new URL("/", request.url), response);
  }

  // 동의 전에는 동의 화면, 약관 문서, 동의 API 만 쓸 수 있다 (대화가 국외로 전송되기 전에 동의를 받는다)
  if (signedIn) {
    const consented = hasConsented(data?.claims);
    const consentFree = isPublic || path === "/welcome" || path === "/api/me/consent";
    if (!consented && !consentFree) {
      if (path.startsWith("/api/")) {
        return Response.json({ error: "서비스 이용 동의가 필요해요.", needConsent: true }, { status: 403 });
      }
      const url = request.nextUrl.clone();
      url.pathname = "/welcome";
      url.search = path === "/" ? "" : `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
      return redirectWithCookies(url, response);
    }
    if (consented && path === "/welcome") {
      return redirectWithCookies(new URL("/", request.url), response);
    }
  }
  return response;
}

/** 화면만 바꿔 끼울 때도 갱신된 쿠키를 같이 보낸다. */
function rewriteWithCookies(url: URL, request: NextRequest, from: NextResponse) {
  const res = NextResponse.rewrite(url, { request });
  from.cookies.getAll().forEach((c) => res.cookies.set(c));
  return res;
}

/** 리다이렉트할 때도 갱신된 쿠키를 같이 보내야 다음 요청에서 로그아웃되지 않는다. */
function redirectWithCookies(url: URL, from: NextResponse) {
  const res = NextResponse.redirect(url);
  from.cookies.getAll().forEach((c) => res.cookies.set(c));
  for (const h of ["cache-control", "expires", "pragma"]) {
    const v = from.headers.get(h);
    if (v) res.headers.set(h, v);
  }
  return res;
}

export const config = {
  // 정적 파일과 이미지 최적화 요청은 건너뛴다
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
