-- 요금제 (Plus 구독). 행이 없거나 기간이 지났으면 무료.
-- 결제 정보(토스 빌링키 등)는 3단계에서 칸을 더한다.
create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'plus' check (plan in ('plus')),
  -- active: 자동 결제 중 / canceled: 해지했지만 기간이 남음 / past_due: 결제 실패, 재시도 중
  status text not null check (status in ('active', 'canceled', 'past_due')),
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
-- 본인 것은 읽기만. 바꾸는 건 서버(관리자 권한)만.
create policy "read own subscription" on public.subscriptions
  for select to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.subscriptions from anon, authenticated;

-- 한도 계산에 필요한 것을 한 번에: 내 구독, 오늘 사용액·검색 수, 이번 구독 기간 사용액, 서비스 전체 오늘 사용액, Plus 인원.
-- 다른 사람 사용량이 섞이므로 서버(service role)만 부를 수 있다.
create function public.usage_snapshot(p_user uuid, p_day date)
returns json
language sql
stable
security definer set search_path = ''
as $$
  with sub as (
    select status, current_period_start, current_period_end
    from public.subscriptions where user_id = p_user
  )
  select json_build_object(
    'sub',           (select row_to_json(sub) from sub),
    'mine_day',      (select coalesce(sum(cost), 0) from public.usage where day = p_day and user_id = p_user),
    'searches_day',  (select coalesce(sum(searches), 0) from public.usage where day = p_day and user_id = p_user),
    'mine_period',   (select coalesce(sum(u.cost), 0) from public.usage u, sub
                       where u.user_id = p_user and u.at >= sub.current_period_start),
    'all_day',       (select coalesce(sum(cost), 0) from public.usage where day = p_day),
    'plus_members',  (select count(*) from public.subscriptions where current_period_end > now())
  );
$$;
revoke execute on function public.usage_snapshot(uuid, date) from public, anon, authenticated;
grant execute on function public.usage_snapshot(uuid, date) to service_role;

create index if not exists usage_user_at_idx on public.usage (user_id, at);
