import { randomUUID } from "node:crypto";
import { BILLING_MAX_RETRIES, PLUS_ORDER_NAME, PLUS_PRICE_KRW, REFUND_DAYS } from "./plans";
import { createAdminClient } from "./supabase/server";

/**
 * 토스페이먼츠 자동결제로 Plus 월 구독을 다룬다. 서버 전용 (시크릿 키와 빌링키를 쓴다).
 *
 * 흐름
 * 1) /plus 에서 카드 등록 창을 연다 (customerKey 는 서버가 만든 무작위 값)
 * 2) 등록이 끝나면 authKey 로 빌링키를 받고, 바로 첫 달을 결제한다 → startSubscription
 * 3) 결제일이 되면 runRenewals 가 다음 달을 결제한다. 토스는 일정을 챙겨 주지 않아서 우리가 하루 한 번 부른다.
 *    실패하면 하루 한 번씩 BILLING_MAX_RETRIES 번 더 시도하고, 그동안은 Plus 를 유지한다 (grace_until).
 * 4) 해지하면 다음 결제만 하지 않는다. 기간이 끝나면 빌링키를 지운다.
 *
 * payments.order_id 가 유일해서, 결제 전에 행을 먼저 넣는 것이 같은 결제를 두 번 하지 않는 잠금이 된다.
 */

const TOSS_API = "https://api.tosspayments.com";
const DAY = 24 * 60 * 60 * 1000;

export class BillingError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code?: string,
  ) {
    super(message);
  }
}

class TossError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function secretKey(): string {
  const key = process.env.TOSS_SECRET_KEY;
  if (!key) throw new BillingError("결제 설정이 아직 안 됐어요. 잠시 후 다시 시도해 주세요.", 503);
  return key;
}

async function toss<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const res = await fetch(TOSS_API + path, {
    method,
    headers: {
      // 시크릿 키 뒤에 콜론을 붙여 base64 로 인코딩한다
      Authorization: "Basic " + Buffer.from(secretKey() + ":").toString("base64"),
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000), // 토스 권장: 최소 60초
    cache: "no-store",
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new TossError(json.code ?? "UNKNOWN", json.message ?? "결제 요청이 실패했어요.", res.status);
  return json as T;
}

// ─────────────────────────────────────────────
// 토스 응답 (쓰는 필드만)
// ─────────────────────────────────────────────
interface TossCard {
  issuerCode?: string;
  number?: string; // 마스킹된 번호
  cardType?: string;
}
interface TossBilling {
  billingKey: string;
  customerKey: string;
  card?: TossCard;
}
interface TossPayment {
  paymentKey: string;
  orderId: string;
  status: string; // DONE 이면 승인
  approvedAt?: string;
  totalAmount: number;
  card?: TossCard;
  receipt?: { url?: string };
}

/** 키·상점 설정 오류처럼 가맹점(우리) 쪽 문제. 재시도 횟수를 올리지 않는다. */
const MERCHANT_ERRORS = new Set(["UNAUTHORIZED_KEY", "NOT_FOUND_MERCHANT", "INVALID_API_KEY", "NOT_SUPPORTED_METHOD", "INVALID_CLIENT_KEY"]);
function isMerchantError(err: TossError) {
  return err.status === 401 || err.status === 403 || MERCHANT_ERRORS.has(err.code);
}

/** 토스 카드사 코드 → 이름 (화면 표시용). 모르는 코드는 "카드" */
const CARD_ISSUERS: Record<string, string> = {
  "3K": "기업BC", "46": "광주", "71": "롯데", "30": "산업", "31": "BC", "51": "삼성", "38": "새마을", "41": "신한",
  "62": "신협", "36": "씨티", "33": "우리", W1: "우리", "37": "우체국", "39": "저축은행", "35": "전북", "42": "제주",
  "15": "카카오뱅크", "3A": "케이뱅크", "24": "토스뱅크", "21": "하나", "61": "현대", "11": "KB국민", "91": "NH농협", "34": "수협",
};
export function cardLabel(card?: Pick<TossCard, "issuerCode" | "number">): string | null {
  if (!card) return null;
  const name = (card.issuerCode && CARD_ISSUERS[card.issuerCode]) || "";
  // 토스는 끝자리까지 가려서 주므로 앞 4자리만 보여준다: "BC카드 9410-****"
  const head = card.number ? card.number.replace(/[^0-9]/g, "").slice(0, 4) : "";
  return [name ? `${name}카드` : "카드", head.length === 4 ? `${head}-****` : ""].filter(Boolean).join(" ");
}

/** 한국 날짜 기준으로 한 달 뒤 같은 날 (31일 → 다음 달 말일) */
export function addMonth(d: Date): Date {
  const kst = new Date(d.getTime() + 9 * 3600e3);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth();
  const last = new Date(Date.UTC(y, m + 2, 0)).getUTCDate();
  const next = new Date(kst);
  next.setUTCFullYear(y, m + 1, Math.min(kst.getUTCDate(), last));
  return new Date(next.getTime() - 9 * 3600e3);
}

function kstDate(d: Date): string {
  return new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, "");
}

const shortId = (userId: string) => userId.replace(/-/g, "").slice(0, 12);

/**
 * 갱신 결제 주문번호: 구독 + 결제 기간(한국 날짜) + 시도 횟수로 정해진다.
 * 같은 기간·같은 시도는 늘 같은 번호라서, 스케줄러가 두 번 돌아도 payments.order_id 유일 제약에 막혀 한 번만 결제된다.
 */
export function renewalOrderId(userId: string, periodStart: Date, retryCount: number): string {
  return `R-${shortId(userId)}-${kstDate(periodStart)}-${retryCount}`;
}

// ─────────────────────────────────────────────
// 구매자 키와 빌링키
// ─────────────────────────────────────────────

/** 카드 등록 창을 열기 전에 부른다. 구매자 키를 만들고(처음 한 번) 정기결제 동의 시각을 남긴다. */
export async function prepareBilling(userId: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin.from("billing_customers").select("customer_key").eq("user_id", userId).maybeSingle();
  const customerKey = data?.customer_key ?? `ongi_${randomUUID()}`; // 41자, 토스 규칙(22~50자, 특수문자 포함)
  const { error } = await admin
    .from("billing_customers")
    .upsert({ user_id: userId, customer_key: customerKey, agreed_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  if (error) throw error;
  return customerKey;
}

/** 빌링키를 토스와 DB 에서 지운다 (해지 후 기간 만료, 환불, 탈퇴). 실패해도 넘어간다. */
export async function deleteBillingKey(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin.from("billing_customers").select("billing_key").eq("user_id", userId).maybeSingle();
  if (!data?.billing_key) return;
  try {
    await toss("DELETE", `/v1/billing/${encodeURIComponent(data.billing_key)}`);
  } catch (err) {
    console.error("billing key delete failed", err);
  }
  await admin.from("billing_customers").update({ billing_key: null, updated_at: new Date().toISOString() }).eq("user_id", userId);
}

// ─────────────────────────────────────────────
// 결제 한 번
// ─────────────────────────────────────────────
type ChargeResult =
  | { ok: true; payment: TossPayment; cardLabel: string | null }
  | { ok: false; message: string; code?: string }
  | { ok: false; skipped: true; message: string };

async function charge(opts: {
  userId: string;
  billingKey: string;
  customerKey: string;
  orderId: string;
  kind: "first" | "renewal";
  periodStart: Date;
  periodEnd: Date;
  email?: string | null;
}): Promise<ChargeResult> {
  const admin = createAdminClient();
  // 결제 전에 행부터 넣는다. 같은 주문번호가 이미 있으면 다른 요청이 처리 중이거나 끝난 것.
  const { error: lockErr } = await admin.from("payments").insert({
    user_id: opts.userId,
    order_id: opts.orderId,
    kind: opts.kind,
    status: "pending",
    amount: PLUS_PRICE_KRW,
    period_start: opts.periodStart.toISOString(),
    period_end: opts.periodEnd.toISOString(),
  });
  if (lockErr) {
    if (lockErr.code === "23505") return { ok: false, skipped: true, message: "이미 처리한 결제예요." };
    throw lockErr;
  }

  let payment: TossPayment | null = null;
  let failure: { message: string; code?: string } | null = null;
  try {
    payment = await toss<TossPayment>(
      "POST",
      `/v1/billing/${encodeURIComponent(opts.billingKey)}`,
      {
        customerKey: opts.customerKey,
        amount: PLUS_PRICE_KRW,
        orderId: opts.orderId,
        orderName: PLUS_ORDER_NAME,
        ...(opts.email ? { customerEmail: opts.email } : {}),
      },
      opts.orderId,
    );
  } catch (err) {
    if (err instanceof TossError && isMerchantError(err)) {
      // 우리 쪽 설정 문제(키 오류 등)는 고객의 결제 실패가 아니다: 기록을 지우고(같은 주문번호로 다시 시도할 수 있게) 멈춘다
      await admin.from("payments").delete().eq("order_id", opts.orderId);
      console.error("toss merchant error", err.code, err.message);
      throw new BillingError("결제 설정에 문제가 있어요. 잠시 후 다시 시도해 주세요.", 503, err.code);
    }
    if (err instanceof TossError) {
      failure = { message: err.message, code: err.code };
    } else {
      // 응답을 못 받았다 (시간 초과 등). 실제로 결제됐을 수 있으니 주문번호로 확인한다.
      try {
        payment = await toss<TossPayment>("GET", `/v1/payments/orders/${encodeURIComponent(opts.orderId)}`);
      } catch {
        failure = { message: "결제 결과를 확인하지 못했어요." };
      }
    }
  }

  if (payment && payment.status === "DONE") {
    const label = cardLabel(payment.card);
    await admin
      .from("payments")
      .update({
        status: "paid",
        payment_key: payment.paymentKey,
        approved_at: payment.approvedAt ?? new Date().toISOString(),
        receipt_url: payment.receipt?.url ?? null,
        card_label: label,
      })
      .eq("order_id", opts.orderId);
    return { ok: true, payment, cardLabel: label };
  }
  const f = failure ?? { message: `결제가 완료되지 않았어요 (${payment?.status ?? "알 수 없음"}).` };
  await admin.from("payments").update({ status: "failed", failure: [f.code, f.message].filter(Boolean).join(": ") }).eq("order_id", opts.orderId);
  return { ok: false, ...f };
}

// ─────────────────────────────────────────────
// 구독 시작, 갱신, 해지, 환불
// ─────────────────────────────────────────────
interface SubRow {
  user_id: string;
  status: "active" | "canceled" | "past_due" | "expired";
  current_period_start: string;
  current_period_end: string;
  grace_until: string | null;
  retry_count: number;
}

async function getSub(userId: string): Promise<SubRow | null> {
  const { data } = await createAdminClient()
    .from("subscriptions")
    .select("user_id,status,current_period_start,current_period_end,grace_until,retry_count")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as SubRow | null) ?? null;
}

function isLive(sub: SubRow | null, now = Date.now()): boolean {
  if (!sub || sub.status === "expired") return false;
  const until = Math.max(new Date(sub.current_period_end).getTime(), sub.grace_until ? new Date(sub.grace_until).getTime() : 0);
  return until > now;
}

/** 카드 등록 후: 빌링키를 받고 첫 달을 결제한다. 결제 실패 중(past_due)에 카드를 바꿔 다시 결제할 때도 쓴다. */
export async function startSubscription(userId: string, authKey: string, customerKey: string, email?: string | null) {
  const admin = createAdminClient();
  const { data: cust } = await admin.from("billing_customers").select("customer_key").eq("user_id", userId).maybeSingle();
  if (!cust || cust.customer_key !== customerKey) throw new BillingError("카드 등록 정보가 맞지 않아요. 처음부터 다시 시도해 주세요.");

  const sub = await getSub(userId);
  if (isLive(sub) && sub!.status !== "past_due") {
    throw new BillingError(sub!.status === "canceled" ? "이미 온기 패스를 쓰고 있어요. 해지 취소로 이어서 쓸 수 있어요." : "이미 온기 패스를 쓰고 있어요.", 409, "ALREADY_PLUS");
  }

  let issued: TossBilling;
  try {
    issued = await toss<TossBilling>("POST", "/v1/billing/authorizations/issue", { authKey, customerKey });
  } catch (err) {
    if (err instanceof TossError) throw new BillingError(`카드를 등록하지 못했어요. ${err.message}`, 400, err.code);
    throw err;
  }
  // 예전 빌링키가 있으면 지우고 새 것으로 바꾼다
  await deleteBillingKey(userId);
  await admin.from("billing_customers").update({ billing_key: issued.billingKey, updated_at: new Date().toISOString() }).eq("user_id", userId);

  const start = new Date();
  const end = addMonth(start);
  const orderId = `F-${shortId(userId)}-${Date.now().toString(36)}`;
  const result = await charge({
    userId,
    billingKey: issued.billingKey,
    customerKey,
    orderId,
    kind: "first",
    periodStart: start,
    periodEnd: end,
    email,
  });
  if (!result.ok) {
    await deleteBillingKey(userId);
    throw new BillingError(`결제하지 못했어요. ${result.message}`, 402, "code" in result ? result.code : undefined);
  }
  const { error } = await admin.from("subscriptions").upsert({
    user_id: userId,
    plan: "plus",
    status: "active",
    current_period_start: start.toISOString(),
    current_period_end: end.toISOString(),
    card_label: result.cardLabel ?? cardLabel(issued.card),
    retry_count: 0,
    next_retry_at: null,
    grace_until: null,
    canceled_at: null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return { until: end.toISOString(), orderId };
}

export interface RenewalSummary {
  renewed: number;
  failed: number;
  expired: number;
  skipped: number;
}

/** 결제일이 된 구독을 결제한다. 하루 한 번 부른다 (여러 번 불러도 같은 결제를 두 번 하지 않는다). */
export async function runRenewals(now = new Date()): Promise<RenewalSummary> {
  const admin = createAdminClient();
  const summary: RenewalSummary = { renewed: 0, failed: 0, expired: 0, skipped: 0 };
  const nowIso = now.toISOString();

  // 해지했고 기간이 끝난 구독: 정리
  const { data: ended } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("status", "canceled")
    .lte("current_period_end", nowIso);
  for (const s of ended ?? []) {
    await admin.from("subscriptions").update({ status: "expired", updated_at: nowIso }).eq("user_id", s.user_id);
    await deleteBillingKey(s.user_id);
    summary.expired++;
  }

  // 결제할 구독
  const { data: due } = await admin
    .from("subscriptions")
    .select("user_id,status,current_period_start,current_period_end,grace_until,retry_count,next_retry_at")
    .in("status", ["active", "past_due"])
    .lte("current_period_end", nowIso)
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`);

  for (const sub of (due ?? []) as (SubRow & { next_retry_at: string | null })[]) {
    const { data: cust } = await admin.from("billing_customers").select("customer_key,billing_key").eq("user_id", sub.user_id).maybeSingle();
    const expire = async () => {
      await admin.from("subscriptions").update({ status: "expired", grace_until: null, next_retry_at: null, updated_at: nowIso }).eq("user_id", sub.user_id);
      await deleteBillingKey(sub.user_id);
      summary.expired++;
    };
    if (!cust?.billing_key) {
      await expire();
      continue;
    }
    const { data: user } = await admin.auth.admin.getUserById(sub.user_id);
    const periodStart = new Date(sub.current_period_end);
    const periodEnd = addMonth(periodStart);
    const result = await charge({
      userId: sub.user_id,
      billingKey: cust.billing_key,
      customerKey: cust.customer_key,
      orderId: renewalOrderId(sub.user_id, periodStart, sub.retry_count),
      kind: "renewal",
      periodStart,
      periodEnd,
      email: user?.user?.email ?? null,
    });
    if ("skipped" in result) {
      summary.skipped++;
      continue;
    }
    if (result.ok) {
      await admin
        .from("subscriptions")
        .update({
          status: "active",
          current_period_start: periodStart.toISOString(),
          current_period_end: periodEnd.toISOString(),
          card_label: result.cardLabel,
          retry_count: 0,
          next_retry_at: null,
          grace_until: null,
          updated_at: nowIso,
        })
        .eq("user_id", sub.user_id);
      summary.renewed++;
      continue;
    }
    const retries = sub.retry_count + 1;
    if (retries > BILLING_MAX_RETRIES) {
      await expire();
      continue;
    }
    await admin
      .from("subscriptions")
      .update({
        status: "past_due",
        retry_count: retries,
        next_retry_at: new Date(now.getTime() + DAY).toISOString(),
        // 마지막 재시도까지 Plus 유지
        grace_until: new Date(periodStart.getTime() + (BILLING_MAX_RETRIES + 1) * DAY).toISOString(),
        updated_at: nowIso,
      })
      .eq("user_id", sub.user_id);
    summary.failed++;
  }
  return summary;
}

/** 해지: 다음 결제를 하지 않는다. 남은 기간은 Plus 로 쓴다. 결제 실패 중이면 바로 끝낸다. */
export async function cancelSubscription(userId: string) {
  const sub = await getSub(userId);
  if (!isLive(sub) || sub!.status === "canceled") throw new BillingError("해지할 구독이 없어요.");
  const admin = createAdminClient();
  const now = new Date().toISOString();
  if (sub!.status === "past_due") {
    await admin.from("subscriptions").update({ status: "expired", grace_until: null, next_retry_at: null, canceled_at: now, updated_at: now }).eq("user_id", userId);
    await deleteBillingKey(userId);
    return { status: "expired" as const };
  }
  await admin.from("subscriptions").update({ status: "canceled", canceled_at: now, updated_at: now }).eq("user_id", userId);
  return { status: "canceled" as const, until: sub!.current_period_end };
}

/** 해지 취소: 기간이 남아 있으면 다음 결제일에 다시 결제한다 */
export async function resumeSubscription(userId: string) {
  const sub = await getSub(userId);
  if (!sub || sub.status !== "canceled" || new Date(sub.current_period_end).getTime() <= Date.now()) {
    throw new BillingError("다시 이어갈 구독이 없어요.");
  }
  const { data: cust } = await createAdminClient().from("billing_customers").select("billing_key").eq("user_id", userId).maybeSingle();
  if (!cust?.billing_key) throw new BillingError("등록된 카드가 없어요. 기간이 끝난 뒤 다시 가입해 주세요.");
  const now = new Date().toISOString();
  await createAdminClient().from("subscriptions").update({ status: "active", canceled_at: null, updated_at: now }).eq("user_id", userId);
  return { status: "active" as const };
}

export interface RefundCheck {
  ok: boolean;
  reason?: string;
  orderId?: string;
}

/** 마지막 결제 후 REFUND_DAYS 일 안이고, 그 뒤로 상담을 한 번도 하지 않았으면 전액 환불할 수 있다 */
export async function checkRefund(userId: string): Promise<RefundCheck> {
  const admin = createAdminClient();
  const sub = await getSub(userId);
  if (!isLive(sub)) return { ok: false, reason: "이용 중인 온기 패스가 없어요." };
  const { data: pay } = await admin
    .from("payments")
    .select("order_id,approved_at,status")
    .eq("user_id", userId)
    .eq("status", "paid")
    .order("approved_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!pay?.approved_at) return { ok: false, reason: "환불할 결제가 없어요." };
  if (Date.now() - new Date(pay.approved_at).getTime() > REFUND_DAYS * DAY) {
    return { ok: false, reason: `결제 후 ${REFUND_DAYS}일이 지났어요.` };
  }
  // 결제 뒤로 캐릭터 답변을 한 번이라도 받았으면 이용을 시작한 것 (디지털 콘텐츠 청약철회 예외)
  const { count } = await admin
    .from("usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", "chat")
    .gte("at", pay.approved_at);
  if ((count ?? 0) > 0) return { ok: false, reason: "결제 후 상담을 한 적이 있어요." };
  return { ok: true, orderId: pay.order_id };
}

/** 전액 환불하고 바로 무료로 돌아간다 */
export async function refundLatest(userId: string) {
  const check = await checkRefund(userId);
  if (!check.ok || !check.orderId) throw new BillingError(check.reason ?? "환불할 수 없어요.");
  const admin = createAdminClient();
  const { data: pay } = await admin.from("payments").select("payment_key").eq("order_id", check.orderId).single();
  try {
    await toss(
      "POST",
      `/v1/payments/${encodeURIComponent(pay!.payment_key)}/cancel`,
      { cancelReason: `결제 후 ${REFUND_DAYS}일 안 미사용 환불` },
      `refund-${check.orderId}`,
    );
  } catch (err) {
    if (err instanceof TossError && err.code !== "ALREADY_CANCELED_PAYMENT") {
      throw new BillingError(`환불하지 못했어요. ${err.message}`, 502, err.code);
    }
  }
  const now = new Date().toISOString();
  await admin.from("payments").update({ status: "refunded", refunded_at: now }).eq("order_id", check.orderId);
  await admin
    .from("subscriptions")
    .update({ status: "expired", current_period_end: now, grace_until: null, next_retry_at: null, canceled_at: now, updated_at: now })
    .eq("user_id", userId);
  await deleteBillingKey(userId);
}
