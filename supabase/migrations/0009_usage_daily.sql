-- 날짜별 사용량 요약 (2026-11-16)
--
-- usage 는 응답 하나마다 한 줄씩 쌓인다. 이 표는 그걸 사람·한국 날짜별로 한 줄로 모은 것이다.
-- - 사용자: 사용량 화면(/usage)에서 날짜별 막대그래프로 본다 (서버가 % 로 바꿔서 내보낸다)
-- - 운영: 요금제별 하루 사용량, 상담 시작 수, 검색 비율 같은 통계에 그대로 쓴다
--
-- usage 에 한 줄이 들어갈 때마다 트리거가 같은 트랜잭션에서 더하므로 따로 채울 필요가 없다.
-- 사용자는 이 표를 읽지도 쓰지도 못한다 (금액이 들어 있다). 서버(service role)만 쓴다.
-- 탈퇴하면 usage 처럼 계정 연결만 끊고 숫자는 남긴다.

create table public.usage_daily (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  day date not null,                                  -- 한국 날짜
  plan text,                                          -- 그날 마지막으로 기록될 때의 요금제 ('free' | 'plus')
  limit_usd numeric(12, 6),                           -- 그날 적용된 하루 한도. 서버가 알 때만 채운다 (없으면 plan 의 기본 한도)
  cost numeric(12, 6) not null default 0,             -- 하루 한도에 잡히는 금액 (리포트 제외)
  report_cost numeric(12, 6) not null default 0,      -- 리포트 만들기 금액 (개인 한도와 별도)
  answers integer not null default 0,                 -- 캐릭터 답변 수 (kind = 'chat')
  searched_answers integer not null default 0,        -- 그중 검색을 쓴 답변 수
  sessions_started integer not null default 0,        -- 이날 처음 대화가 오간 상담 수
  calls integer not null default 0,                   -- API 호출 수 (모든 종류)
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);
create index usage_daily_day_idx on public.usage_daily (day);

alter table public.usage_daily enable row level security;
-- 정책 없음: 사용자 권한(anon, authenticated)으로는 읽기·쓰기 모두 막힌다
revoke all on public.usage_daily from anon, authenticated;

-- 그 순간 온기 패스인지 (usage_snapshot 과 같은 기준)
create function public.usage_plan_now(p_user uuid)
returns text
language sql
stable
security definer set search_path = ''
as $$
  select case when exists (
    select 1 from public.subscriptions
    where user_id = p_user and status <> 'expired'
      and greatest(current_period_end, coalesce(grace_until, current_period_end)) > now()
  ) then 'plus' else 'free' end;
$$;
revoke execute on function public.usage_plan_now(uuid) from public, anon, authenticated;

create function public.usage_daily_add()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  first_in_session boolean := false;
begin
  if new.user_id is null then
    return new;
  end if;
  -- 상담 수는 usage_snapshot 과 같은 기준: 그 상담에서 router/chat 이 처음 기록된 날
  -- (여러 줄을 한 번에 넣어도 한 번만 세도록, 먼저 들어간 줄(id 가 더 작은 줄)이 없을 때만)
  if new.session_id is not null and new.kind in ('router', 'chat') then
    first_in_session := not exists (
      select 1 from public.usage
      where user_id = new.user_id and session_id = new.session_id
        and kind in ('router', 'chat') and id < new.id
    );
  end if;

  insert into public.usage_daily as d
    (user_id, day, plan, cost, report_cost, answers, searched_answers, sessions_started, calls)
  values (
    new.user_id,
    new.day,
    public.usage_plan_now(new.user_id),
    case when new.kind = 'report' then 0 else new.cost end,
    case when new.kind = 'report' then new.cost else 0 end,
    case when new.kind = 'chat' then 1 else 0 end,
    case when new.kind = 'chat' and new.searches > 0 then 1 else 0 end,
    case when first_in_session then 1 else 0 end,
    1
  )
  on conflict (user_id, day) do update set
    plan             = excluded.plan,
    cost             = d.cost + excluded.cost,
    report_cost      = d.report_cost + excluded.report_cost,
    answers          = d.answers + excluded.answers,
    searched_answers = d.searched_answers + excluded.searched_answers,
    sessions_started = d.sessions_started + excluded.sessions_started,
    calls            = d.calls + 1,
    updated_at       = now();
  return new;
end;
$$;
revoke execute on function public.usage_daily_add() from public, anon, authenticated;

create trigger usage_daily_add
  after insert on public.usage
  for each row execute function public.usage_daily_add();

-- 지금까지 쌓인 usage 로 채운다.
-- 요금제는 지난 기록이 없어서, 지금 구독의 기간 시작일 이후면 'plus' 로 본다.
insert into public.usage_daily
  (user_id, day, plan, cost, report_cost, answers, searched_answers, sessions_started, calls)
select
  u.user_id,
  u.day,
  case when s.user_id is not null and u.day >= (s.current_period_start at time zone 'Asia/Seoul')::date then 'plus' else 'free' end,
  coalesce(sum(u.cost) filter (where u.kind <> 'report'), 0),
  coalesce(sum(u.cost) filter (where u.kind = 'report'), 0),
  count(*) filter (where u.kind = 'chat'),
  count(*) filter (where u.kind = 'chat' and u.searches > 0),
  coalesce(max(st.n), 0),
  count(*)
from public.usage u
left join public.subscriptions s on s.user_id = u.user_id
left join (
  select user_id, first_day, count(*) as n
  from (
    select user_id, session_id, min(day) as first_day
    from public.usage
    where user_id is not null and session_id is not null and kind in ('router', 'chat')
    group by user_id, session_id
  ) f
  group by user_id, first_day
) st on st.user_id = u.user_id and st.first_day = u.day
where u.user_id is not null
group by u.user_id, u.day, s.user_id, s.current_period_start;
