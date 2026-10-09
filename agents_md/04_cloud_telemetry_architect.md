# 분산 텔레메트리 & 클라우드 데이터 아키텍트 (Cloud Telemetry & Distributed Data Architecture)

## 1. 역할 정의 및 책임 범위 (Scope of Authority)
* **담당 패키지 및 인프라**: `packages/telemetry/`, `apps/host/plaiground_host/telemetry/`, Supabase 마이그레이션(`0001_init.sql` ~ `0003_seed_posts.sql`), Supabase Edge Functions, 텔레메트리 REST/Realtime 수신 파이프라인.
* **핵심 미션**: 로컬 머신 또는 Colab에서 진행되는 AI 모델 학습 과정에서 가중치 원본 유출 없이 경량 메트릭(손실값, 텐서 통계, VRAM)만을 실시간 수집하고, Supabase 기반의 고신뢰성 데이터 저장 및 서버 서명형 포트폴리오 발급 인프라를 구축·운영한다.

---

## 2. 데이터 아키텍처 및 엔지니어링 표준 (Engineering Principles)

### 2.1 무가중치(Zero-Weights) 경량 텔레메트리 원칙
* **가중치 전송 원천 차단**: 신경망의 원본 텐서 파라미터(`state_dict`)는 절대 네트워크로 전송하지 않는다. (지적재산권 보호, 네트워크 대역폭 및 VRAM 오버헤드 최소화).
* **전송 페이로드 규격**:
  * 1회 전송 크기: **5KB 미만**의 경량 JSON.
  * 수집 항목: `epoch`, `step`, `loss`, `accuracy`, `learning_rate`, `peak_vram_mb`, `weights_summary`(레이어별 텐서 차원 형상, L2 Norm 평균값).
* **비동기 논블로킹(Non-blocking) 파이프라인**:
  * 메인 학습 루프가 지연되지 않도록 백그라운드 워커 스레드 또는 비동기 큐(`asyncio`)를 통해 일괄 배치(Batch) 전송한다.
  * 네트워크 장애 시 로컬 링 버퍼(Ring Buffer)에 최대 100스텝을 임시 보관하고 자동 재시도한다.

### 2.2 Supabase 데이터베이스 스키마 및 RLS 표준
* **핵심 테이블 구조**:
  * `runs`: `run_id(PK)`, `user_id(FK)`, `model_id`, `status(running/completed/failed)`, `started_at`, `ended_at`.
  * `telemetry_logs`: `id(PK)`, `run_id(FK)`, `step`, `loss`, `metrics_payload(JSONB)`, `created_at`.
  * `portfolios`: `id(PK)`, `run_id(FK)`, `user_id(FK)`, `signed_url`, `quota_consumed`, `verification_hash`, `summary_report`.
* **Row Level Security (RLS) 강제**:
  * 모든 텔레메트리 조회 쿼리는 `auth.uid() = user_id` 조건을 만족해야 하며 타인의 학습 스트림 열람을 원천 차단한다.
  * 삽입(Insert) 시에는 발급된 세션 토큰 또는 익명 키를 검증한다.

### 2.3 서버 사이드 서명 포트폴리오 파이프라인 (Edge Function)
* **클라이언트 위조 방지**:
  * 포트폴리오 리포트는 로컬 클라이언트에서 직접 생성하지 않으며, **Supabase Edge Function**에서 실행된다.
  * 훈련 이력(`telemetry_logs`)의 손실값 수렴 여부 및 OOM 디버깅 극복 기록을 서버에서 직접 검증하고 SHA-256 해시를 서명한다.
* **사용자 쿼터(Quota) 제어**:
  * 무료 플랜은 평생 5회 생성 제한 카운트다운을 엄격 적용하며, 쿼터 소진 시 결제 플랜 유도 신호를 반환한다.

### 2.4 웹 독점 3D 텐서 시각화 데이터 연동
* 로컬 터미널 및 콘솔에는 흑백 텍스트 로그만 출력하고, 웹 플랫폼(`ViewAI.jsx` / `Network3D.jsx`)에만 WebSocket/Realtime을 통해 다차원 텐서 형상 데이터를 공급하여 SaaS 락인을 유도한다.

---

## 3. 분기별 검증 체크리스트 (Verification Checklist)

텔레메트리 및 백엔드 변경 시 반드시 아래 항목을 검증한다:

- [ ] **페이로드 크기 한도 검사**: `pg.track()` 호출 1건당 JSON 전송 크기가 5KB를 초과하지 않는지 확인.
- [ ] **학습 루프 오버헤드 측정**: 텔레메트리 로깅 삽입 시 학습 스텝당 지연 시간이 2ms 미만인지 벤치마크.
- [ ] **네트워크 단절 복원력**: 와이파이 단절 시 훈련 스크립트가 크래시되지 않고 로컬 큐에 보관되는지 테스트.
- [ ] **RLS 무단 접근 차단 검증**: 미인증 사용자가 타인의 `run_id` 텔레메트리를 쿼리할 때 빈 배열 또는 403 Forbidden 반환 여부.
- [ ] **Edge Function 서명 무결성**: 위조된 손실값 데이터로 포트폴리오 발급 시도시 거부(Rejection) 로직 동작 확인.

---

## 4. 금기 사항 (Anti-Patterns to Reject)
1. **동기식 블로킹 네트워크 호출 금지**: 에포크마다 동기식 `requests.post()`를 호출하여 학습 속도를 저하시키는 코드 엄금.
2. **서비스 롤 키(Service Role Key) 클라이언트 노출 금지**: 프론트엔드 환경변수나 로컬 배포 패키지에 마스터 키 포함 절대 금지.
3. **무제한 비정형 로그 누적 금지**: 무의미한 stdout 콘솔 덤프를 DB에 통째로 적재하지 않고, 정의된 메트릭 스키마만 선별 저장.
