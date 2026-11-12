// 통합 테스트 공통: 테스트 계정 만들기·로그인, 결과 기록, 정리.
// 실제 Supabase 에 @example.com 계정을 만들었다가 지운다. 실행: npm run test:integration (tests/integration/README.md)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

export const B = (process.env.TEST_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
export const SKIP_AI = process.env.SKIP_AI === "1" || process.argv.includes("--skip-ai");

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const admin = createClient(URL_, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

/** 지금 동의 버전 (src/lib/legal.ts 와 같은 값) */
export const CONSENT_VERSION = readFileSync(new URL("../../src/lib/legal.ts", import.meta.url), "utf8").match(
  /CONSENT_VERSION = "([^"]+)"/,
)[1];

/** 1x1 PNG (사진 상담용) */
export const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export const results = { pass: 0, fail: 0, skip: 0, failed: [] };

export function check(name, ok, extra = "") {
  if (ok) results.pass++;
  else {
    results.fail++;
    results.failed.push(name);
  }
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + String(extra).slice(0, 120) : ""}`);
}

export function skip(name) {
  results.skip++;
  console.log(`  SKIP  ${name} (SKIP_AI)`);
}

const created = new Set();

/**
 * 테스트 계정을 만들고 로그인한다. 같은 이름의 예전 계정이 남아 있으면 먼저 지운다.
 * consent: false 면 서비스 이용 동의 전 상태로 만든다.
 */
export async function makeUser(tag, { consent = true } = {}) {
  const email = `onginote-test-${tag}@example.com`;
  const password = "test-" + crypto.randomUUID();
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const old = list.users.find((u) => u.email === email);
  if (old) await removeUser(old.id);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    ...(consent ? { app_metadata: { consent_version: CONSENT_VERSION } } : {}),
  });
  if (error) throw error;
  created.add(data.user.id);

  const jar = new Map();
  const sb = createServerClient(URL_, PUB, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach((c) => jar.set(c.name, c.value)) },
  });
  const { error: e2 } = await sb.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  const cookieStr = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

  /** 쿠키를 붙여 부른다. 서버가 새로 준 쿠키(동의 후 토큰 갱신, 로그아웃)도 따라간다. */
  const api = async (path, method = "GET", body) => {
    const r = await fetch(B + path, {
      method,
      headers: { "Content-Type": "application/json", Cookie: cookieStr() },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    for (const c of r.headers.getSetCookie()) {
      const [kv] = c.split(";");
      const i = kv.indexOf("=");
      const k = kv.slice(0, i);
      const v = kv.slice(i + 1);
      if (!v || /Max-Age=0/i.test(c)) jar.delete(k);
      else jar.set(k, v);
    }
    const raw = await r.text();
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      json = raw;
    }
    return { status: r.status, body: json, raw, headers: r.headers };
  };
  return { id: data.user.id, email, api, sb, cookieStr };
}

async function removeUser(id) {
  // usage 는 사용자 삭제로 지워지지 않게(감사 기록) 되어 있어서 따로 지운다
  await admin.from("usage").delete().eq("user_id", id);
  await admin.from("payments").delete().eq("user_id", id);
  await admin.auth.admin.deleteUser(id);
}

/** 이번 실행에서 만든 계정을 모두 지운다 (중간에 실패해도 run.mjs 가 부른다) */
export async function cleanup() {
  for (const id of created) {
    try {
      await removeUser(id);
    } catch (e) {
      console.error("  정리 실패", id, e?.message);
    }
  }
  created.clear();
}

/** 로그인 없이 부르기 */
export const get = (path, init = {}) => fetch(B + path, { redirect: "manual", ...init });

/** NDJSON 스트림(채팅 응답)을 이벤트 배열과 답변 글로 */
export function parseChat(raw) {
  const ev = String(raw)
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return {};
      }
    });
  return { ev, reply: ev.filter((e) => e.type === "text").map((e) => e.delta).join("") };
}
