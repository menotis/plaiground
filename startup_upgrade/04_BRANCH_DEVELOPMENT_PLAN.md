# plAI-ground 브랜치 개발 계획서: uv(venv) 기반 BYOC 옴니채널 전환

> **문서 번호:** PLAI-PLAN-2026-004  
> **기준 브랜치:** `feature/byoc-omnichannel-uv` (예정)  
> **최종 개정일:** 2026년 10월  
> **핵심 원칙:**
> 1. 기본 환경을 **`uv(venv)` 초경량·초고속 엔진**으로 표준화 (Docker는 B2B 옵션으로 격리).
> 2. 웹 IDE 제거 ➔ **사용자 로컬 IDE(VS Code/Cursor/Antigravity/Codex) & Colab 옴니채널 허브**로 전환.
> 3. `apps/web/DESIGN.md`의 **"The Liquid Ledger" 안티-AI-슬롭(Anti-AI-Slop) 디자인 시스템 100% 보존 및 적용**.
> 4. **웹 독점 3D 시각화(SaaS 락인)**, **서버 서명 포트폴리오**, **안전한 커뮤니티 Fork & Run(safetensors)** 구현.

---

## 1. 아키텍처 패러다임 전환 요약

```
[ 기존 레거시 구조 ]
웹 페이지 ──> 웹 IDE (서버 GPU / RunPod 외주 비용 발생, 원가 50%) ──> 불안정한 로컬 데몬

[ 브랜치 목표 구조 (BYOC 옴니채널 허브) ]
웹 플랫폼 (Liquid Ledger 디자인 시스템, 웹 IDE 삭제)
   │
   ├─ [1. 모델/레시피 선택] ──> 고유 레시피 코드 발급 (예: AB12CD)
   │                             │
   │                             ▼ 사용자 로컬 IDE / Colab
   │                     plaiground pull AB12CD (or MCP/Skills 1-Line)
   │                             │
   │                             ▼ uv 기반 초고속 자동 분기 (수 초 내)
   │                     GPU/드라이버 감지 ➔ PyTorch 2.14.1 (cu126 or cu130)
   │
   ├─ [2. 실시간 텔레메트리] <── 로컬/코랩 pg.track() (Loss, GPU Mem, Git diff 요약값만 전송)
   │                             │
   ▼                             ▼
웹 전용 3D ViewAI 시각화        서버 서명 포트폴리오 발행 (무료 5회 카운트)
(Three.js, SaaS 독점 락인)      (Edge Function 기반 위조 방지 발급)
```

---

## 2. GPU 감지 및 `uv(venv)` PyTorch 최신 매트릭스 (2026년 10월 검증 기준)

### 2.1 PyTorch 2.14.1 공식 빌드 검증 팩트
* **최신 안정판**: `PyTorch 2.14.1` (PyPI 및 공식 인덱스 공통).
* **지원 CUDA 휠**: `cu126`, `cu130`, `cu132` (cu128/cu129는 이전 버전에서 중단됨).
* **NVIDIA 아키텍처 단절선**:
  * **CUDA 13.x 지원 제외**: Maxwell(GTX 900), Pascal(GTX 1000), Volta(V100).
  * **RTX 50 (Blackwell, sm_120)**: CUDA 12.8+ 필요 ➔ 실질적으로 `cu130` 필수.
  * **RTX 2060 Super (Turing, sm_75)**: 드라이버 580 이상 시 `cu130` 완벽 지원.

### 2.2 2계층 프리셋 매트릭스 (`uv` 기반 자동 판정)

| 그룹 | 명칭 | 대상 GPU | 최소 드라이버 | `uv` 설치 인덱스 | 비고 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Group A** | **Legacy** | GTX 900/1000, V100, 또는 구형 드라이버(560~579) RTX 20~40 | 드라이버 560+ | `https://download.pytorch.org/whl/cu126` | 안정성 보장 |
| **Group B** | **Standard (기본)** | RTX 20/30/40/50, GTX 16 시리즈 | 드라이버 580+ | `https://download.pytorch.org/whl/cu130` | 최고 성능 및 Blackwell 지원 |
| **Fallback** | **CPU / Colab** | 내장 그래픽, AMD/Intel, Mac(MPS) | N/A | PyPI 기본 CPU 빌드 | **"Colab 1줄 실행" 모달 즉시 유도** |

### 2.3 `uv(venv)` 실행 메커니즘
* **CUDA 툴킷 별도 설치 불필요**: PyTorch 휠 내부에 CUDA 런타임이 번들되어 있으므로 NVIDIA 그래픽 드라이버만 존재하면 구동.
* **설치 명령**:
  ```bash
  # Standard (Group B)
  uv venv .venv
  uv pip install torch==2.14.1 torchvision torchaudio --index-url https://download.pytorch.org/whl/cu130
  ```
* **도커(Docker)의 위치**: 개인 사용자는 `uv` 기본 제공. 대학 실습실 및 B2B KDT 부트캠프 납품 시에만 `pytorch/pytorch:2.14.1-cuda13.0-cudnn9-runtime` 도커 옵션을 제공하여 디스크 낭비 방지.

---

## 3. 웹 IDE 삭제 및 옴니채널 허브 재설계

### 3.1 삭제 대상
* `apps/web/src/IdeView.jsx` 완전 삭제.
* `apps/web/src/App.jsx` 내 `view === 'ide'` 라우팅, IDE 내비게이션 탭, 상단 헤더 IDE 링크 제거.
* 웹 상에서 코드를 직접 편집·실행하던 시뮬레이션 콘솔 제거.

### 3.2 신규 컴포넌트: `IdeConnectHub.jsx` (Start AI 3단계에 통합)
웹 플랫폼은 코드를 직접 돌리지 않고 **최적의 1줄 명령어와 레시피를 생성하는 허브** 역할을 수행합니다.

1. **모델 및 하이퍼파라미터 선택**: 사용자가 웹에서 ResNet, YOLO, Diffusion 등 모델 선택.
2. **레시피 코드(Pull Token) 발급**: 예: `PLAI-7X9B` (유효기간 24시간, Supabase 저장).
3. **IDE별 탭 제공**:
   * **VS Code**: `plaiground pull PLAI-7X9B` (터미널 1줄) + `.vscode/mcp.json` 자동 세팅.
   * **Cursor**: `plaiground pull PLAI-7X9B --ide cursor` (Cursor Composer 최적화).
   * **Antigravity / Codex**: `npx skills add plaiground/skills` + 레시피 호출.
   * **Google Colab**: [Colab에서 1줄로 열기] 딥링크 (`!pip install plaiground && plaiground pull PLAI-7X9B`).
4. **보안 강화**: 브라우저가 사용자 로컬에 직접 접근하는 취약한 상시 데몬(`127.0.0.1:8765`) 폐기 ➔ 사용자가 명시적으로 pull하는 클라이언트 주도형 통신 채택.

---

## 4. 안티-AI-슬롭(Anti-AI-Slop) 디자인 시스템 보존 및 적용 지침

`apps/web/DESIGN.md`에 명시된 독보적 디자인 언어 **"The Liquid Ledger"**를 브랜치 개발 시 100% 엄격 적용합니다.

### 4.1 핵심 시각 토큰 (Design Tokens)
* **Canvas**: 순수 블랙 `#050505` (`void`), 우물 바닥 `#0a0a0c` (`pit`).
* **Text**: `ink` (`#f2f0eb`), `mist` (`#a8a49b`), `dim` (`#8d897f`).
* **Signals (엄격한 4역 의미 고정)**:
  * **Gold (`#e8b34b`)**: 브랜드, 증명, 검증 뱃지, 랜딩 주 CTA, 레시피 코드.
  * **Cobalt (`#5b78ff`)**: 진행 중 프로세스(`[IN PROGRESS]`), 텔레메트리, 학생 역할.
  * **Mint (`#4ade9b`)**: 성공, 완료(`[READY]`), 학습 곡선 정상치.
  * **Ember (`#fb7185`)**: 에러, 예외(`[FAILED]`), diff 삭제 행.
* **Line & Glass**: `border-line` (`rgba(255, 255, 255, 0.08)`), `.glass-card` (`backdrop-blur-md bg-white/[0.04]`).

### 4.2 AI 냄새(AI Slop) 방지 8대 절대 규칙
1. **The Three Voices Rule (3성부 타이포그래피)**:
   * 헤드라인·수치: `Schibsted Grotesk` (bold 700, tight tracking `-0.03em`).
   * 한글 산문: `Noto Sans KR` (leading-relaxed, `@layer base` 내 `word-break: keep-all`).
   * 기계 출력: `JetBrains Mono` (로그, 해시, ID, 명령어, 상태 칩). 절대 다른 폰트를 섞지 않는다.
2. **The No-Border-Bloat Rule (컴포넌트 테두리 남발 금지)**:
   * **AI스러운 박스 테두리 남발 절대 금지**: 모든 자식 컴포넌트마다 1px 선을 겹겹이 두르는 전형적인 AI 생성 UI 형태를 거부한다.
   * 구획은 테두리가 아니라 여백(Gutter), 배경 깊이차(`void` vs `pit`), 또는 은은한 단일 글래스 면으로 정리한다.
3. **The Proportional Balance Rule (세로 신장 금지 / 안정적 수평 비율)**:
   * **세로로 길쭉하게 늘어지는 AI 카드 비율 전면 배제**: 카드와 패널이 불필요하게 세로로 길어지지 않도록 정보 밀도를 수평으로 배치한다.
   * 기존 plAI-ground 웹페이지가 지닌 12컬럼 비대칭 분할(7:5 또는 6:6), 컴팩트한 스탯 카드 등 조화로운 종횡비와 여백 리듬을 엄격히 계승한다.
4. **The One Ember Rule (채도 절제)**:
   * 컬러 배경 섹션, 보라-청록 그라디언트, 무의미한 일러스트는 절대 금지.
   * 색상은 상태(진행/성공/에러/증명)를 알릴 때만 점 또는 선으로 등장한다.
5. **The Two Stages Rule (CTA 무대 분리)**:
   * 랜딩 페이지의 주 행동은 **골드 pill** (`bg-gold text-void`).
   * 콘솔/앱 대시보드의 주 행동은 **뼈백색 ink pill** (`bg-ink text-void`, hover 순백).
6. **The Calm Console Rule (정적인 신뢰감)**:
   * 대시보드 내 무한 회전 애니메이션, 둥둥 떠다니는 장식 카드 전면 금지.
   * 모션은 진입 시 `animate-rise` 스태거 1회, 라이브 상태 표시 도트의 미세한 `pulse`로 제한.
7. **The Glow-Not-Shadow Rule (재질 기반 깊이)**:
   * 어색한 오프셋 드롭 섀도우 금지. 14px 블러 유리 질감과 미세한 1px 테두리, 그리고 빛의 발광(Glow)으로만 위계를 만든다.
8. **Honesty in Mockups (정직성 배지)**:
   * 시뮬레이션이나 예시 데이터가 포함된 UI는 반드시 제목 옆에 JetBrains Mono 대문자 배지(`SIMULATION`, `SAMPLE DATA`, `(예시)`)를 표기한다.

### 4.3 Impeccable 스킬 기반 기획-검증-제작 파이프라인
브랜치에서 프론트엔드 작업 진행 시 `impeccable` 스킬의 검증 원칙과 명령어 체계를 전적으로 활용합니다:
* **기획 단계 (`shape`)**: 기능 추가 전 유저 플로우 및 화면 정보 구조를 불필요한 장식 없이 본질만 남겨 기획.
* **제작 단계 (`layout`, `typeset`)**: 3성부 폰트와 마이크로 스페이싱, 적정 종횡비가 어긋나지 않도록 토큰 기반 빌드.
* **검증 단계 (`audit`, `polish`)**: AI 냄새 요소(과도한 테두리, 붕 뜬 마진, 세로 늘어짐, 대비 부족)를 점검하고 완성도 극대화.

---

## 5. 텔레메트리 & 웹 독점 3D 시각화 (SaaS 락인)

### 5.1 로컬 경량 텔레메트리 (`plaiground.track`)
* 사용자 PC나 Colab에서 모델 학습 시 `pg.track()`을 한 줄 삽입:
  ```python
  import plaiground as pg
  tracker = pg.init(recipe="PLAI-7X9B")
  
  for epoch, (loss, acc) in enumerate(train_loader):
      # 가중치 원본은 전송하지 않음 (보안 & 네트워크 절약)
      # 손실값, GPU VRAM 피크, 레이어별 텐서 차원 및 통계 요약값만 비동기 전송
      tracker.log(epoch=epoch, loss=loss, acc=acc, weights_summary=pg.summarize(model))
  ```
* 전송 데이터: 수 KB 단위의 경량 JSON ➔ Supabase DB로 직접 스트리밍.

### 5.2 웹 전용 ViewAI 3D 텐서 시각화 (`Network3D.jsx`)
* **로컬 미제공 원칙**: 터미널이나 로컬 IDE에는 흑백 텍스트 로그만 출력.
* **웹 플랫폼 독점 렌더링**:
  * 사용자가 웹의 ViewAI 화면에 접속하면 Three.js를 통해 레이어별 노드 연결망과 텐서 흐름을 3D Full-Mesh로 시각화.
  * 무료 플랜은 2D 학습 곡선, **B2C Pro(월 9,900원) 구독 시 3D 텐서 공간 탐색 기능 해금**하여 자연스러운 결제 유도.

---

## 6. 서버 서명 포트폴리오 생성 파이프라인

1. **트리거 다변화**:
   * CLI: `plaiground publish` ➔ 고유 URL 즉시 반환.
   * MCP: 에이전트 도구 `create_portfolio` 호출.
   * Web: 웹 대시보드 [포트폴리오 생성] 버튼 클릭.
2. **서버 사이드 발급 (보안 및 결제 보호)**:
   * 로컬 클라이언트에서 직접 생성하지 않고, **Supabase Edge Function**에서 실행.
   * 사용자 쿼터 확인 (무료 5회 카운트다운 ➔ 소진 시 결제 모달 유도).
   * LLM API를 호출하여 학습 실패 극복 이력(OOM 디버깅 등)을 포함한 공학적 리포트 생성.
   * 변조 방지 타임스탬프 기반 **SHA-256 서명 블록** 발행.
3. **공개 웹 포트폴리오**:
   * `plaiground.dev/p/@username/resnet50-study` 형태의 반응형 웹 문서로 호스팅되어 이력서 링크에 바로 첨부 가능.

---

## 7. 커뮤니티 Fork & Run (안전한 로컬 다운로드 및 실행)

### 7.1 공유 데이터 패키지 규격
* 사용자가 커뮤니티에 실습 글을 공유할 때 아래 4가지 요소가 번들링됨:
  1. **소스 코드 & 환경 잠금 파일**: `train.py`, `model.py`, `uv.lock`.
     * **핵심**: `uv.lock`에는 PyTorch 버전(2.14.1)만 고정하고 **CUDA 인덱스 태그는 고정하지 않음**.
  2. **가중치 파일**: **`safetensors` 포맷만 업로드 허용** (임의 코드 실행 취약점이 있는 `.pt`, `.pkl` 원천 차단).
  3. **데이터셋**: 50MB 이하 샘플은 Cloudflare R2에 저장, 대용량 데이터는 원본 허깅페이스/Kaggle URL과 체크섬만 저장.
  4. **보안/라이선스 서약**: 업로드 시 개인정보 및 저작권 침해 방지 체크박스 필수.

### 7.2 내려받는 사용자 실행 플로우 (2단계 안전 실행)
1. **[내 PC에서 실습하기] 클릭**:
   * 웹 다이얼로그에서 고유 포크 명령어 출력: `plaiground fork POST-104`.
2. **1단계: 자동 다운로드 및 맞춤형 가상환경 빌드**:
   * 사용자의 GPU를 즉시 감지하여, 글 작성자가 2060S에서 작성했더라도 받는 사용자가 RTX 4080이면 자동으로 `cu130` 빌드로 매핑하여 `uv venv` 구성.
3. **2단계: 코드 검사 후 명시적 사용자 실행**:
   * 보안을 위해 자동 실행하지 않고, 다운로드된 코드 요약(네트워크 통신 여부, 디스크 쓰기 경로)을 출력한 후 사용자가 직접 `python train.py`를 실행하도록 유도.

---

## 8. 브랜치 구현 마일스톤 및 체크리스트

```
[ 브랜치 개발 4주 로드맵 ]
Week 1: 코어 엔진 (uv 분기 & plaiground CLI/SDK)
Week 2: 웹 플랫폼 개편 (Web IDE 삭제 & IDE Connect Hub)
Week 3: 텔레메트리 연동 & 3D 시각화 독점 파이프라인
Week 4: 커뮤니티 Fork & Run 및 MCP/Skills 에이전트 패키징
```

### 단계별 상세 작업 체크리스트

#### Phase 1: 코어 파이썬 패키지 (`plaiground`)
- [ ] `gpu_detector.py`: `nvidia-smi` 기반 아키텍처(CC) 및 드라이버 버전 파싱 로직 구현.
- [ ] Group A(`cu126`) / Group B(`cu130`) / CPU 자동 분기 `uv venv` 빌더 구현.
- [ ] CLI 커맨드라인 인터페이스 구축 (`plaiground init`, `plaiground pull`, `plaiground fork`).
- [ ] `telemetry.py`: 학습 손실값 및 가중치 통계 요약 경량 송신 모듈 구현.

#### Phase 2: 프론트엔드 개편 (`apps/web`)
- [ ] `IdeView.jsx` 파일 및 관련 라우팅 전면 제거.
- [ ] `apps/web/DESIGN.md` 준수 검증: 골드/코발트/민트/엠버 시그널 폰트 및 모눈 그리드 보존.
- [ ] `IdeConnectHub.jsx` 신규 작성: VS Code, Cursor, Antigravity, Colab 맞춤 1줄 복사 UI.
- [ ] 레시피 코드 생성 및 세션 상태 동기화 모달 구현.

#### Phase 3: 3D 시각화 & 포트폴리오
- [ ] `Network3D.jsx`: 수신된 통계 데이터 기반 Three.js 3D 텐서 메시 인터랙션 완성.
- [ ] 포트폴리오 생성 Supabase Edge Function 연동 (무료 5회 카운트다운).
- [ ] SHA-256 서명 블록 및 공학적 리포트 네이티브 렌더링.

#### Phase 4: 커뮤니티 Fork & Run & 에이전트 확장
- [ ] 커뮤니티 포스트 상세 다이얼로그에 `safetensors` 검증 로직 및 `plaiground fork` 명령 연동.
- [ ] Antigravity / Cursor용 MCP 서버 구성 (`plaiground mcp`).
- [ ] Agent Skills 패키지 배포 (`.agents/skills/plaiground`).
