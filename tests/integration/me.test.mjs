// 계정 2개로 로그인해서: 각자 기능이 되는지, 서로의 데이터가 안 보이는지, 한도가 막는지 확인한다.
import { B, PNG, SKIP_AI, admin, check, makeUser, skip } from "./_lib.mjs";
import { createHmac } from "node:crypto";

export default async function testMe() {
  const A = await makeUser("me-a");
  const Bu = await makeUser("me-b");

  // 닉네임
  const me0 = await A.api("/api/me");
  check("마이 정보 조회", me0.status === 200 && me0.body.email === A.email && me0.body.counts?.persons === 0, JSON.stringify(me0.body).slice(0, 120));
  check("닉네임 빈 값 거부", (await A.api("/api/me", "PATCH", { nickname: "  " })).status === 400);
  check("닉네임 21자 거부", (await A.api("/api/me", "PATCH", { nickname: "가".repeat(21) })).status === 400);
  const nn = await A.api("/api/me", "PATCH", { nickname: "  검증   몽글 " });
  check("닉네임 저장 (공백 정리)", nn.status === 200 && nn.body.nickname === "검증 몽글");
  check("다시 읽으면 바뀐 닉네임", (await A.api("/api/me")).body.nickname === "검증 몽글");
  await Bu.sb.from("profiles").update({ display_name: "해킹" }).eq("id", A.id);
  check("B 가 A 프로필 직접 수정 → 안 바뀜", (await A.api("/api/me")).body.nickname === "검증 몽글");

  // A 기록 만들기 (사진 포함)
  const p = await A.api("/api/persons", "POST", { name: "검증민지" });
  const s = await A.api("/api/sessions", "POST", { characterId: "mongle", personId: p.body.id });
  if (SKIP_AI) {
    skip("A 사진 상담");
    // 탈퇴 후 사용량 기록이 남는지 보려면 기록이 하나는 있어야 한다
    const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    await admin.from("usage").insert({ user_id: A.id, day, kind: "chat", model: "test", cost: 0 });
  } else {
    const chat = await A.api("/api/chat", "POST", { sessionId: s.body.id, text: "이 캡처 봐줘", images: [{ mediaType: "image/png", data: PNG }] });
    check("A 사진 상담", chat.status === 200);
  }
  await Bu.api("/api/persons", "POST", { name: "비밀비밀" });

  // 내려받기
  const ex = await fetch(B + "/api/me/export", { headers: { Cookie: A.cookieStr() } });
  const exj = await ex.json();
  check("내려받기 파일 첨부 헤더", (ex.headers.get("content-disposition") ?? "").startsWith("attachment"));
  check("내려받기에 내 기록", exj.persons?.length === 1 && exj.sessions?.[0]?.messages?.length >= (SKIP_AI ? 1 : 3), `msgs=${exj.sessions?.[0]?.messages?.length}`);
  check("내려받기에 남의 기록·user_id 없음", !JSON.stringify(exj).includes("비밀비밀") && !JSON.stringify(exj).includes(Bu.id) && !("user_id" in (exj.persons?.[0] ?? {})));
  check("비로그인 내려받기 401", (await fetch(B + "/api/me/export")).status === 401);
  const cnt = (await A.api("/api/me")).body.counts;
  check("기록 개수", cnt.persons === 1 && cnt.sessions === 1, JSON.stringify(cnt));

  // 탈퇴
  check("확인 문구 없이 탈퇴 → 400", (await A.api("/api/me", "DELETE", {})).status === 400);
  check("틀린 문구 탈퇴 → 400", (await A.api("/api/me", "DELETE", { confirm: "탈퇴할게" })).status === 400);
  const { data: usageBefore } = await admin.from("usage").select("id").eq("user_id", A.id);
  const delRes = await fetch(B + "/api/me", { method: "DELETE", headers: { "Content-Type": "application/json", Cookie: A.cookieStr() }, body: JSON.stringify({ confirm: "탈퇴" }) });
  const del = { status: delRes.status, body: await delRes.json() };
  check("탈퇴 성공", del.status === 200, JSON.stringify(del.body));
  const setCookies = delRes.headers.getSetCookie();
  check("탈퇴 응답이 로그인 쿠키를 지움", setCookies.some((c) => c.startsWith("sb-") && /Max-Age=0/i.test(c)), setCookies.map((c) => c.split(";").slice(0, 2).join(";").slice(0, 40) + "…").join(" | "));
  const { data: gone } = await admin.auth.admin.getUserById(A.id);
  check("계정 삭제됨", !gone?.user);
  const counts = await Promise.all(["persons", "sessions", "messages", "profiles"].map((t) =>
    admin.from(t).select("*", { count: "exact", head: true }).eq(t === "profiles" ? "id" : "user_id", A.id).then((r) => r.count)));
  check("인물·상담·메시지·프로필 모두 삭제", counts.every((c) => c === 0), counts.join(","));
  const { data: imgs } = await admin.storage.from("chat-images").list(`${A.id}/${s.body.id}`);
  check("사진 삭제", (imgs ?? []).length === 0);
  const { data: kept } = await admin.from("usage").select("id, user_id").in("id", (usageBefore ?? []).map((u) => u.id));
  check("사용량 기록은 남고 계정 연결만 끊김", (usageBefore ?? []).length > 0 && kept.length === usageBefore.length && kept.every((u) => u.user_id === null), `${kept?.length}/${usageBefore?.length}`);
  const hash = createHmac("sha256", process.env.ONGI_EMAIL_HASH_KEY).update(A.email).digest("hex");
  const { data: w } = await admin.from("withdrawn_emails").select("*").eq("email_hash", hash).maybeSingle();
  check("재가입 제한 기록 (해시)", Boolean(w));
  const { data: wAll } = await admin.from("withdrawn_emails").select("email_hash");
  check("이메일 원문은 저장 안 됨", !JSON.stringify(wAll).includes("@"));
  const { error: wErr, data: wB } = await Bu.sb.from("withdrawn_emails").select("*");
  check("사용자는 탈퇴 기록 못 읽음", Boolean(wErr) || (wB ?? []).length === 0);
  const after = await A.api("/api/persons");
  console.log("  (참고) 지워지기 전 쿠키를 몰래 보관해 쓴 경우:", after.status, JSON.stringify(after.body).slice(0, 60));
  check("옛 쿠키로도 데이터는 안 보임", after.status === 401 || (Array.isArray(after.body) && after.body.length === 0));
  const afterCreate = await A.api("/api/persons", "POST", { name: "유령" });
  check("옛 쿠키로 새 기록 못 만듦", afterCreate.status !== 200, String(afterCreate.status));
  check("B 기록은 그대로", (await Bu.api("/api/persons")).body.length === 1);

  // 정리
  await admin.from("withdrawn_emails").delete().eq("email_hash", hash);
  await admin.from("usage").delete().in("id", (usageBefore ?? []).map((u) => u.id));
  await admin.from("usage").delete().eq("user_id", Bu.id);
  await admin.auth.admin.deleteUser(Bu.id);
}
