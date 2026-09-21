# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite + Tailwind CSS (confirmed by user; matches existing `web_demo/app`). New combined surface lives in `web_combine_demo/`.

## Users

- **AI/SW 전공 대학생 (B2C)**: 캡스톤/과제용 AI 모델을 학습해야 하지만 GPU 확보와 PyTorch/CUDA 환경 세팅에서 막히는 학생. 채용 시장에 낼 "문제 해결 서사" 포트폴리오가 필요하다.
- **대학 교수/학과 (B2B, 핵심 매출)**: SW중심대학·AI 학과 실습 과목 운영자. 실습실 인프라 비용과 "CUDA 안 돼요" 질의 오버헤드를 줄이고, 학생 평가 근거가 필요하다. 1,000만 원 이하 수의계약 규격(9,720,000원/61명/9개월)으로 구매한다.

## Product Purpose

plAI-ground (MENOTIS): 5분 원클릭 클라우드/로컬 GPU 실습 환경 구축 → 웹 IDE에서 직접 학습 실행 → 학습 텔레메트리·에러 해결 이력 자동 수집 → 검증형(무결성) 포트폴리오 자동 생성까지 이어지는 통합 AI 실습 플랫폼. 성공 = 학생이 코드를 직접 보고·고치고·실행하는 경험, 그리고 그 과정이 조작 불가능한 포트폴리오로 남는 것.

## Positioning

Colab/AWS와 달리 (1) 환경 세팅이 카탈로그 기반 원클릭이고, (2) 디버깅·에러 극복 서사가 SHA-256 타임스탬프 원장(Ledger)으로 기록되어 채용/성적 평가용 "검증형 포트폴리오"가 된다. 코드 결과물이 아니라 문제 해결 과정을 증명하는 것이 차별점.

## Operating Context

- 백엔드 실체: `ai_set_demo/api_server.py` (stdlib HTTP, 127.0.0.1:8765) — `GET /api/status`(Docker/GPU/이미지 감지), `GET /api/models`(ModelCatalog), `GET /api/setup?model_id=`(SSE 프로비저닝 → code-server IDE 세션).
- 포트폴리오 실체: `portfolio_demo/run_demo.py` — 인터셉터 → 텔레메트리(.telemetry/*.json) → Gemini/Mock 서사 생성 → Jinja2 렌더 → `portfolio_output.html`.
- 웹 IDE: 컨테이너 내 code-server(127.0.0.1:8080)를 iframe 임베딩. 학습은 사용자가 IDE 터미널에서 직접 실행.
- 보안 제약: API 서버는 docker 명령을 실행하므로 반드시 127.0.0.1에만 바인딩.

## Capabilities and Constraints

- 실행 가능한 실제 기능: 환경 감지, 모델 카탈로그, SSE 프로비저닝 위저드, IDE 임베딩, 포트폴리오 파이프라인 실행 및 HTML 결과 임베드.
- 목업으로만 존재: View AI 실시간 학습 시각화, Faculty LMS 대시보드 (스펙: `docs/specs/0*_SPEC.md`).
- 사전 조건: Docker Desktop 실행 + `plaiground-base:dev` 이미지.
- 카피 언어(확정): 영문 헤드라인/라벨 + 한글 본문.

## Brand Commitments

- 이름: plAI-ground (법인명 MENOTIS). 로고 심볼: 모노스페이스 "P" 블록.
- 사용자 지정 시각 레퍼런스(binding, web_combine_demo 한정): "Liquid Brokers" 랜딩 — 순수 블랙 캔버스, 중앙 대형 세리프 없는 헤드라인, 유리질/액체 금속 오브, pill 형태 CTA, 떠 있는 글래스 스탯 카드, 미세한 별빛 노이즈. 기존 web_demo의 Anti-AI 스펙(각진 rounded-sm, slate 팔레트)과는 별개의 새 표면.

## Evidence on Hand

- 사업계획: `doc/venture.md` (가격: B2B 9,720,000원/년, B2C Standard 15,000원·Premium 37,500원/월, 마진율 50~62%).
- 실동작 코드: `ai_set_demo/`, `portfolio_demo/`, 구버전 UI `web_demo/app/`는 삭제됨(git 이력에 보존).
- 생성된 실물 포트폴리오: `portfolio_demo/portfolio_output.html`.
- 없음(날조 금지): 고객 추천사, 실제 대학 계약 실적, 벤치마크 수치.

## Product Principles

1. 실행이 목업을 이긴다 — 버튼은 실제 백엔드를 호출해야 한다.
2. 학습은 자동으로 돌리지 않는다 — 사용자가 코드를 보고 직접 실행하는 것이 제품이다.
3. 증명 가능한 것만 말한다 — 수치는 venture.md와 실제 텔레메트리에서만 가져온다.
4. 로컬 우선, 보안 우선 — 루프백 바인딩, 소스코드 외부 전송 없음.
