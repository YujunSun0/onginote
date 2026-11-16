import { requireUser } from "@/lib/auth";
import { apiErrorMessage } from "@/lib/claude";
import { canRefresh, createRecap, getRecapRow, recapProgress, toRecapView } from "@/lib/recap";
import { RECAP_MIN_DAYS, RECAP_MIN_SESSIONS, RECAP_SEASON, recapState } from "@/lib/recap-types";
import { ReportError } from "@/lib/reports";

/** AI 응답을 기다리는 시간 (초) */
export const maxDuration = 120;

/** 연말 결산 화면: 기간, 열리는 조건 진행도, 만든 결산 */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const [progress, row] = await Promise.all([recapProgress(auth.ctx), getRecapRow(auth.ctx)]);
  return Response.json({
    season: RECAP_SEASON,
    state: recapState(),
    need: { sessions: RECAP_MIN_SESSIONS, days: RECAP_MIN_DAYS },
    progress,
    recap: row ? await toRecapView(auth.ctx, row) : null,
    canRefresh: canRefresh(row, progress),
    collecting: Date.now() < Date.parse(RECAP_SEASON.dataEnd),
  });
}

/** 결산 만들기 (기간 안, 조건을 채웠을 때). 이미 있으면 상담이 더 쌓였을 때만 새로 */
export async function POST() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const state = recapState();
  if (state !== "open") {
    return Response.json({ error: state === "before" ? "결산은 12월 15일에 열려요." : "이번 결산은 마감됐어요." }, { status: 403 });
  }
  const [progress, row] = await Promise.all([recapProgress(auth.ctx), getRecapRow(auth.ctx)]);
  if (!progress.ok) {
    return Response.json({ error: `상담 ${RECAP_MIN_SESSIONS}개, 대화한 날 ${RECAP_MIN_DAYS}일이 모이면 결산을 볼 수 있어요.`, progress }, { status: 400 });
  }
  if (row && !canRefresh(row, progress)) return Response.json({ recap: await toRecapView(auth.ctx, row) });
  try {
    const made = await createRecap(auth.ctx, row);
    return Response.json({ recap: await toRecapView(auth.ctx, made) });
  } catch (err) {
    if (err instanceof ReportError) return Response.json({ error: err.message }, { status: err.status });
    console.error("recap create failed", err);
    return Response.json({ error: apiErrorMessage(err) }, { status: 502 });
  }
}
