import { requireUser } from "@/lib/auth";
import { BillingError, startSubscription } from "@/lib/billing";

/** AI·결제 응답을 기다리는 시간 (Vercel 함수 최대 실행 시간, 초) */
export const maxDuration = 300;

/** 카드 등록 성공 화면에서 부른다: 빌링키 발급 + 첫 달 결제 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const body = (await req.json().catch(() => ({}))) as { authKey?: unknown; customerKey?: unknown };
  if (typeof body.authKey !== "string" || typeof body.customerKey !== "string" || !body.authKey || !body.customerKey) {
    return Response.json({ error: "카드 등록 정보가 없어요." }, { status: 400 });
  }
  try {
    const { data } = await auth.ctx.sb.auth.getUser();
    const result = await startSubscription(auth.ctx.userId, body.authKey, body.customerKey, data.user?.email);
    return Response.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof BillingError) return Response.json({ error: err.message, code: err.code }, { status: err.status });
    console.error(err);
    return Response.json({ error: "결제를 처리하지 못했어요. 결제가 됐는지 마이페이지에서 확인해 주세요." }, { status: 500 });
  }
}
