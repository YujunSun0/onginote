import { requireUser } from "@/lib/auth";
import { getUsageHistory } from "@/lib/usage-history";

/** 내 날짜별 사용량 (한 달). ?month=YYYY-MM. 금액은 내보내지 않고 하루 한도 대비 % 만 */
export async function GET(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const month = new URL(req.url).searchParams.get("month");
  try {
    return Response.json(await getUsageHistory(auth.ctx.userId, month), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "사용량을 불러오지 못했어요." }, { status: 500 });
  }
}
