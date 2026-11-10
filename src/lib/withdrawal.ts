import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase/server";

/** 탈퇴 후 같은 이메일로 다시 가입할 수 없는 기간 (일) */
export const REJOIN_BLOCK_DAYS = Number(process.env.ONGI_REJOIN_BLOCK_DAYS) || 30;
const DAY = 24 * 3600 * 1000;

/** 이메일 원문을 남기지 않으려고 서버 비밀키로 해시한다. 키가 없으면 DB가 새어도 이메일 목록과 대조할 수 없다. */
function emailHash(email: string): string {
  const key = process.env.ONGI_EMAIL_HASH_KEY;
  if (!key) throw new Error("ONGI_EMAIL_HASH_KEY 가 없어요 (.env.local)");
  return createHmac("sha256", key).update(email.trim().toLowerCase()).digest("hex");
}

/** 제한 중이면 다시 가입할 수 있는 날(YYYY-MM-DD, 한국 시간)을, 아니면 null 을 돌려준다. */
export async function rejoinBlockedUntil(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - REJOIN_BLOCK_DAYS * DAY).toISOString();
  // 기간이 지난 기록은 여기서 같이 정리한다
  await admin.from("withdrawn_emails").delete().lt("withdrawn_at", cutoff);
  const { data } = await admin.from("withdrawn_emails").select("withdrawn_at").eq("email_hash", emailHash(email)).maybeSingle();
  if (!data) return null;
  const until = new Date(new Date(data.withdrawn_at).getTime() + REJOIN_BLOCK_DAYS * DAY + 9 * 3600 * 1000);
  return until.toISOString().slice(0, 10);
}

/** 탈퇴: 재가입 제한 기록 → 사진 폴더 → 계정 삭제 (인물·상담·메시지·프로필은 DB 가 함께 지운다). */
export async function withdrawUser(userId: string, email: string | undefined): Promise<void> {
  const admin = createAdminClient();
  if (email) {
    const { error } = await admin
      .from("withdrawn_emails")
      .upsert({ email_hash: emailHash(email), withdrawn_at: new Date().toISOString() });
    if (error) throw error;
  }
  await removeUserImages(admin, userId);
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
}

/** chat-images/{userId}/{sessionId}/파일 을 모두 지운다 */
async function removeUserImages(admin: SupabaseClient, userId: string) {
  const bucket = admin.storage.from("chat-images");
  const { data: folders } = await bucket.list(userId, { limit: 1000 });
  for (const f of folders ?? []) {
    const dir = `${userId}/${f.name}`;
    const { data: files } = await bucket.list(dir, { limit: 1000 });
    const paths = (files ?? []).map((x) => `${dir}/${x.name}`);
    if (paths.length) await bucket.remove(paths);
  }
}
