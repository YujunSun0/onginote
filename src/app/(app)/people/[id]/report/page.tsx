import { Suspense } from "react";
import RelationshipReportClient from "./RelationshipReportClient";

// params 는 요청 시점에만 알 수 있어서 Suspense 안에서 읽는다 (Next.js 16)
async function WithId({ params }: { params: PageProps<"/people/[id]/report">["params"] }) {
  const { id } = await params;
  return <RelationshipReportClient id={id} />;
}

export default function Page({ params }: PageProps<"/people/[id]/report">) {
  return (
    <Suspense fallback={<main className="p-6 text-muted">불러오는 중…</main>}>
      <WithId params={params} />
    </Suspense>
  );
}
