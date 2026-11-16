-- 사용량 기록(usage)을 사용자가 직접 읽지 못하게 한다 (2026-11-16)
--
-- 0001 의 "read own usage" 정책 때문에 공개 키로 DB 를 직접 부르면 본인 기록의 금액·모델 이름이 보였다.
-- 화면에는 하루 한도 대비 % 만 보여준다는 원칙에 맞춰 정책을 지운다. RLS 는 켜져 있으므로 정책이 없으면 읽기·쓰기 모두 막힌다.
-- 서버(service role)는 RLS 를 거치지 않으므로 한도 계산·사용량 화면·내 기록 내려받기는 그대로 동작한다.

drop policy if exists "read own usage" on public.usage;
