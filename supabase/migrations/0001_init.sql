-- 온기노트 초기 스키마
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 실행한다.
--
-- 원칙: 모든 테이블에 user_id 를 두고 RLS 로 "로그인한 사람은 자기 데이터만" 을 DB가 강제한다.
-- 서버 코드에 실수가 있어도 다른 사람의 상담이 보이지 않게 하기 위해서다.

-- ─────────────────────────────────────────────
-- 사용자 프로필 (auth.users 에 가입하면 자동으로 한 줄 생긴다)
-- ─────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────
-- 인물 프로필
-- ─────────────────────────────────────────────
create table public.persons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  relation text not null default '썸',
  mbti text,
  age text,
  birthday text,                       -- "MM-DD"
  likes text[] not null default '{}',
  dislikes text[] not null default '{}',
  contact_style text,
  notes text[] not null default '{}',
  timeline jsonb not null default '[]', -- [{ date, text }]
  created_at timestamptz not null default now()
);
create index persons_user_idx on public.persons (user_id, created_at);

-- ─────────────────────────────────────────────
-- 상담. 정리 카드와 선톡은 상담에 딸린 값이라 jsonb 로 둔다.
-- 목록 화면에서 메시지를 다 읽지 않도록 마지막 메시지와 개수를 같이 저장한다.
-- ─────────────────────────────────────────────
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  character_id text not null,
  person_id uuid references public.persons (id) on delete cascade, -- 인물을 지우면 그 사람 상담도 지운다
  voice boolean not null default false,
  mode text not null default 'listen',
  plan_offered_at integer,
  summary jsonb,
  follow_up jsonb,
  message_count integer not null default 0,
  user_message_count integer not null default 0,
  last_text text,
  last_at timestamptz,
  created_at timestamptz not null default now()
);
create index sessions_user_idx on public.sessions (user_id, created_at);
create index sessions_person_idx on public.sessions (person_id);

-- ─────────────────────────────────────────────
-- 메시지. 사진은 Storage(chat-images) 경로만 저장한다.
-- ─────────────────────────────────────────────
create table public.messages (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  text text not null,
  images jsonb,                        -- [{ path, mediaType }]
  mode text,
  created_at timestamptz not null default now()
);
create index messages_session_idx on public.messages (session_id, id);

-- ─────────────────────────────────────────────
-- API 사용량. 서버(service role)만 쓴다. 사용자는 자기 기록을 읽기만 한다.
-- 사용자가 지우거나 고칠 수 없어야 하루 한도를 우회하지 못한다.
-- ─────────────────────────────────────────────
create table public.usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  day date not null,                   -- 한국 날짜 (하루 한도 계산용)
  kind text not null,
  model text not null,
  session_id uuid,                     -- 상담을 지워도 사용량은 남긴다 (FK 없음)
  input integer not null default 0,
  cache_write integer not null default 0,
  cache_read integer not null default 0,
  output integer not null default 0,
  searches integer not null default 0,
  cost numeric(12, 6) not null default 0
);
create index usage_day_user_idx on public.usage (day, user_id);

-- 하루 사용 금액 합계. p_user 가 null 이면 서비스 전체.
-- 다른 사람 사용량이 섞인 합계라 서버(service role)만 부를 수 있다.
create function public.usage_spent(p_day date, p_user uuid default null)
returns numeric
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(sum(cost), 0)
  from public.usage
  where day = p_day and (p_user is null or user_id = p_user);
$$;
revoke execute on function public.usage_spent(date, uuid) from public, anon, authenticated;
grant execute on function public.usage_spent(date, uuid) to service_role;

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.persons  enable row level security;
alter table public.sessions enable row level security;
alter table public.messages enable row level security;
alter table public.usage    enable row level security;

create policy "own profile" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "own persons" on public.persons
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "own sessions" on public.sessions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    -- 남의 인물에 상담을 붙이지 못하게
    and (person_id is null or exists (
      select 1 from public.persons p where p.id = person_id and p.user_id = (select auth.uid())
    ))
  );

create policy "own messages" on public.messages
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.sessions s where s.id = session_id and s.user_id = (select auth.uid()))
  );

create policy "read own usage" on public.usage
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────
-- 사진 저장소: 비공개 버킷, 경로 첫 폴더가 본인 user_id 인 파일만 접근
-- 경로 규칙: {user_id}/{session_id}/{파일}
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images', 'chat-images', false, 6 * 1024 * 1024,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

create policy "own chat images read" on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own chat images insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own chat images delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'chat-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
