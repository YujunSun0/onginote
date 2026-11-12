// 계정 2개로 로그인해서: 각자 기능이 되는지, 서로의 데이터가 안 보이는지, 한도가 막는지 확인한다.
import { B, PNG, SKIP_AI, admin, check, makeUser, skip } from "./_lib.mjs";

export default async function testIsolation() {
  const A = await makeUser("a");
  const Bu = await makeUser("b");

  // 로그인 안 한 요청
  const anon = await fetch(B + "/api/sessions");
  check("비로그인 API는 401", anon.status === 401, String(anon.status));
  const anonPage = await fetch(B + "/chats", { redirect: "manual" }); // / 는 이제 랜딩
  check("비로그인 화면은 /login 으로", anonPage.status >= 300 && anonPage.status < 400 && (anonPage.headers.get("location") ?? "").includes("/login"));

  // A: 인물, 상담, 사진 메시지
  const p = await A.api("/api/persons", "POST", { name: "검증민지", mbti: "enfp" });
  check("A 인물 만들기", p.status === 200 && p.body.mbti === "ENFP");
  const s = await A.api("/api/sessions", "POST", { characterId: "mongle", personId: p.body.id });
  check("A 상담 만들기 + 첫 인사", s.status === 200 && s.body.messages?.length === 1);
  const r = await fetch(B + "/api/chat", { method: "POST", headers: { "Content-Type": "application/json", Cookie: "" }, body: "{}" });
  check("쿠키 없는 채팅은 401", r.status === 401);

  let img;
  if (SKIP_AI) {
    skip("A 채팅 답변 (사진 포함), 사진 저장, 정리하기");
  } else {
    const chat = await A.api("/api/chat", "POST", { sessionId: s.body.id, text: "민지가 이 캡처처럼 답장했는데 무슨 뜻일까?", images: [{ mediaType: "image/png", data: PNG }] });
    const lines = String(chat.raw).split("\n").filter(Boolean).map((l) => JSON.parse(l));
    const reply = lines.filter((e) => e.type === "text").map((e) => e.delta).join("");
    check("A 채팅 답변 (사진 포함)", chat.status === 200 && reply.length > 0 && !lines.some((e) => e.type === "error"), reply.slice(0, 60).replace(/\n/g, " "));

    const full = await A.api(`/api/sessions/${s.body.id}`);
    img = full.body.session?.messages?.find((m) => m.images?.length)?.images?.[0];
    check("사진은 Storage 경로 + 서명 URL", Boolean(img?.path?.startsWith(A.id + "/") && img?.url && !img?.data));
    if (img?.url) check("서명 URL 로 사진 열림", (await fetch(img.url)).status === 200);

    const sum = await A.api(`/api/sessions/${s.body.id}/summary`, "POST");
    check("A 정리하기", sum.status === 200 && Boolean(sum.body.summary?.title), sum.body.summary?.title ?? JSON.stringify(sum.body).slice(0, 80));
    const list = await A.api("/api/sessions");
    check("A 목록에 정리 상태 표시", list.body.find?.((x) => x.id === s.body.id)?.summaryState === "done");
  }

  // 격리: B 는 A 의 것을 볼 수도, 고칠 수도, 지울 수도 없다
  check("B 인물 목록에 A 인물 없음", Array.isArray((await Bu.api("/api/persons")).body) && (await Bu.api("/api/persons")).body.length === 0);
  check("B 상담 목록에 A 상담 없음", (await Bu.api("/api/sessions")).body.length === 0);
  check("B 가 A 상담 조회 → 404", (await Bu.api(`/api/sessions/${s.body.id}`)).status === 404);
  check("B 가 A 인물 조회 → 404", (await Bu.api(`/api/persons/${p.body.id}`)).status === 404);
  check("B 가 A 인물 수정 → 404", (await Bu.api(`/api/persons/${p.body.id}`, "PATCH", { name: "해킹" })).status === 404);
  const bChat = await Bu.api("/api/chat", "POST", { sessionId: s.body.id, text: "끼어들기" });
  check("B 가 A 상담에 메시지 → 404", bChat.status === 404);
  await Bu.api(`/api/sessions/${s.body.id}`, "DELETE");
  check("B 가 A 상담 삭제 시도해도 그대로", (await A.api(`/api/sessions/${s.body.id}`)).status === 200);
  const bSess = await Bu.api("/api/sessions", "POST", { characterId: "mongle", personId: p.body.id });
  check("B 가 A 인물로 상담 만들기 → 인물 연결 안 됨", bSess.status !== 200 || bSess.body.personId === null, JSON.stringify(bSess.body).slice(0, 80));

  // DB 직접 접근도 막히는지 (브라우저에서 공개 키로 직접 부르는 경우)
  const { data: direct } = await Bu.sb.from("sessions").select("id");
  check("B 공개 키로 DB 직접 조회해도 A 상담 안 보임", !(direct ?? []).some((x) => x.id === s.body.id));
  const { error: usageIns } = await Bu.sb.from("usage").insert({ user_id: Bu.id, day: "2026-01-01", kind: "chat", model: "x", cost: 0 });
  check("사용자가 usage 에 직접 쓰기 → 거부", Boolean(usageIns));
  const { error: usageDel, count } = await A.sb.from("usage").delete({ count: "exact" }).eq("user_id", A.id);
  check("사용자가 usage 지우기 → 0건", !usageDel && !count, `count=${count}`);
  const { data: dl } = await Bu.sb.storage.from("chat-images").download(img?.path ?? "x");
  check("B 가 A 사진 내려받기 → 실패", !dl);
  const { error: rpcErr } = await Bu.sb.rpc("usage_spent", { p_day: "2026-01-01", p_user: null });
  check("사용자가 전체 사용량 합계 함수 호출 → 거부", Boolean(rpcErr));

  // 사용량과 한도
  const ua = await A.api("/api/usage");
  if (SKIP_AI) skip("A 사용량 > 0%");
  else check("A 사용량 > 0%", ua.body.percent > 0, `${ua.body.percent}%`);
  const ub = await Bu.api("/api/usage");
  check("B 사용량은 0% (A 와 따로)", ub.body.percent === 0, `${ub.body.percent}%`);
  const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  await admin.from("usage").insert({ user_id: Bu.id, day, kind: "chat", model: "test", cost: 1 });
  const ub2 = await Bu.api("/api/usage");
  check("B 한도 초과 표시", ub2.body.exceeded === true && ub2.body.percent === 100);
  const bS2 = await Bu.api("/api/sessions", "POST", { characterId: "olly", personId: null });
  const blocked = await Bu.api("/api/chat", "POST", { sessionId: bS2.body.id, text: "안녕" });
  check("B 한도 초과 → 채팅 429", blocked.status === 429, blocked.body.error);
  check("A 는 B 한도와 상관없이 정상", (await A.api("/api/usage")).body.exceeded === false);

  // 삭제 시 사진도 지워지는지
  await A.api(`/api/persons/${p.body.id}`, "DELETE");
  const { data: left } = await admin.storage.from("chat-images").list(`${A.id}/${s.body.id}`);
  check("인물 삭제 → 상담과 사진도 삭제", (await A.api(`/api/sessions/${s.body.id}`)).status === 404 && (left ?? []).length === 0);

  // 정리
  await admin.from("usage").delete().in("user_id", [A.id, Bu.id]);
  await admin.auth.admin.deleteUser(A.id);
  await admin.auth.admin.deleteUser(Bu.id);
}
