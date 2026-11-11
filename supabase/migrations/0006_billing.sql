-- 토스페이먼츠 자동결제 (Plus 월 구독)
-- 0005 를 먼저 실행해야 한다.

-- ─────────────────────────────────────────────
-- 구독: 결제 실패 재시도, 해지, 카드 표시용 칸
-- ─────────────────────────────────────────────
alter table public.subscriptions drop constraint subscriptions_status_check;
alter table public.subscriptions
  add constraint subscriptions_status_check check (status in ('active', 'canceled', 'past_due', 'expired')),
  add column card_label text,                 -- "신한카드 1234" 처럼 화면 표시용 (마스킹된 번호만)
  add column retry_count integer not null default 0,
  add column next_retry_at timestamptz,       -- 결제 실패 후 다음 재시도 시각
  add column grace_until timestamptz,         -- 결제 실패 중에도 Plus 를 유지하는 기한
  add column canceled_at timestamptz;

-- 기간이 끝났어도 결제 재시도 중(grace_until)이면 Plus 로 본다
create or replace function public.usage_snapshot(p_user uuid, p_day date)
returns json
language sql
stable
security definer set search_path = ''
as $$
  with sub as (
    select status, current_period_start, current_period_end, grace_until
    from public.subscriptions where user_id = p_user
  )
  select json_build_object(
    'sub',           (select row_to_json(sub) from sub),
    'mine_day',      (select coalesce(sum(cost), 0) from public.usage where day = p_day and user_id = p_user),
    'searches_day',  (select coalesce(sum(searches), 0) from public.usage where day = p_day and user_id = p_user),
    'mine_period',   (select coalesce(sum(u.cost), 0) from public.usage u, sub
                       where u.user_id = p_user and u.at >= sub.current_period_start),
    'all_day',       (select coalesce(sum(cost), 0) from public.usage where day = p_day),
    'plus_members',  (select count(*) from public.subscriptions
                       where status <> 'expired' and greatest(current_period_end, grace_until) > now())
  );
$$;
revoke execute on function public.usage_snapshot(uuid, date) from public, anon, authenticated;
grant execute on function public.usage_snapshot(uuid, date) to service_role;

-- ─────────────────────────────────────────────
-- 토스 구매자 키와 빌링키. 빌링키로 결제를 할 수 있으니 본인에게도 보이지 않는다 (서버만).
-- ─────────────────────────────────────────────
create table public.billing_customers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  customer_key text not null unique,          -- 무작위 값 (이메일 등 개인정보를 쓰지 않는다)
  billing_key text,
  agreed_at timestamptz,                      -- 정기결제 동의 시각
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.billing_customers enable row level security;
revoke all on public.billing_customers from anon, authenticated;

-- ─────────────────────────────────────────────
-- 결제 내역. 세금·분쟁 대응을 위해 탈퇴해도 계정 연결만 끊고 남긴다 (전자상거래법상 5년 보관).
-- order_id 가 유일해서, 같은 결제를 두 번 시도하지 않는 잠금 역할도 한다.
-- ─────────────────────────────────────────────
create table public.payments (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  order_id text not null unique,
  payment_key text,
  kind text not null check (kind in ('first', 'renewal')),
  status text not null check (status in ('pending', 'paid', 'failed', 'refunded')),
  amount integer not null,
  period_start timestamptz,
  period_end timestamptz,
  card_label text,
  receipt_url text,
  failure text,
  approved_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now()
);
create index payments_user_idx on public.payments (user_id, created_at);

alter table public.payments enable row level security;
create policy "read own payments" on public.payments
  for select to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.payments from anon, authenticated;
