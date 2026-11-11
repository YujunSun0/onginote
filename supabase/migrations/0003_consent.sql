-- 약관·개인정보 동의 기록
-- 앱은 로그인 토큰(app_metadata.consent_version)으로 동의 여부를 빠르게 확인하고,
-- 여기에는 언제 어떤 버전에 동의했는지 기록을 남긴다. 서버(secret key)가 쓴다.
alter table public.profiles
  add column consent_version text,
  add column consented_at timestamptz;
