import { requireUser } from "@/lib/auth";
import { getUsageStatus } from "@/lib/usage";

/** 오늘 내 사용량 (내 하루 한도 대비 퍼센트). 금액은 내보내지 않는다. */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  return Response.json(await getUsageStatus(auth.ctx.userId));
}
