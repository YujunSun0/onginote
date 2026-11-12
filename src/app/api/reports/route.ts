import { requireUser } from "@/lib/auth";
import { apiErrorMessage } from "@/lib/claude";
import { REPORT_PRICE_KRW } from "@/lib/plans";
import { ReportError, countSummarized, createReport, latestReport, reportProgress, toView, topCharacter } from "@/lib/reports";

/** AI 응답을 기다리는 시간 (초) */
export const maxDuration = 300;

/** 리포트 화면: 해금 진행도와 가장 최근 리포트 (결제 전이면 미리보기만) */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const [summarized, latest, characterId] = await Promise.all([countSummarized(auth.ctx), latestReport(auth.ctx), topCharacter(auth.ctx)]);
  return Response.json({
    progress: reportProgress(summarized, latest?.source_count ?? null),
    report: latest ? toView(latest, characterId) : null,
    price: REPORT_PRICE_KRW,
  });
}

/** 리포트 만들기 (정리한 상담이 충분할 때만) */
export async function POST() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const [summarized, latest] = await Promise.all([countSummarized(auth.ctx), latestReport(auth.ctx)]);
  const progress = reportProgress(summarized, latest?.source_count ?? null);
  if (!progress.canCreate) {
    return Response.json({ error: `정리한 상담이 ${progress.remaining}개 더 있으면 리포트를 만들 수 있어요.`, progress }, { status: 400 });
  }
  try {
    const row = await createReport(auth.ctx, summarized);
    return Response.json({ report: toView(row, await topCharacter(auth.ctx)) });
  } catch (err) {
    if (err instanceof ReportError) return Response.json({ error: err.message }, { status: err.status });
    console.error("report create failed", err);
    return Response.json({ error: apiErrorMessage(err) }, { status: 502 });
  }
}
