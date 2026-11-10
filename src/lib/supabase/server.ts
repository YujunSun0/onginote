import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 가 .env.local 에 없어요.");
  }
  return { url, key };
}

/**
 * 로그인한 사용자 권한으로 동작하는 클라이언트. RLS 가 적용돼서 본인 데이터만 보인다.
 * 요청마다 새로 만든다 (쿠키가 요청마다 다르다).
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. 세션 갱신은 proxy.ts 가 맡는다.
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {}
      },
    },
  });
}

/**
 * 서버 전용 관리자 클라이언트 (RLS 무시). 사용량 기록과 서비스 전체 합계처럼
 * 사용자가 직접 건드리면 안 되는 일에만 쓴다. 절대 브라우저로 내보내지 않는다.
 */
let _admin: SupabaseClient | null = null;
export function createAdminClient(): SupabaseClient {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY 가 .env.local 에 없어요.");
  _admin ??= createSupabaseClient(supabaseEnv().url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}
