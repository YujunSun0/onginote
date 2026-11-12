import { timingSafeEqual } from "node:crypto";
import { runRenewals } from "@/lib/billing";

/** AI·결제 응답을 기다리는 시간 (Vercel 함수 최대 실행 시간, 초) */
export const maxDuration = 300;

/**
 * 하루 한 번 부르는 자동 결제 (로그인 없이, CRON_SECRET 으로만).
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/billing/renew
 * 배포 후에는 GitHub Actions(.github/workflows/billing-renew.yml)가 매일 부른다.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  if (!secret || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return Response.json(await runRenewals());
  } catch (err) {
    console.error("renewals failed", err);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
