-- 요금제 개편 (2026-11-12): 무료는 상담 수(하루·한 달)로, 웹 검색은 "검색한 답변" 수로 센다.
--
-- 상담 수: 사용량 기록(usage)에서 그 상담이 처음 쓰인 한국 날짜로 센다.
--   usage 는 상담을 지워도 남으므로(FK 없음) 지웠다 새로 만들어도 횟수가 돌아오지 않는다.
--   만들기만 하고 대화하지 않은 상담은 세지 않는다.
-- 검색: 답변(chat) 하나에서 검색을 몇 번 했든 1번으로 센다.

create index if not exists usage_user_session_idx on public.usage (user_id, session_id) where session_id is not null;

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
    'mine_day',       (select coalesce(sum(cost), 0) from public.usage where day = p_day and user_id = p_user),
    'searches_day',   (select count(*) from public.usage where day = p_day and user_id = p_user and kind = 'chat' and searches > 0),
    'sessions_day',   (select count(*) from started where first_day = p_day),
    'sessions_month', (select count(*) from started where first_day >= date_trunc('month', p_day)::date),
    'mine_period',    (select coalesce(sum(u.cost), 0) from public.usage u, sub
                        where u.user_id = p_user and u.at >= sub.current_period_start),
    'all_day',        (select coalesce(sum(cost), 0) from public.usage where day = p_day),
    'plus_members',   (select count(*) from public.subscriptions
                        where status <> 'expired' and greatest(current_period_end, grace_until) > now())
  );
$$;
revoke execute on function public.usage_snapshot(uuid, date) from public, anon, authenticated;
grant execute on function public.usage_snapshot(uuid, date) to service_role;
