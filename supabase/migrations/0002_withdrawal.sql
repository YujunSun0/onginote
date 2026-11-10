-- 회원 탈퇴와 재가입 제한
-- Supabase 대시보드 > SQL Editor 에서 0001_init.sql 다음에 한 번 실행한다.

-- ─────────────────────────────────────────────
-- 사용량 기록은 탈퇴해도 남긴다 (서비스 전체 하루 한도 계산용).
-- 계정이 지워지면 user_id 만 비워서 누구 것인지 알 수 없게 한다.
-- ─────────────────────────────────────────────
alter table public.usage alter column user_id drop not null;
alter table public.usage drop constraint usage_user_id_fkey;
alter table public.usage
  add constraint usage_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;

-- ─────────────────────────────────────────────
-- 탈퇴한 이메일. 원문 대신 서버 비밀키로 만든 HMAC 해시만 보관한다.
-- 기간(기본 30일)이 지나면 서버가 지운다. 서버(secret key)만 읽고 쓴다.
-- ─────────────────────────────────────────────
create table public.withdrawn_emails (
  email_hash text primary key,
  withdrawn_at timestamptz not null default now()
);
alter table public.withdrawn_emails enable row level security;
-- 정책을 만들지 않아서 로그인한 사용자도 접근할 수 없다
revoke all on public.withdrawn_emails from anon, authenticated;
