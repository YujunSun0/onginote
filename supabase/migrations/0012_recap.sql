-- 연말 결산 (2026-11-16): 무료. 12/15 ~ 1/31 에 볼 수 있고, 12/31 까지의 상담으로 만든다.
--
-- 리포트 표에 'recap' 종류로 저장한다 (사용자 권한 없음은 그대로, 서버가 본인 것만 읽는다).
-- 시즌(content.season)마다 한 사람에 한 줄: 동시에 두 번 눌러도 하나만 만들어진다. 다시 만들 때는 같은 줄을 고친다.
-- 무료라 결제와 상관없고, 탈퇴하면 다른 리포트처럼 지운다.

alter table public.reports drop constraint reports_kind_check;
alter table public.reports add constraint reports_kind_check check (kind in ('personality', 'relationship', 'recap'));

create unique index reports_recap_season_idx on public.reports (user_id, (content ->> 'season')) where kind = 'recap';
