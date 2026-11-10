import type { Ctx } from "./db";
import { createClient } from "./supabase/server";

/**
 * API 라우트 맨 앞에서 부른다. 로그인했으면 { ctx } 를, 아니면 401 응답을 돌려준다.
 *
 *   const auth = await requireUser();
 *   if ("response" in auth) return auth.response;
 *   const { ctx } = auth;
 *
 * proxy.ts 도 확인하지만 그건 화면 이동용이라, 실제 권한 확인은 여기서 한다.
 */
export async function requireUser(): Promise<{ ctx: Ctx } | { response: Response }> {
  const sb = await createClient();
  const { data } = await sb.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { response: Response.json({ error: "로그인이 필요해요." }, { status: 401 }) };
  return { ctx: { sb, userId } };
}
