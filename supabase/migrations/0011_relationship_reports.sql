-- 관계 흐름 리포트 (2026-11-16): 사람 한 명과의 상담으로 만드는 리포트. 사람마다 따로 3,900원.
--
-- 연애 성향 리포트와 같은 reports 표를 쓴다 (결제 전 미리보기만 내보내는 방식, 사용자 권한 없음도 같다).
-- person_id 로 어느 사람의 리포트인지 적는다. 사람을 지우면 그 사람의 상담처럼 리포트도 지운다.
-- 결제 기록은 남는다 (payments.report_id 는 on delete set null). 리포트가 지워져도 영수증에 상품 이름이 남도록 order_name 을 적는다.

alter table public.reports drop constraint reports_kind_check;
alter table public.reports add constraint reports_kind_check check (kind in ('personality', 'relationship'));

alter table public.reports add column person_id uuid references public.persons (id) on delete cascade;
-- 관계 흐름 리포트에는 사람이 꼭 있고, 연애 성향 리포트에는 없다
alter table public.reports add constraint reports_person_check check ((kind = 'relationship') = (person_id is not null));
create index reports_person_idx on public.reports (user_id, person_id, created_at desc) where person_id is not null;

alter table public.payments add column order_name text;
update public.payments set order_name = case when kind = 'report' then '온기노트 나의 연애 성향 리포트' else '온기노트 온기 패스 1개월' end
where order_name is null;
