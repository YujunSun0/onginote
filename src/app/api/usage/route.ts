import { getUsageStatus } from "@/lib/usage";

/** 오늘 사용량 (하루 한도 대비 퍼센트). 금액은 내보내지 않는다. */
export async function GET() {
  return Response.json(await getUsageStatus());
}
