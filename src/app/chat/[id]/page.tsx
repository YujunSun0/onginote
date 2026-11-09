import { Suspense } from "react";
import ChatClient from "./ChatClient";

// params 는 요청 시점에만 알 수 있어서 Suspense 안에서 읽는다 (Next.js 16)
async function WithId({ params }: { params: PageProps<"/chat/[id]">["params"] }) {
  const { id } = await params;
  return <ChatClient id={id} />;
}

export default function Page({ params }: PageProps<"/chat/[id]">) {
  return (
    <Suspense fallback={<main className="p-6 text-muted">불러오는 중…</main>}>
      <WithId params={params} />
    </Suspense>
  );
}
