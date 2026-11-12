import { Suspense } from "react";
import SummaryClient from "./SummaryClient";

// params 는 요청 시점에만 알 수 있어서 Suspense 안에서 읽는다 (Next.js 16)
async function WithId({ params }: { params: PageProps<"/chat/[id]/summary">["params"] }) {
  const { id } = await params;
  return <SummaryClient id={id} />;
}

export default function Page({ params }: PageProps<"/chat/[id]/summary">) {
  return (
    <Suspense fallback={<main className="p-6 text-muted">불러오는 중…</main>}>
      <WithId params={params} />
    </Suspense>
  );
}
