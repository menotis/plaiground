# 결정 기록: EnvironmentProvisioner 어댑터 선택

사용 스킬: `mattpocock-skills:codebase-design` (어댑터 비교 — Design It Twice 프레임 적용)

> **업데이트 (2차 논의):** 최초 결정(어댑터 B)은 "웹 IDE 없이 로컬 스크립트만 실행"한다고 잘못 가정하고 내린 결정이었다. 사용자의 원래 구상은 처음부터 "도커로 띄운 환경 위에 code-server(오픈소스 VS Code 웹 IDE)를 얹어서 브라우저로 제공"이었고, 이는 `web_demo`의 제품 방향과도 일치한다. 이 정보를 반영해 **어댑터 D**를 추가하고 최종 결정을 D로 변경한다. 아래 A/B/C 비교는 그 논의 과정을 남기기 위해 그대로 둔다.

## 질문

원클릭 세팅을 "모델 선택 시 그때그때 필요한 걸 설치"로 할지, "모델별 Docker 이미지를 미리 만들어 컨테이너로 띄우는" 방식으로 할지.

## 전제 (PLAN.md에서 이미 확정된 부분)

`EnvironmentProvisioner` 모듈의 **인터페이스는 이미 고정**되어 있다:

```
ensure_ready(spec: ModelSpec) -> EnvReport
```

이 질문은 인터페이스를 다시 설계하는 게 아니라, 이 인터페이스 뒤에 어떤 **어댑터**를 놓을지 고르는 문제다. (SKILL.md 용어: 인터페이스는 그대로, 구현/어댑터만 교체)

## 후보 어댑터 3개 비교

### 어댑터 A — 모델별 Docker 이미지 (사용자가 원래 생각한 방식)

- **구현:** 모델마다 Dockerfile 작성 → 이미지 사전 빌드 → 선택 시 해당 이미지로 컨테이너 실행
- **숨기는 복잡도:** 의존성 완전 격리, OS 레벨 재현성
- **치명적 문제 (로컬 1인 실행 맥락에서):**
  - **GPU 패스스루 설정 비용.** Windows는 WSL2 + NVIDIA 드라이버 + Docker Desktop WSL2 백엔드를 거치면 GPU 패스스루가 **지원되지만**(정정: 불가능이 아니라 최초 1회 설정이 필요한 것), macOS(특히 Apple Silicon)는 Docker Desktop이 리눅스 VM 위에서 돌기 때문에 Metal/MPS를 컨테이너에 넘길 방법이 구조적으로 없다 — 이건 Docker 유무와 무관한 macOS 자체의 한계.
  - **다운로드량:** PyTorch+CUDA 베이스 이미지만 5~8GB. 모델 2개만 써도 사용자가 10GB 이상을 받아야 함 — "5분 원클릭" 목표와 반대 방향.
  - **Locality 악화:** 모델이 늘 때마다 Dockerfile을 별도로 유지해야 하고, 베이스 이미지 버전 드리프트를 계속 관리해야 함 — 변경이 한 곳에 모이지 않고 Dockerfile 개수만큼 흩어짐.
- **평가:** Depth는 높아 보이지만(격리 완전) 그 depth가 지금 우리가 겪는 문제(로컬 1인, GPU 이미 로컬에 있음)를 위한 게 아니라 **다른 문제(다수 사용자 격리)를 위한 depth**다. 문제와 어댑터가 안 맞는다.

### 어댑터 B — 매번 동적 세팅, 공용 환경 1개 (지금 PLAN.md 방식)

- **구현:** 사용자의 기존 Python/venv 환경에서, 모델 선택 시 `import` 체크 후 없는 패키지만 `pip install`. Docker 없음.
- **숨기는 복잡도:** 패키지 존재 여부 확인, 최초 1회 설치, CUDA 가용성 감지
- **장점:**
  - GPU 패스스루 문제 자체가 없음 (컨테이너 경유 안 하므로 로컬 CUDA/MPS 그대로 사용)
  - 다운로드량 최소 — 공통 패키지(`torch`, `transformers`, `datasets`)는 한 번만 설치, 두 모델이 재사용
  - 코드가 한 함수(`ensure_ready`)에 집중 — Locality 최고
- **단점:** 여러 모델의 의존성이 서로 다른 버전을 요구하면 충돌 가능. 전역 환경 오염 가능성.
- **현재 리스크 수준:** 지금 카탈로그의 두 모델(`klue-bert-finetune`, `mnist-cnn-lite`)은 `torch`, `torchvision` 정도만 겹치고 버전 요구가 사실상 동일 — **실질 충돌 리스크는 낮음.**

### 어댑터 C — 모델별 venv (Docker 없이 표준 라이브러리로 격리)

- **구현:** `python -m venv .venv_<model_id>` 로 모델별 가상환경만 분리. 컨테이너는 안 씀.
- **장점:** Docker의 격리 이점 일부(패키지 충돌 방지)를 stdlib(`venv`)만으로 얻음. GPU 패스스루 문제 없음 (venv는 OS 프로세스 그대로라 로컬 CUDA 접근 문제 없음).
- **단점:** 어댑터 B보다 구현이 한 단계 더 필요하고, 모델 전환 시 최초 설치 시간이 모델마다 매번 듦(공용 패키지 캐시 재사용 안 됨).
- **지금 필요한가:** "어댑터가 1개면 가상의 seam, 2개 이상 실제로 갈라져야 진짜 seam"이라는 원칙(SKILL.md)에 따르면, 지금은 두 모델 의존성이 실제로 충돌하지 않으므로 이 격리가 아직 **필요를 증명하지 못했다.**

### 어댑터 D — 공용 베이스 Docker 이미지(torch+CUDA+code-server) + 컨테이너 내부 모델별 동적 설치 (최종 채택)

- **구현:**
  1. `plaiground-base` 이미지 **1개**만 빌드/유지: CUDA + PyTorch + `code-server`(오픈소스 VS Code 웹 IDE, 직접 구현 안 하고 `coder/code-server` 그대로 사용) + `portfolio_demo/telemetry` SDK
  2. 모델 선택 시 이 이미지로 컨테이너 실행 (`docker run --gpus all`, 워크스페이스 볼륨 마운트)
  3. 컨테이너 진입점 스크립트가 `ModelSpec.extra_requirements`만 `pip install` (무거운 torch/CUDA는 이미 base 레이어에 있으므로 이 설치는 수 초~수십 초)
  4. code-server 포트를 브라우저에 노출 → 사용자는 웹 IDE로 진입, `generated/` 스크립트가 이미 워크스페이스에 놓여 있음
- **숨기는 복잡도:** 컨테이너 라이프사이클(실행/재사용/정리), 포트 매핑, base 이미지 존재 확인·최초 pull, 모델별 추가 설치
- **장점:**
  - **웹 IDE 요구사항을 그대로 만족.** 사용자가 처음부터 원했던 "클릭 → 웹 브라우저에 VS Code" 경험이 이 어댑터에서만 나온다. B/C는 이 요구사항을 못 채운다.
  - **마이그레이션 비용이 사실상 0.** `plaiground-base` 이미지는 로컬용으로 만들지만, RunPod 워커도 어차피 Docker 이미지 기반이라 Phase 3에서 거의 그대로 재사용 가능 — "로컬용 따로, 클라우드용 따로" 만드는 이중 작업이 없어짐.
  - **무거운 레이어(torch/CUDA)는 한 번만, 가벼운 레이어(모델별 라이브러리)만 매번** — 다운로드/설치 비용이 A(모델별 풀 이미지)보다 훨씬 낮음.
- **단점 / 알려진 한계 (지금 해결 안 하고 명시만 해둠):**
  - Windows는 WSL2+NVIDIA 드라이버 최초 설정이 필요 → `mattpocock-skills:wizard`로 온보딩 마법사 스크립트를 만들어 이 설정을 안내 (사람만 할 수 있는 단계라 이 스킬 용도에 정확히 맞음)
  - macOS(Apple Silicon)는 GPU 패스스루 자체가 불가능 → base 이미지에 CPU 폴백 경로를 기본으로 넣어야 함 (M1/M2 사용자는 CPU 학습, `mnist-cnn-lite`는 CPU로도 충분히 감당 가능하지만 `klue-bert-finetune`은 느려짐 — 알려진 천장으로 문서에만 남김)
  - 한 컨테이너를 계속 재사용하며 모델을 여러 번 전환하면 이전 모델의 라이브러리가 안 지워지고 누적될 수 있음 → 모델 전환 시 컨테이너를 재사용하지 말고 매번 새로 띄우는 편이 깔끔 (base 레이어는 캐시되어 있어 재실행 비용이 낮음)

## 비교표

| 기준 | A. Docker per model | B. 동적 세팅(공용 1개) | C. venv per model | D. 공용 베이스 Docker + 동적 설치 |
|---|---|---|---|---|
| 웹 IDE 제공 | 가능하지만 이미지 N개 필요 | 불가 (별도로 code-server 붙여야 함) | 불가 | **기본 제공** |
| 로컬 GPU 접근 | 이미지 무거움 + 설정 필요 | 즉시 가능 | 즉시 가능 | 설정 1회 필요 (Windows), Mac 불가(구조적 한계) |
| 온보딩 속도 (5분 룰) | 실패 (수 GB × N) | 충족 | 충족 | 최초 1회 base pull 후 충족 |
| 구현/유지보수 Locality | 낮음 (Dockerfile N개) | 최고 | 높음 | 높음 (Dockerfile 1개 + entrypoint 스크립트) |
| 클라우드(RunPod) 전환 비용 | 낮음 (이미 도커) | **다시 만들어야 함** | **다시 만들어야 함** | **거의 0** (같은 이미지 재사용) |

## 최종 결정: 어댑터 D

`ensure_ready(spec: ModelSpec) -> EnvReport` 인터페이스는 그대로 유지하고, 구현체만 "공용 베이스 이미지 + 컨테이너 내부 동적 설치"로 정한다. B/C가 "지금 문제"만 풀었다면, D는 "지금 문제(로컬 온보딩)"와 "제품이 원래 원한 것(웹 IDE)"과 "나중 문제(클라우드 이관)"를 동시에 만족시킨다.

**바로 다음 구현 항목 추가 (PLAN.md 6번 폴더 구조에 반영 필요):**
- `docker/plaiground-base/Dockerfile` — base 이미지 정의 (torch+CUDA+code-server+telemetry SDK)
- `provisioner.py`의 `LocalDockerAdapter` — 컨테이너 실행/entrypoint 로직
- Windows GPU 패스스루 온보딩 마법사 (`mattpocock-skills:wizard` 사용, 별도 작업으로 분리)

## 부록: GPU 모델별로 이미지를 따로 둘 필요가 없는 이유

**흔한 오해:** "GPU 모델마다 CUDA/PyTorch 버전이 다르니 이미지도 따로 필요하다."

**사실:** PyTorch 공식 빌드 하나(예: `cu121` 빌드)는 여러 compute capability(sm_50~sm_90대)를 한 번에 컴파일해 담고 있다. 즉 **base 이미지 1개가 Pascal~Hopper 세대 GPU를 전부 커버**한다. RunPod이 A5000/A6000 두 종만 쓰기로 한 것도 CUDA 호환성 때문이 아니라, 둘이 애초에 같은 아키텍처(Ampere, cc 8.6)인데다 가격/재고 관점의 선택일 뿐 — 이미지 개수와는 무관하다.

실제로 신경 쓸 제약은 GPU "모델"이 아니라:
1. **호스트 드라이버 버전** — CUDA 버전마다 최소 드라이버 요구치가 있다 (예: CUDA 12.3+ → 드라이버 545+). `EnvReport`에 드라이버 버전 체크를 넣고, 부족하면 이미지를 늘리는 대신 "드라이버 업데이트 필요" 메시지로 안내한다.
2. **아주 최신 GPU 세대 출시** — 예: RTX 5090은 PyTorch 2.8부터 지원. base 이미지의 PyTorch 버전을 주기적으로 갱신하면 해결되고, 이미지 개수를 늘릴 이유가 아니다.

결론: `plaiground-base`는 로컬이든 RunPod(A5000/A6000)든 **여전히 이미지 1개**로 유지한다. 로드맵이 바뀌지 않는다.

## 중요한 연결점: Docker는 틀린 게 아니라 "다른 seam"에서 맞는 선택이다

`PLAN.md`에 이미 적어둔 확장 seam(로컬 → RunPod)을 다시 보면:

- **로컬 seam (지금, 어댑터 B):** 사용자 1명, 자기 GPU, 순차 실행 → Docker 불필요
- **클라우드 seam (나중, Phase 3 방식 B):** RunPod Serverless에 올라가는 워커 자체가 원래 **Docker 이미지 기반**이다. 이때는 서로 모르는 다수 사용자의 코드를 같은 물리 서버에서 동시에 돌려야 하므로 OS 격리가 필수가 되고, 그 순간 Docker가 정확한 답이 된다.

즉 "모델별 Docker"라는 원래 아이디어는 틀린 게 아니라 **시점이 이르다** — 로컬 MVP가 아니라 Phase 3 클라우드 확장 때 `EnvironmentProvisioner`의 두 번째 어댑터(`RunPodServerlessAdapter`)로 자연스럽게 등장할 개념이다. PLAN.md에서 이 seam을 미리 표시해둔 이유가 바로 이것.
