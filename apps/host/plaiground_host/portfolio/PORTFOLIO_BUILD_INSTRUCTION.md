# [SYSTEM TASK] plAI-ground 자동 포트폴리오 생성 파이프라인 (DiffStack Engine) 구현 지침

## 1. 프로젝트 목적 및 핵심 가치 (Context & Goal)

본 태스크의 목적은 AI/SW 실습 중 발생하는 **[1. 런타임 에러 해결 서사]**, **[2. 데이터 전처리 가공 내역]**, **[3. 모델 성능 향상 델타(Baseline vs Tuned)]**를 가로채어, LLM을 통해 인과관계가 검증된 **'단일 완성형 개발자 포트폴리오(HTML/PDF)'**로 자동 변환하는 파이프라인을 구축하는 것입니다.

- **타깃 디렉토리**: `plaiground/portfolio_demo/`
- **핵심 타임라인**: 1-Day 스프린트 (단일 엔드포인트 및 원클릭 검증 스크립트 완성)

---

## 2. 파일별 구현 세부 명세 (Implementation Specs)

### Phase 1: 텔레메트리 수집 레이어 (`portfolio_demo/telemetry/`)

1. **`interceptor.py`**:
   - `sys.excepthook`을 재정의하여 Python 스크립트 예외 발생 시 `last_frame_file`, `last_frame_line`, `error_type`, `full_traceback`을 `.telemetry/last_error.json`에 저장.
   - 원래 터미널 화면에도 표준 에러가 정상 출력되도록 `sys.__excepthook__` 체이닝 유지.
2. **`git_tracker.py`**:
   - `subprocess`를 활용해 `git diff HEAD` 또는 직전 커밋 대비 변경점 추출.
   - git 미설치/미초기화 환경에서도 프로세스가 다운되지 않도록 예외 처리(Fallback 메시지 반환).
3. **`tracker.py` (`DiffStackTracker`)**:
   - `log_dataset(raw_len, processed_len, notes)`: 데이터 정제 통계 캡처.
   - `log_benchmarks(baseline_dict, final_dict, params_dict)`: 파인튜닝 전후 성능 메트릭 및 하이퍼파라미터 저장.
   - `save_run()`: 위 데이터와 `last_error.json`, `git_diff`를 병합하여 `.telemetry/raw_telemetry.json` 생성.

### Phase 2: 스키마 및 데이터 정제 (`portfolio_demo/core/`)

1. **`schema.py` (Pydantic V2)**:
   - `ProjectOverview`: `title`, `base_model`, `task_type`
   - `DataEngineering`: `dataset_name`, `preprocessing_techniques` (List[str]), `data_efficiency_impact`
   - `PerformanceBenchmarks`: `evaluation_metric`, `baseline_performance`, `optimized_performance`, `improvement_rate`, `optimization_methods` (List[str])
   - `TroubleshootingNarrative`: `error_type`, `root_cause`, `resolution_diff`, `engineering_takeaway`
   - `VerificationMeta`: `hardware`, `total_training_time`, `integrity_hash`
   - `PortfolioSchema`: 위 모든 모델을 포함하는 최상위 모델.
2. **`log_cleaner.py`**:
   - 수백 줄의 raw traceback에서 불필요한 내부 라이브러리(site-packages) 호출 경로를 제거하고 사용자 코드 에러 지점만 필터링.

### Phase 3: LLM 구조화 엔진 (`portfolio_demo/llm/`)

1. **`prompt.py`**:
   - 수집된 Raw Telemetry를 STAR(Situation-Task-Action-Result) 구조로 재구성하도록 유도하는 엄격한 System Prompt 정의.
   - 프롬프트 규칙: 제공된 텔레메트리 데이터 외의 거짓 정보(환각) 작성을 엄격히 금지.
2. **`generator.py`**:
   - OpenAI API (`gpt-4o-mini` 또는 `gpt-4o`) / Gemini API의 Structured Output(`response_format={"type": "json_object"}` 또는 `response_schema`) 연동.
   - LLM 응답을 `PortfolioSchema`로 파싱 및 검증. API Key 미설정 시에도 테스트가 가능하도록 **Mock Data Fallback 모드** 구현 필수.

### Phase 4: 시각화 및 렌더링 (`portfolio_demo/templates/`, `services/`)

1. **`portfolio_template.html` (Jinja2 + CDN Tailwind CSS)**:
   - 다크 테마/클린 테크 감성의 반응형 웹 레이아웃.
   - **4대 카드 그리드 구성**:
     - ① 상단 헤더: 프로젝트 정보, 베이스 모델 뱃지, 무결성 해시 워터마크
     - ② 데이터 엔지니어링: 전처리 전/후 통계 및 파이프라인
     - ③ 벤치마크 비교: Baseline vs Tuned 성능 델타($\Delta$) 시각적 차트/뱃지
     - ④ 에러 해결 서사: Error Traceback ➔ Code Diff Highlight ➔ Takeaway
2. **`renderer.py`**:
   - JSON 데이터를 기반으로 `SHA-256(timestamp + telemetry_data)` 무결성 해시 생성 및 메타데이터 주입.
   - Jinja2 템플릿에 데이터를 바인딩하여 독립 실행 가능한 단일 `portfolio_output.html` 파일로 컴파일.

### Phase 5: 인터페이스 및 검증 스크립트 (`portfolio_demo/`)

1. **`main.py` (FastAPI)**:
   - `POST /api/portfolio/generate`: `.telemetry/raw_telemetry.json`을 읽거나 직접 페이로드를 전달받아 포트폴리오 생성 후 HTML 렌더링 결과/JSON 반환.
   - `GET /api/portfolio/view`: 생성된 최신 포트폴리오 HTML 뷰 서빙.
2. **`run_demo.py` (원클릭 E2E 검증 스크립트)**:
   - 1. 더미 OOM 에러 강제 발생 ➔ 2) 가상 코드 수정 Diff 생성 ➔ 3) 텔레메트리 덤프 ➔ 4) LLM 포트폴리오 생성 ➔ 5) 최종 HTML 파일 생성까지 전 과정을 1회 실행으로 증명하는 스크립트.

---

## 3. 코딩 시 필수 주의사항 (Constraints & Coding Rules)

1. **단일 책임 원칙 및 모듈 독립성**:
   - `telemetry/` 모듈은 Web Framework(FastAPI)나 LLM 라이브러리에 종속되지 않는 순수 Python 표준 라이브러리 위주로 작성할 것.
2. **무중단 Fallback 보장**:
   - Git 저장소가 아니거나 `git` 명령어가 실패해도 절대 Exception으로 크래시가 나지 않도록 `try-except`로 보호할 것.
   - 환경변수 `OPENAI_API_KEY` 또는 `GEMINI_API_KEY`가 없을 경우 에러로 중단되지 않고 사전에 준비된 표준 Mock Payload를 반환하여 HTML 렌더링까지 끝까지 완주할 것.
3. **Pydantic V2 호환성**:
   - `BaseModel` 정의 시 Pydantic V2 문법(`model_dump()`, `model_validate()` 등)을 준수할 것.
4. **HTML 템플릿 자립성**:
   - 외부 로컬 CSS/JS 파일에 의존하지 말고, Tailwind CDN 및 인라인 스타일을 사용하여 생성된 `portfolio_output.html` 파일 단독으로 브라우저에서 완벽하게 렌더링되도록 구현할 것.

---

## 4. 최종 완료 기준 (Definition of Done)

- 터미널에서 `python -m portfolio_demo.run_demo` 실행 시:
  1. `.telemetry/raw_telemetry.json` 생성 완료 로그 출력.
  2. LLM 구조화 파싱 완료 로그 출력 (또는 Fallback Mock 적용 로그).
  3. `portfolio_demo/portfolio_output.html` 파일이 성공적으로 디스크에 기록.
  4. 생성된 HTML 파일을 브라우저로 열었을 때 4대 핵심 카드(데이터/성능/에러/무결성 해시)가 깨짐 없이 렌더링되면 완료.
