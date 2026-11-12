// 계정 2개로 로그인해서: 각자 기능이 되는지, 서로의 데이터가 안 보이는지, 한도가 막는지 확인한다.
import { B, CONSENT_VERSION, admin, check, makeUser } from "./_lib.mjs";
import { createHmac } from "node:crypto";

export default async function testConsent() {
  const A = await makeUser("consent-a", { consent: false });

  // 로그인 없이도 문서는 열린다
  for (const p of ["/privacy", "/terms", "/ai-notice"]) {
    const r = await fetch(B + p, { redirect: "manual" });
    const html = await r.text();
    check(`비로그인 ${p} 열림`, r.status === 200 && !html.includes("메인 메뉴"), String(r.status));
  }
  const priv = await (await fetch(B + "/privacy")).text();
  check("처리방침에 국외 이전·보호책임자", priv.includes("Anthropic, PBC") && priv.includes("yujunsun0@gmail.com") && priv.includes("민감정보"));

  // 동의 전
  const blocked = await A.api("/api/persons");
  check("동의 전 API → 403", blocked.status === 403 && blocked.body.needConsent === true, String(blocked.status));
  const home = await A.api("/");
  check("동의 전 홈 → /welcome", home.status >= 300 && home.status < 400, String(home.status));
  const chat = await A.api("/api/chat", "POST", { sessionId: "x", text: "hi" });
  check("동의 전 채팅 → 403 (국외 전송 전 차단)", chat.status === 403);
  check("동의 전 /welcome 열림", (await A.api("/welcome")).status === 200);
  check("동의 전 문서 열림", (await A.api("/privacy")).status === 200);

  // 본인이 user_metadata 로 동의를 위조해도 안 됨
  await A.sb.auth.updateUser({ data: { consent_version: CONSENT_VERSION } });
  await A.sb.auth.refreshSession(); // 새 토큰이 쿠키 통에 들어간다
  const fake = await fetch(B + "/api/persons", { headers: { Cookie: A.cookieStr() } });
  check("user_metadata 위조로는 통과 못 함", fake.status === 403, String(fake.status));

  // 동의
  const part = await A.api("/api/me/consent", "POST", { age14: true, terms: true, privacy: true, sensitive: true });
  check("일부만 동의 → 400", part.status === 400);
  const ok = await A.api("/api/me/consent", "POST", { age14: true, terms: true, privacy: true, sensitive: true, overseas: true });
  check("모두 동의 → 200", ok.status === 200, JSON.stringify(ok.body));
  const after = await A.api("/api/persons");
  check("동의 후 같은 쿠키로 바로 API 사용", after.status === 200, String(after.status));
  const w = await A.api("/welcome");
  check("동의 후 /welcome → 홈으로", w.status >= 300 && w.status < 400);
  const { data: prof } = await admin.from("profiles").select("consent_version, consented_at").eq("id", A.id).single();
  check("동의 기록 저장 (버전·시각)", prof?.consent_version === CONSENT_VERSION && Boolean(prof?.consented_at));
  const { data: u } = await admin.auth.admin.getUserById(A.id);
  check("app_metadata 에 동의 버전", u.user.app_metadata.consent_version === CONSENT_VERSION);
  check("동의 후 나가기(DELETE) 거부", (await A.api("/api/me/consent", "DELETE")).status === 400);

  // 동의하지 않고 나가기: 빈 새 계정은 삭제
  const N = await makeUser("consent-new", { consent: false });
  const leave = await N.api("/api/me/consent", "DELETE");
  const { data: nu } = await admin.auth.admin.getUserById(N.id);
  check("빈 새 계정 나가기 → 계정 삭제", leave.status === 200 && leave.body.deleted === true && !nu?.user);
  const nHash = createHmac("sha256", process.env.ONGI_EMAIL_HASH_KEY).update(N.email).digest("hex");
  const { count: wcount } = await admin.from("withdrawn_emails").select("*", { count: "exact", head: true }).eq("email_hash", nHash);
  check("나가기는 재가입 제한 안 걸림", wcount === 0, `withdrawn=${wcount}`);

  // 기록이 있는 기존 회원이 재동의를 거부하면 로그아웃만
  const E = await makeUser("consent-old", { consent: false });
  await admin.from("persons").insert({ user_id: E.id, name: "기존기록" });
  const leaveE = await E.api("/api/me/consent", "DELETE");
  const { data: eu } = await admin.auth.admin.getUserById(E.id);
  check("기록 있는 계정 나가기 → 계정 유지", leaveE.status === 200 && leaveE.body.deleted === false && Boolean(eu?.user));

  for (const x of [A, E]) await admin.auth.admin.deleteUser(x.id);
}
