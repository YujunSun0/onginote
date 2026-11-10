import { createBrowserClient } from "@supabase/ssr";

/** 브라우저용 클라이언트. 로그인 버튼(OAuth 시작)에만 쓴다. 데이터는 전부 서버 API 를 거친다. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
