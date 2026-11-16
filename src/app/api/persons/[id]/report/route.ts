import { requireUser } from "@/lib/auth";
import { apiErrorMessage } from "@/lib/claude";
import { getPerson } from "@/lib/db";
import { RELATIONSHIP_REPORT_PRICE_KRW } from "@/lib/plans";
import {
  countPersonSummarized,
  createRelationshipReport,
  latestRelationshipReport,
  personTopCharacter,
  relationshipProgress,
  toRelationshipView,
} from "@/lib/relationship-reports";
import { ReportError, latestReport } from "@/lib/reports";

/** AI 응답을 기다리는 시간 (초) */
export const maxDuration = 300;

/** 관계 흐름 리포트 화면: 그 사람과의 해금 진행도와 가장 최근 리포트 (결제 전이면 미리보기만) */
export async function GET(_req: Request, ctx: RouteContext<"/api/persons/[id]/report">) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const person = await getPerson(auth.ctx, id);
  if (!person) return Response.json({ error: "사람을 찾을 수 없어요." }, { status: 404 });
  const [summarized, latest, characterId, personality] = await Promise.all([
    countPersonSummarized(auth.ctx, id),
    latestRelationshipReport(auth.ctx, id),
    personTopCharacter(auth.ctx, id),
    latestReport(auth.ctx),
  ]);
  return Response.json({
    person: { id: person.id, name: person.name, relation: person.relation },
    progress: relationshipProgress(summarized, latest?.source_count ?? null),
    report: latest ? toRelationshipView(latest, characterId) : null,
    price: RELATIONSHIP_REPORT_PRICE_KRW,
    hasPersonality: !!personality,
  });
}

/** 리포트 만들기 (그 사람과 정리한 상담이 충분할 때만) */
export async function POST(_req: Request, ctx: RouteContext<"/api/persons/[id]/report">) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const person = await getPerson(auth.ctx, id);
  if (!person) return Response.json({ error: "사람을 찾을 수 없어요." }, { status: 404 });
  const [summarized, latest] = await Promise.all([countPersonSummarized(auth.ctx, id), latestRelationshipReport(auth.ctx, id)]);
  const progress = relationshipProgress(summarized, latest?.source_count ?? null);
  if (!progress.canCreate) {
    return Response.json({ error: `${person.name}님과 정리한 상담이 ${progress.remaining}개 더 있으면 리포트를 만들 수 있어요.`, progress }, { status: 400 });
  }
  try {
    const row = await createRelationshipReport(auth.ctx, person, summarized);
    return Response.json({ report: toRelationshipView(row, await personTopCharacter(auth.ctx, id)) });
  } catch (err) {
    if (err instanceof ReportError) return Response.json({ error: err.message }, { status: err.status });
    console.error("relationship report create failed", err);
    return Response.json({ error: apiErrorMessage(err) }, { status: 502 });
  }
}
