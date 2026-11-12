import { requireUser } from "@/lib/auth";
import { REPORT_PRICE_KRW } from "@/lib/plans";
import { getReport, toView, topCharacter } from "@/lib/reports";

/** 리포트 하나 (본인 것만, RLS). 결제 전이면 미리보기만 */
export async function GET(_req: Request, ctx: RouteContext<"/api/reports/[id]">) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const row = await getReport(auth.ctx, id);
  if (!row) return Response.json({ error: "리포트를 찾을 수 없어요." }, { status: 404 });
  return Response.json({ report: toView(row, await topCharacter(auth.ctx)), price: REPORT_PRICE_KRW });
}
