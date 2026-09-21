# plAI-ground MVP 구현 상태 명세서

> **경로 안내 (2026-09-21):** 이 문서는 폴더 구조 변경 이전에 작성되었다. 본문의 `ai_set_demo/`, `portfolio_demo/`, `community_demo/`, `web_combine_demo/` 경로는 옛 이름이다. 현재 위치는 저장소 루트 [README.md](../README.md)의 대응표를 본다.

작성 기준: 2026-09-08 · 커밋 `485ecbf` · 대상 폴더 `ai_set_demo/`, `portfolio_demo/`, `web_combine_demo/` (+ 이들이 의존하는 `community_demo/`)

---

## 0. 한 줄 요약

**모델을 고르면 → Docker 컨테이너 + 웹 IDE가 뜨고 → 학습 스크립트가 생성·실행되며 → 그 실행 이력(에러·전처리·성능 델타)이 SHA-256 서명된 포트폴리오로 자동 변환되는 파이프라인이, 하나의 웹페이지 안에서 실제로 끝까지 돌아간다.**

3개 폴더는 각각 독립 실행 가능한 레이어이며, `web_combine_demo`가 앞의 둘을 하나의 HTTP 서버 + React SPA로 묶는다.

```
[web_combine_demo]  React SPA (랜딩 + 콘솔 6뷰) + 통합 API 서버 :8770
        │
        ├── 상속 ──> [ai_set_demo]     환경 프로비저닝 · 코드 생성 · code-server :8080
        │                                   └── 실행 산출물 ─┐
        ├── 호출 ──> [portfolio_demo]  텔레메트리 수집 → LLM 구조화 → HTML/JSON 렌더
        │                                   └── raw_telemetry.json <─┘
        └── 호출 ──> [community_demo]  글 40건 + 상호작용 상태 + 실습 코드 스테이징
```

---

## 1. ai_set_demo — 원클릭 환경 세팅

### 1.1 구현 완료 항목

| 파일 | 역할 | 상태 |
|---|---|---|
| `catalog.py` | `ModelSpec` dataclass + 4개 모델 하드코딩 카탈로그 | ✅ |
| `provisioner.py` | `ensure_ready(spec) -> EnvReport` — Docker 컨테이너 기동 | ✅ |
| `generator.py` | `generate(spec, out_dir) -> Path` — 템플릿 → 실행 가능 `.py` | ✅ |
| `templates/*.py.tmpl` | 모델 4종의 학습 스크립트 템플릿 | ✅ |
| `setup_and_train.py` | Orchestrator (CLI 진입점) — `provision()` / `run_pipeline()` | ✅ |
| `api_server.py` | stdlib `http.server` 기반 로컬 API (3 엔드포인트 + 정적 서빙) | ✅ |
| `docker/plaiground-base/Dockerfile` | 공용 베이스 이미지 (CUDA 12.4 + PyTorch cu124 + code-server) | ✅ |
| `docker/plaiground-base/entrypoint.sh` | 모델별 동적 pip install → ready 마커 → code-server 기동 | ✅ |
| `wizard_windows_gpu_setup.sh` | Windows WSL2 + NVIDIA GPU 패스스루 온보딩 마법사 | ✅ |

### 1.2 모델 카탈로그 (4종)

| model_id | 카테고리 | base_model | 데이터셋 | 최소 VRAM | 추가 의존성 |
|---|---|---|---|---|---|
| `klue-bert-finetune` | 텍스트 분류 | `klue/bert-base` (110M) | NSMC 2,000 서브셋 | 4GB | `accelerate` |
| `mnist-cnn-lite` | 이미지 분류 | custom CNN 2conv (<1M) | `torchvision.MNIST` | GPU 불필요 | 없음 |
| `llama32-1b-sft` | LLM 파인튜닝 (LoRA) | `meta-llama/Llama-3.2-1B` (1.2B) | KoAlpaca-v1.1a 1,000 | 6GB | `accelerate`, `peft` |
| `gemma4-e2b-sft` | LLM 파인튜닝 (LoRA) | `google/gemma-4-E2B-it` | NSMC 지시형 1,200 | 8GB | `accelerate`, `peft` |

`ModelSpec`은 UI용 메타데이터(`category`, `family`, `params`, `modality`, `access_note`)를 포함 → 프론트엔드 모델 브라우저의 카테고리·계열 필터가 이 필드를 그대로 소비한다. Llama/Gemma는 게이트 모델이라 `access_note`로 HF_TOKEN 필요를 명시.

### 1.3 프로비저닝 아키텍처 (어댑터 D)

`DECISION_ENV_PROVISIONING.md`에서 4개 후보(A: 모델별 이미지 / B: 호스트 동적 설치 / C: 모델별 venv / D: 공용 베이스 + 컨테이너 내 동적 설치)를 비교해 **D 채택**. 근거는 "웹 IDE 요구사항 충족 + RunPod 이관 비용 ≈ 0".

동작 순서:
1. `docker image inspect`로 `plaiground-base:dev` 존재 확인 — 없으면 데몬 미기동인지 이미지 미빌드인지 **원인을 구분해** 에러
2. `docker run --gpus all --entrypoint true`로 GPU 패스스루 실제 검증 (nvidia-smi 신뢰 안 함)
3. 기존 컨테이너 `rm -f` 후 새로 기동 (모델 전환 시 라이브러리 누적 방지)
4. 레포 루트를 `/workspace`로 bind mount, `PYTHONPATH=/workspace` 주입, `127.0.0.1:8080`에만 포트 바인딩
5. entrypoint가 `MODEL_REQUIREMENTS_FILE` 설치 후 `/tmp/.plaiground_ready` 마커 생성 → `_wait_ready()`가 최대 300초 폴링 (**경쟁 상태 방지**)
6. GPU 미감지 시 크래시 대신 `EnvReport.warnings`에 경고 담아 반환

Dockerfile에는 실전에서 잡은 함정 2개가 주석과 함께 박혀 있다:
- `cuda-compat-12-4` 패키지 purge — 안 지우면 WSL2 GPU 주입이 구버전 `libcuda.so.1`을 덮어쓰지 못해 `nvidia-smi`는 되는데 `torch.cuda.is_available()`이 False
- `torch`/`torchvision`을 **같은 pip 호출**에서 cu124 인덱스로 설치 — 따로 하면 torchvision이 PyPI에서 CUDA 13계열 torch를 끌어옴

### 1.4 코드 생성

stdlib `string.Template`(`$placeholder`) 사용 — 생성 대상이 파이썬 소스라 Jinja2의 `{}`와 충돌하기 때문. `safe_substitute`가 아닌 `substitute`를 써서 미치환 플레이스홀더는 조용히 넘어가지 않고 `KeyError`.

생성된 스크립트는 `portfolio_demo`의 텔레메트리 SDK를 임포트하도록 되어 있어, 실행 즉시 다음 레이어(포트폴리오)의 입력이 만들어진다.

### 1.5 CLI / API

```bash
python -m ai_set_demo.setup_and_train --list              # 모델 목록
python -m ai_set_demo.setup_and_train klue-bert-finetune  # 세팅 + 학습까지
python -m ai_set_demo.setup_and_train mnist-cnn-lite --setup-only  # 세팅만, 학습은 IDE에서
```

| 엔드포인트 | 응답 |
|---|---|
| `GET /api/status` | `{docker_running, image_exists, gpu_name, driver_version, wsl2_ready}` — `.env`(마법사 기록값) 병합 |
| `GET /api/models` | `ModelSpec` 4건 직렬화 |
| `GET /api/setup?model_id=` | **SSE** — `log` 이벤트 스트림 → 종료 시 `ready`(ide_url, run_command, script_path 등) |

### 1.6 검증 상태

통합 테스트 완료(PLAN.md 7절): `mnist-cnn-lite` acc 0.125 → 0.984, `klue-bert-finetune` f1 0.8587, **둘 다 GPU 사용 확인**. 모든 모듈에 `demo()` 자체 검증 함수 내장(`python -m ai_set_demo.catalog` 등).

---

## 2. portfolio_demo — 검증형 포트폴리오 자동 생성 (DiffStack Engine)

### 2.1 구현 완료 항목 (4 Phase 전부)

| Phase | 파일 | 역할 | 상태 |
|---|---|---|---|
| 1. 수집 | `telemetry/interceptor.py` | `sys.excepthook` 교체 → `last_error.json` + `error_history.json` 누적. 원 출력은 `sys.__excepthook__` 체이닝으로 보존 | ✅ |
| 1. 수집 | `telemetry/git_tracker.py` | `git diff HEAD` 추출. git 미설치/타임아웃/미초기화 전부 fallback 문자열 (크래시 없음) | ✅ |
| 1. 수집 | `telemetry/tracker.py` | `DiffStackTracker.log_dataset()` / `log_benchmarks()` / `save_run()` → `raw_telemetry.json` 병합 | ✅ |
| 2. 계약 | `core/schema.py` | Pydantic V2 5개 서브모델 + `PortfolioSchema` | ✅ |
| 2. 계약 | `core/log_cleaner.py` | 정규식으로 site-packages/frozen importlib 프레임 제거 | ✅ |
| 3. LLM | `llm/prompt.py` | STAR 구조 강제 + 한국어 강제 + **환각 금지(누락 시 "N/A")** 시스템 프롬프트 | ✅ |
| 3. LLM | `llm/generator.py` | Gemini 3.6 Flash JSON Mode 호출 + Mock Fallback + `_backfill_overview()` | ✅ |
| 4. 렌더 | `services/renderer.py` | SHA-256(timestamp + telemetry) 해시 주입 → Jinja2 HTML + 스키마 JSON 이중 출력 | ✅ |
| 4. 렌더 | `templates/portfolio_template.html` | Tailwind CDN 다크 테마 4카드 그리드 | ✅ |
| 실행 | `run_demo.py` | E2E 원클릭 검증 (더미 OOM 주입 → HTML까지 완주) | ✅ |
| 실행 | `train_real.py` | 실제 klue/bert-base 학습 + 텔레메트리 수집 레퍼런스 구현 | ✅ |
| 실행 | `generate_real_portfolio.py` | 실제 텔레메트리 → 포트폴리오만 재생성 | ✅ |

### 2.2 데이터 계약 (다운스트림 전체가 이 모양에 묶여 있음)

```
raw_telemetry.json
├── saved_at            ISO timestamp
├── overview            {project_name, task_type, ...}
├── dataset             {raw_len, processed_len, removed_samples,
│                        reduction_rate_pct, avg_len_before/after, notes}
├── benchmarks          {baseline{}, final{}, hyperparameters{}}
├── last_error          {error_type, error_message, last_frame_file/line, full_traceback}
├── error_history       [위 payload의 누적 배열]
└── git_diff            str (또는 fallback 메시지)
        │
        ▼ llm/generator.generate_portfolio()
PortfolioSchema  {overview, data_engineering, benchmarks, troubleshooting, verification}
        │
        ▼ services/renderer.render_portfolio()
portfolio_output.html   (Jinja2 렌더, 단독 실행 가능)
portfolio_output.json   (스키마 + integrity_hash + generated_at — 웹 네이티브 렌더링용)
```

**이 계약이 `ai_set_demo`가 텔레메트리 SDK를 재구현하지 않고 재사용해야 하는 이유다.** 새 트래커를 만들면 JSON 모양이 달라지고 렌더러가 못 읽는다 (PLAN.md 2-1절).

### 2.3 Zero-Crash 보장 (전 구간)

| 실패 조건 | 동작 |
|---|---|
| `GEMINI_API_KEY` 없음 / 네트워크 오류 | 한국어 Mock 데이터로 폴백, HTML까지 완주 |
| LLM이 필드를 `"N/A"`로 비움 | `_backfill_overview()`가 텔레메트리 실측값으로 채움 (최종 방어선) |
| git 미설치 / 미초기화 / 10초 타임아웃 | fallback 문자열 반환, 파이프라인 계속 |
| 텔레메트리 JSON 파손 | `JSONDecodeError` 흡수, 빈 dict로 진행 |
| 텔레메트리 저장 실패 | `except: pass` — 원래 프로그램 흐름 우선 보호 |

### 2.4 무결성 서명

`SHA-256(ISO_timestamp + json.dumps(telemetry, sort_keys=True))` → 64자 hex. HTML 헤더 카드/푸터 워터마크 + JSON `verification.integrity_hash`에 주입.

### 2.5 현재 저장된 실측 데이터

`.telemetry/raw_telemetry.json` (2026-09-04 기록): klue/bert-base 한국어 텍스트 분류, 원본 50,000 → 정제 40,800건(18.4% 제거), 평균 길이 312.4 → 197.8 토큰, F1 0.412 → 0.783.

---

## 3. web_combine_demo — 통합 플랫폼 웹페이지

### 3.1 구성

- **백엔드**: `api_server.py` — `ai_set_demo.api_server._Handler`를 **상속**해 3개 엔드포인트를 그대로 물려받고 포트폴리오/커뮤니티/IDE 엔드포인트를 추가. stdlib `ThreadingHTTPServer`, `127.0.0.1:8770` 전용 바인딩.
- **프론트엔드**: Vite + React 19 + Tailwind v4 SPA. 해시 라우팅(`#/community/err-001`)으로 브라우저 뒤로가기 지원, View Transitions API로 화면 전환(미지원 브라우저는 `.vt-fallback` 등장 애니메이션).

### 3.2 화면 구성 (7개)

| 화면 | 파일 | 내용 | 실체 |
|---|---|---|---|
| 랜딩 | `App.jsx` (`Landing`) | 히어로 터미널 극화(에러 인터셉트 → diff → SHA-256 서명), 플랫폼 3분할 시트, 파이프라인 밴드, 가격, FAQ 3건 | 정적 |
| Start AI | `StartAI.jsx` | 4단계 위저드: 환경 감지 → 모델 선택(카테고리/계열 필터) → SSE 프로비저닝 로그 → Web IDE 진입 | **실제** |
| Web IDE | `IdeView.jsx` | code-server(`:8080`) iframe 임베딩. `/api/ide/status`로 Start AI를 안 거쳐도 진입 가능. 실행 명령 복사 | **실제** |
| View AI | `ViewAI.jsx` | 신경망 노드 가중치·경사하강 애니메이션, Loss 곡선, VRAM/Util/Temp 게이지 (20 epoch 시뮬) | 시뮬레이션 (`SIMULATION` 배지) |
| Portfolio | `PortfolioView.jsx` | `run_demo.py` SSE 실행 → 스키마 JSON을 **웹 네이티브로 재렌더링**(iframe 아님). 델타 밴드, diff 하이라이트, SHA-256 서명 블록, MD 내보내기 | **실제** |
| 커뮤니티 | `Community.jsx` | 글 40건 목록/검색/카테고리 필터/정렬, 상세 페이지, 댓글, 추천·즐겨찾기·조회수, '실습해보기' | **실제**(글은 시드) |
| Faculty LMS | `Lms.jsx` | 학생별 실습 현황 테이블, 평가 CSV/포트폴리오 내보내기 버튼. **관리자 로그인 시에만 탭 노출** | 샘플 (`SAMPLE DATA` 배지) |

역할 전환(학생/관리자)은 우측 상단 `LoginMenu` 드롭다운 — 데모용 클라이언트 상태이며 인증은 없다.

### 3.3 API 명세 (통합 서버 :8770)

| Method | 경로 | 설명 |
|---|---|---|
| GET | `/api/status` `/api/models` `/api/setup` | ai_set_demo에서 상속 (§1.5) |
| GET | `/api/ide/status` | code-server 8080 소켓 응답 여부 |
| GET | `/api/portfolio/run` | **SSE** — `python -m portfolio_demo.run_demo` 서브프로세스 stdout 스트리밍 |
| GET | `/api/portfolio/data` | `portfolio_output.json` (프론트 네이티브 렌더링용) |
| GET | `/api/portfolio/output` | `portfolio_output.html` 원본 |
| GET | `/api/portfolio/export.md` | 스키마 → Markdown 변환 후 첨부파일 다운로드 |
| GET | `/api/portfolio/telemetry` | 상단 지표용 요약(dataset/benchmarks/error_count/파일 존재 여부) |
| GET | `/api/community/posts` | 시드 글 + state.json 델타 merge |
| GET | `/api/community/comments?post_id=` | 댓글 목록 |
| POST | `/api/community/interact` | `{post_id, action}` — view/like/unlike/bookmark/unbookmark |
| POST | `/api/community/practice` | 글의 실습 코드를 `ai_set_demo/generated/`에 실제 저장 |
| POST | `/api/community/comment` | 댓글 작성 |

포트폴리오 파이프라인은 **서브프로세스로 격리 실행**한다 — `run_demo`가 `sys.excepthook`을 갈아끼우기 때문에 서버 프로세스 안에서 임포트하면 서버가 오염된다.

### 3.4 디자인 시스템 (`DESIGN.md`, 305줄)

"The Liquid Ledger" — 순수 블랙(#050505) 캔버스 + 글래스 카드 + 4역 시그널 팔레트(gold=증명, cobalt=진행, mint=성공, ember=에러). 영문 헤드라인(Schibsted Grotesk) + 한글 본문(Noto Sans KR) + 기계 출력(JetBrains Mono)의 3성부 타이포그래피. 명문화된 규칙 9개(Two Stages / Two Navigations / Three Voices / Keep-All / One Ember / Glow-Not-Shadow / Calm Console / Borrowed Tint 등).

**정직성이 시각 규칙으로 박혀 있음**: 시뮬레이션·샘플 화면은 반드시 모노 대문자 배지를 h1 옆에 단다. "증명 불가능한 수치를 UI에 박지 않는다 — 예시 해시에는 '(예시)' 명기."

---

## 4. community_demo — 커뮤니티 백엔드 (통합 데모 의존성)

- **글 40건** 시드(`posts.py`): 오류해결 10 / 학습 결과 10 / Q&A 10 / 데이터 정보 10. 페르소나는 가상, 인용된 데이터셋·출처(KLUE·NSMC·KorQuAD·AI허브·Kaggle)와 기술 내용은 실재.
- **상호작용 델타는 실제 누적**: `state.json`에 조회/추천/즐겨찾기 증감을 쌓아 시드값과 merge. `threading.Lock`으로 워커 간 쓰기 보호.
- **'실습해보기'가 실제 동작**: 11건의 글이 실습 코드를 보유. `stage_practice()`가 코드를 `ai_set_demo/generated/`에 파일로 저장 → 컨테이너가 레포를 `/workspace`로 마운트하므로 Web IDE 터미널에서 즉시 실행 가능. 현재 스테이징된 파일 3개(`community_grad_accum.py`, `community_mnist_quick.py`, `community_nsmc_stats.py`).
- 댓글은 `comments.json`에 시드 + 실제 작성분 누적.

---

## 5. 실행 방법

```bash
# 최초 1회
cd ai_set_demo/docker/plaiground-base && docker build -t plaiground-base:dev .
cd web_combine_demo/app && npm install && npm run build

# 실행
cd ../.. && python -m web_combine_demo.api_server    # → http://127.0.0.1:8770
```

UI 개발 시(HMR): 터미널 1에서 API 서버, 터미널 2에서 `npm run dev` → `:5173`.

**사전 조건**: Start AI 실행에는 Docker Desktop + `plaiground-base:dev` 이미지 필요(위저드 1단계에서 실시간 확인). Portfolio는 Docker 없이도 동작하며, Gemini 키가 없으면 Mock 서사로 폴백.

---

## 6. 실제 동작 vs 시뮬레이션 (정직성 매트릭스)

| 기능 | 실체 |
|---|---|
| Docker/GPU 감지, 모델 카탈로그, 컨테이너 기동, 코드 생성 | **실제** |
| code-server 웹 IDE | **실제** (컨테이너 iframe) |
| 학습 실행 | **실제** (CLI는 `docker exec`, 웹은 IDE에서 사용자가 직접) |
| 텔레메트리 수집 → LLM 서사 생성 → HTML/JSON/MD 출력 | **실제** |
| 커뮤니티 카운트 누적, 댓글, 실습 코드 스테이징 | **실제** |
| 커뮤니티 글 40건 본문 | 데모 시드 (`SAMPLE DATA` 배지) |
| View AI 학습 시각화 | 시뮬레이션 (`SIMULATION` 배지) |
| Faculty LMS 학생 데이터 | 샘플 (`SAMPLE DATA` 배지, 관리자 전용) |
| 로그인/역할 | 클라이언트 상태만, 인증 없음 |

---

## 7. 미구현 / 알려진 한계

**의도적 범위 밖 (문서에 명시됨)**
1. RunPod/클라우드 GPU 연동 — `EnvironmentProvisioner`의 두 번째 어댑터로 예정. 시그니처(`spec -> EnvReport`)만 고정해 seam 확보. base 이미지는 그대로 재사용 가능.
2. 다중 사용자 동시성 — 1인 로컬 실행만 가정. 커뮤니티 상태도 파일 잠금 없음(필요 시 sqlite).
3. 모델 카탈로그 어드민 — dict 하드코딩 4건.
4. Faculty LMS 백엔드 — 화면만 존재.
5. View AI의 실 텔레메트리 연동 — 현재 클라이언트 시뮬레이션.

**기술적 천장**
- macOS(Apple Silicon): Docker GPU 패스스루 구조적 불가 → CPU 폴백. `mnist-cnn-lite`는 문제없으나 `klue-bert-finetune`은 느림.
- Windows: WSL2 + NVIDIA 드라이버 최초 1회 설정 필요 → `wizard_windows_gpu_setup.sh`가 안내.
- 게이트 모델(Llama/Gemma): HF 라이선스 동의 + `HF_TOKEN` 필요.
- 컨테이너 재사용 시 이전 모델 라이브러리 누적 → 매번 새로 기동으로 회피 중.
- **보안**: API 서버는 docker 명령과 학습을 실행하므로 `127.0.0.1` 전용 바인딩. code-server도 `--auth none`. **`0.0.0.0`으로 여는 순간 원격 코드 실행**이 된다.

---

## 8. 코드 규모

| 영역 | 파일 | 라인 |
|---|---|---|
| ai_set_demo (Python) | 5 | 716 |
| ai_set_demo (설계 문서) | 2 | 219 |
| portfolio_demo (Python) | 12 | 815 |
| web_combine_demo (Python) | 1 | 253 |
| web_combine_demo (React) | 7 | 1,905 |
| web_combine_demo (DESIGN.md) | 1 | 305 |

모든 Python 모듈에 `demo()` 자체 검증 함수 내장 — `python -m <module>` 또는 `--self-check`로 프레임워크 없이 즉시 검증 가능.
