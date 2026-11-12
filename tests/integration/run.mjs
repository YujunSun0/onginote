// 통합 테스트 실행기: 켜져 있는 서버(기본 http://localhost:3000)에 실제 요청을 보내 확인한다.
//   npm run test:integration            전체 (Claude API 를 불러 비용이 조금 든다)
//   npm run test:integration:quick      AI 답변이 필요한 항목은 건너뜀 (비용 없음)
//   npm run test:integration -- billing 파일 이름에 billing 이 들어간 것만
import { readdirSync } from "node:fs";
import { B, SKIP_AI, cleanup, results } from "./_lib.mjs";

const need = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "CRON_SECRET", "ONGI_EMAIL_HASH_KEY"];
const missing = need.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`환경 변수가 없어요: ${missing.join(", ")} (.env.local 을 확인하세요)`);
  process.exit(2);
}

try {
  await fetch(B + "/robots.txt");
} catch {
  console.error(`${B} 에 서버가 없어요. 먼저 npm run build && npm run start (또는 npm run dev) 로 켜 주세요.`);
  process.exit(2);
}

const filter = process.argv.slice(2).find((a) => !a.startsWith("--"));
const files = readdirSync(new URL(".", import.meta.url))
  .filter((f) => f.endsWith(".test.mjs") && (!filter || f.includes(filter)))
  .sort();

console.log(`서버 ${B} · ${files.length}개 파일${SKIP_AI ? " · AI 항목 건너뜀" : ""}\n`);
const started = Date.now();
for (const f of files) {
  console.log(`▶ ${f}`);
  try {
    const mod = await import(`./${f}`);
    await mod.default();
  } catch (e) {
    results.fail++;
    results.failed.push(`${f}: 예외 ${e?.message ?? e}`);
    console.log(`  FAIL  예외로 중단: ${e?.stack ?? e}`);
  } finally {
    await cleanup();
  }
  console.log("");
}

const sec = ((Date.now() - started) / 1000).toFixed(0);
console.log(`${results.pass} 통과 · ${results.fail} 실패 · ${results.skip} 건너뜀 (${sec}초)`);
if (results.failed.length) console.log("\n실패:\n" + results.failed.map((n) => `  - ${n}`).join("\n"));
process.exit(results.fail ? 1 : 0);
