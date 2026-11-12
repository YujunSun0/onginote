-- 리포트 단건 판매 (2026-11-12): 나의 연애 성향 리포트부터.
--
-- 리포트는 한 번 만들어 저장한다. 결제 전에는 서버가 미리보기 부분만 내보내고(나머지는 화면에 보내지도 않는다),
-- 결제하면 paid_at 이 채워지고 전체를 볼 수 있다.
-- 사용자에게는 읽기 권한도 주지 않는다: 읽을 수 있으면 공개 키로 DB 를 직접 조회해 결제 전 전체 내용을 볼 수 있다.
-- 읽기·만들기·결제 표시는 모두 서버(관리자 권한)가 본인 것만 골라서 한다.

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,  -- 탈퇴하면 리포트도 지운다
  kind text not null check (kind in ('personality')),
  content jsonb not null,
  source_count integer not null,          -- 만들 때 쓴 정리된 상담 수 (다음 리포트를 언제 만들 수 있는지 판단)
  model text not null,
  paid_at timestamptz,
  order_id text,
  created_at timestamptz not null default now()
);
create index reports_user_idx on public.reports (user_id, kind, created_at desc);

alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;

-- 결제 내역: 리포트 단건 결제. 리포트를 지워도(탈퇴) 결제 기록은 남는다.
alter table public.payments drop constraint payments_kind_check;
alter table public.payments add constraint payments_kind_check check (kind in ('first', 'renewal', 'report'));
alter table public.payments add column report_id uuid references public.reports (id) on delete set null;

-- 사용량 종류에 리포트 추가는 필요 없다 (kind 는 text). 다만 리포트 생성 비용은
-- 개인 하루 한도·패스 기간 한도에서 뺀다: 무료 하루 한도($0.1)를 리포트 하나($0.07 안팎)가 거의 다 써 버리기 때문.
-- 서비스 전체 하루 한도(all_day)에는 그대로 넣는다.
create or replace function public.usage_snapshot(p_user uuid, p_day date)
returns json
language sql
stable
security definer set search_path = ''
as $$
  with sub as (
    select status, current_period_start, current_period_end, grace_until
    from public.subscriptions where user_id = p_user
  ),
  started as (
    select session_id, min(day) as first_day
    from public.usage
    where user_id = p_user and session_id is not null and kind in ('router', 'chat')
    group by session_id
  )
  select json_build_object(
    'sub',            (select row_to_json(sub) from sub),
    'mine_day',       (select coalesce(sum(cost), 0) from public.usage where day = p_day and user_id = p_user and kind <> 'report'),
    'searches_day',   (select count(*) from public.usage where day = p_day and user_id = p_user and kind = 'chat' and searches > 0),
    'sessions_day',   (select count(*) from started where first_day = p_day),
    'sessions_month', (select count(*) from started where first_day >= date_trunc('month', p_day)::date),
    'mine_period',    (select coalesce(sum(u.cost), 0) from public.usage u, sub
                        where u.user_id = p_user and u.at >= sub.current_period_start and u.kind <> 'report'),
    'all_day',        (select coalesce(sum(cost), 0) from public.usage where day = p_day),
    'plus_members',   (select count(*) from public.subscriptions
                        where status <> 'expired' and greatest(current_period_end, grace_until) > now())
  );
$$;
revoke execute on function public.usage_snapshot(uuid, date) from public, anon, authenticated;
grant execute on function public.usage_snapshot(uuid, date) to service_role;
