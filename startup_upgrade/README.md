# plAI-ground 전략 및 기술 고도화 문서 (Startup Upgrade)

본 디렉토리는 plAI-ground의 **사업 모델(BM) 전략**과 **멀티 환경 원클릭 세팅 기술 아키텍처**를 상세하게 정리한 공식 전략 문서 저장소입니다.

---

## 📑 문서 목차

### 1. [01_BUSINESS_MODEL_STRATEGY.md](file:///c:/workspace/plaiground/startup_upgrade/01_BUSINESS_MODEL_STRATEGY.md)
> **핵심 주제:** 제로 인프라 자산경량형(Asset-Light) SaaS 전환, 정밀 가격 정책(B2C Pro 9,900원 / 대학 학과 420만 원 / KDT 320만 원 / AI 실무 역량테스트 2만 원), 마진율 98% 달성 및 벤치마크 분석

- **주요 내용:**
  - **기존 모델(RunPod GPU 대여) 폐기 근거**: 변동 원가(42.7%~50%) 부담, 유휴 서버 손실, 해외 인프라 장애 리스크 차단.
  - **새로운 수익 패러다임**: BYOC (로컬 PC 및 Google Colab 무료 연산 활용) 기반의 순수 DX/시각화/무결성 평가 SaaS.
  - **4계층 과금 구조**:
    - **Free Tier**: 원클릭 세팅 무제한 무료 + 포트폴리오 5회 무료 생성.
    - **B2C Pro (월 9,900원 / 연 99,000원)**: 포트폴리오 무제한 생성 + ViewAI 3D 텐서 시각화 + 커뮤니티 Fork & Run.
    - **B2B 대학 학과 (학기당 420만 원, VAT 별도)**: 국가계약법 제26조(추정가격 2천만 원 이하) 및 대학 학과장 500만 원 전결 규격에 최적화된 수의계약 패키지.
    - **B2B KDT 부트캠프 (기수당 320만 원, VAT 별도)**: 고용노동부 직업능력개발훈련 교재/소프트웨어 실습비 지원 기준(인당 약 10.6만 원 소요)에 완벽 부합하여 비전공자 이탈 방지.
    - **B2B AI 실무 역량테스트 (건당 20,000원)**: 프로그래머스의 단순 알고리즘 문제를 넘어 실제 OOM 해결 및 튜닝 실무 역량 평가 채점 리포트 제공.
  - **벤치마크 분석**: (주)그렙(프로그래머스), (주)무하유(카피킬러), Weights & Biases 비교.
  - **3개년 재무 시뮬레이션**: 1년차 매출 1.8억(순이익 1.6억) ➔ 3년차 매출 25.3억.

---

### 2. [02_ONE_CLICK_SETUP_STRATEGY.md](file:///c:/workspace/plaiground/startup_upgrade/02_ONE_CLICK_SETUP_STRATEGY.md)
> **핵심 주제:** 웹-로컬 브릿지(Web-to-Local Bridge) 기반 원클릭 디렉토리 세팅, CLI 및 Google Colab 1줄 연동

- **주요 내용:**
  - **브라우저 보안 제약 극복 방안 (Web-to-Local Bridge)**:
    - 웹 브라우저가 사용자의 컴퓨터 로컬 폴더에 직접 프로세스를 실행할 수 없는 보안 샌드박스 한계를 설명.
    - **로컬 에이전트 데몬(`127.0.0.1:8765`)** 아키텍처를 통해 웹 UI에서 지정한 로컬 디렉토리에 venv/패키지/학습코드/데이터를 구성하고 VS Code를 자동 실행하는 메커니즘 제시.
  - **3대 원클릭 지원 방식**:
    1. **CLI 터미널 도구 (`pip install plaiground` ➔ `plaiground init`)**: 전공자/엔지니어용 표준 도구.
    2. **Google Colab 1줄 연동 (`!pip install plaiground` ➔ `pg.load_template()`)**: 저사양/무료 GPU 사용자용.
    3. **웹-로컬 브릿지**: 웹 클릭 기반의 비전공자/초심자용 원클릭 디렉토리 세팅.
  - **중앙 계정 및 쿼터 관리**: Supabase Auth + 무료 5회 카운트다운 트랜잭션.
  - **코드 무결성 검증 (DiffStack)**: 점진적 디버깅 및 실행 로그 기록 기반 SHA-256 서명 발급.
