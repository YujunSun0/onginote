-- 캐릭터가 웹 검색을 했을 때 검색어와 참고한 글(제목·주소)을 메시지와 함께 남긴다.
-- 형식: { "queries": ["..."], "links": [{ "title": "...", "url": "https://..." }] }
alter table public.messages add column sources jsonb;
