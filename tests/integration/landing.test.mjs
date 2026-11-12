// 로그아웃/로그인/동의 전 상태에서 / 가 각각 무엇을 보여 주는지, 공개 파일이 열리는지 확인
import { B, check, get, makeUser } from "./_lib.mjs";

const page = async (path, cookie) => {
  const r = await get(path, cookie ? { headers: { Cookie: cookie } } : {});
  return { s: r.status, loc: r.headers.get("location"), t: await r.text() };
};

export default async function testLanding() {
  const out = await page("/");
  check("로그아웃: / 는 랜딩", out.s === 200 && out.t.includes("털어놓고") && out.t.includes("무료로 시작하기"));
  check("로그아웃: 공유 미리보기 태그", out.t.includes("opengraph-image.png") && out.t.includes("og:title"));
  check("로그아웃: 앱 메뉴 없음", !out.t.includes('aria-label="하단 메뉴"'));
  check("라이트 모드 전용 선언", out.t.includes('name="color-scheme" content="only light"'));
  const lg = await page("/login");
  check("로그아웃: /login 은 로그인 화면 (앱 시작 주소)", lg.s === 200 && !lg.t.includes("무료로 시작하기"));
  const ch = await page("/chats");
  check("로그아웃: 다른 화면은 로그인으로", ch.s === 307 && ch.loc.includes("/login?next=%2Fchats"));
  check("로그아웃: API 401", (await page("/api/sessions")).s === 401);
  for (const p of ["/robots.txt", "/sitemap.xml", "/opengraph-image.png", "/manifest.webmanifest", "/sw.js", "/offline.html", "/characters/mongle.png"]) {
    check(`공개 파일 ${p}`, (await page(p)).s === 200);
  }
  const man = JSON.parse((await page("/manifest.webmanifest")).t);
  check("앱 시작 주소는 /login", man.start_url === "/login" && man.display === "standalone");

  const a = await makeUser("landing-a");
  const b = await makeUser("landing-b", { consent: false });
  const home = await page("/", a.cookieStr());
  check("로그인: / 는 랜딩이 아님", home.s === 200 && !home.t.includes("무료로 시작하기"));
  const lg2 = await page("/login", a.cookieStr());
  check("로그인: /login 은 홈으로", lg2.s === 307 && new URL(lg2.loc, B).pathname === "/");
  const nc = await page("/", b.cookieStr());
  check("동의 전: / 는 동의 화면으로", nc.s === 307 && new URL(nc.loc, B).pathname === "/welcome");
}
