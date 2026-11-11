// 개발용: 결제 없이 계정의 요금제를 바꾼다 (토스 결제를 붙이기 전 테스트용).
//   node --env-file=.env.local scripts/set-plan.mjs <이메일> plus [일수=30]
//   node --env-file=.env.local scripts/set-plan.mjs <이메일> free
//   node --env-file=.env.local scripts/set-plan.mjs <이메일> expire   (기간을 어제로 끝냄)
import { createClient } from "@supabase/supabase-js";

const [email, plan = "plus", days = "30"] = process.argv.slice(2);
if (!email || !["plus", "free", "expire"].includes(plan)) {
  console.log("사용법: node --env-file=.env.local scripts/set-plan.mjs <이메일> plus|free|expire [일수]");
  process.exit(1);
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

let user = null;
for (let page = 1; !user; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  user = data.users.find((u) => u.email === email) ?? null;
  if (data.users.length < 1000) break;
}
if (!user) {
  console.log("그 이메일의 계정이 없어요.");
  process.exit(1);
}

if (plan === "free") {
  const { error } = await admin.from("subscriptions").delete().eq("user_id", user.id);
  if (error) throw error;
  console.log("무료로 바꿨어요.");
} else {
  const now = Date.now();
  const end = plan === "expire" ? now - 864e5 : now + Number(days) * 864e5;
  const start = plan === "expire" ? end - 30 * 864e5 : now;
  const { error } = await admin.from("subscriptions").upsert({
    user_id: user.id,
    plan: "plus",
    status: plan === "expire" ? "expired" : "active",
    current_period_start: new Date(start).toISOString(),
    current_period_end: new Date(end).toISOString(),
    retry_count: 0,
    next_retry_at: null,
    grace_until: null,
    canceled_at: null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  console.log(plan === "expire" ? "Plus 기간을 어제로 끝냈어요 (무료로 보여야 해요)." : `Plus로 바꿨어요 (${days}일, ${new Date(end).toLocaleDateString("ko-KR")}까지).`);
}
