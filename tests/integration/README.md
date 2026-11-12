# 통합 테스트

켜져 있는 서버에 실제 요청을 보내서, 화면 뒤의 규칙이 지켜지는지 확인합니다.

| 파일 | 확인하는 것 |
|---|---|
| `isolation.test.mjs` | 다른 사람의 인물·상담·사진에 API로도, 공개 키로 DB에 직접 접근해도 닿지 않는지. 사용량 표를 사용자가 고칠 수 없는지. 1인 하루 한도 |
| `plans.test.mjs` | 무료·온기 패스 한도 (상담 수, 상담 길이, 검색 횟수, 하루·한 달 한도), 사용자가 스스로 패스로 바꿀 수 없는지 |
| `reports.test.mjs` | 연애 성향 리포트 해금 조건, 결제 전에는 API·DB 직접 조회 모두 미리보기만 보이는지, 단건 결제 주문·금액·승인 검증, 남의 리포트 접근, 구독 환불과 섞이지 않는지 |
| `billing.test.mjs` | 정기결제 갱신, 같은 날 두 번 불러도 한 번만 결제, 실패 재시도와 유예, 해지·만료 시 빌링키 삭제, 환불 조건 |
| `consent.test.mjs` | 동의 전에는 모든 API 가 막히는지 (대화가 해외로 전송되기 전), 동의 기록, 동의 거부 시 처리 |
| `me.test.mjs` | 닉네임, 기록 내려받기, 탈퇴 시 지워지는 범위와 남는 기록(사용량·재가입 제한 해시) |
| `landing.test.mjs` | 로그인 상태별 첫 화면, 공개 파일 (robots, 공유 이미지, PWA) |

## 실행

```bash
npm run build && npm run start   # 서버 켜기 (다른 터미널, 또는 npm run dev)
npm run test:integration:quick   # AI 답변이 필요한 항목은 건너뜀 (비용 없음)
npm run test:integration         # 전체
npm run test:integration -- billing   # 파일 이름으로 골라서
```

- `.env.local` 의 값을 씁니다 (Supabase 관리자 키, `CRON_SECRET`, `ONGI_EMAIL_HASH_KEY`).
- 서버 주소는 `TEST_BASE_URL` 로 바꿀 수 있습니다 (기본 `http://localhost:3000`).

## 주의

- `.env.local` 이 가리키는 **실제 Supabase 프로젝트**에 `onginote-test-*@example.com` 계정을 만들었다가 지웁니다. 테스트가 중간에 실패해도 실행기(`run.mjs`)가 끝에 지웁니다.
- 전체 실행은 Claude API 를 몇 번 불러서 비용이 조금 들고, 그날 서비스 전체 사용량에도 잡힙니다.
- 결제 테스트는 가짜 빌링키를 써서 토스페이먼츠에서 실제 결제가 이뤄지지 않습니다.
