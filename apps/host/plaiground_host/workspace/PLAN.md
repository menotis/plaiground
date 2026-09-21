# ai_set_demo MVP 설계 계획
사용 스킬: `mattpocock-skills:codebase-design` (Deep Module 설계 원칙)

## 1. 목표 / 범위

**목표:** AI 모델을 고르면 → 로컬 GPU 환경이 자동 세팅되고 → 예시 코드가 생성되며 → 소규모 데이터셋으로 즉시 학습이 도는 원클릭 MVP.

**범위 밖 (지금 안 만듦):**
- RunPod/클라우드 GPU 연동 (`docs/specs/02_SETUP_WORKSPACE_SPEC.md`의 Card B) — 로컬(BYOG) 카드만 구현
- 커스텀 웹 프론트엔드(React, `web_demo/`) — 웹 IDE는 `code-server`(오픈소스)를 그대로 쓰고, `web_demo`가 스펙한 자체 UI는 나중 단계
- 모델 카탈로그 관리 어드민, 다중 사용자 동시성 — 1인 로컬 실행만 가정

**업데이트:** EnvironmentProvisioner의 실제 구현은 `DECISION_ENV_PROVISIONING.md`에서 어댑터 D(공용 베이스 Docker + code-server + 컨테이너 내 동적 라이브러리 설치)로 확정. 아래 3번 표는 그 결정을 반영한다.

## 2. 기존 자산 재사용 (Deletion Test 통과한 것들)

새로 만들면 오히려 복잡도가 늘어나는 부분은 전부 기존 코드를 그대로 가져다 쓴다.

| 필요 기능 | 재사용할 기존 코드 | 비고 |
|---|---|---|
| 에러 자동 캡처 | `portfolio_demo/telemetry/interceptor.py` (`install_error_interceptor`) | 이미 `sys.excepthook` 기반으로 완성됨. 재구현 금지. |
| 학습 통계/벤치마크 기록 | `portfolio_demo/telemetry/tracker.py` (`DiffStackTracker`) | `log_dataset`, `log_benchmarks`, `save_run()` 그대로 사용 |
| 실행 가능한 학습 스크립트의 "정답 모양" | `portfolio_demo/train_real.py` | 이 파일 자체가 BoilerplateGenerator가 찍어내야 할 산출물의 레퍼런스. 구조를 템플릿화만 하면 됨 |
| 하드웨어 감지 UI 문구/상태값 | `docs/specs/02_SETUP_WORKSPACE_SPEC.md` STEP 1 | `[SCAN_COMPLETE]`, VRAM 표시 형식 등 나중에 UI 붙일 때 그대로 사용 |

즉 이번 MVP에서 진짜로 새로 짜야 하는 건 "모델 선택 → 그 모델에 맞는 `train_real.py` 변형 스크립트 생성 → 실행" 파이프라인뿐이다.

### 2-1. 왜 재사용이 "선택"이 아니라 "필수"인가

단순히 게을러서가 아니라 **계약(Contract) 호환성** 때문이다.

1. **다운스트림이 이미 정해진 입력 형식을 기다리고 있다.** `services/renderer.py`의 `render_portfolio(schema, telemetry: dict)`와 `core/schema.py`의 `PortfolioSchema`는 `tracker.save_run()`이 만드는 `raw_telemetry.json`의 구조(`overview`/`dataset`/`benchmarks`/`last_error`/`error_history`/`git_diff`)를 그대로 소비하도록 이미 짜여 있다. venture.md에서 "**MVP 완료 ✅**"로 표시된 기능이 바로 이 자동 포트폴리오 생성이다. 새 트래커를 만들면 JSON 모양이 달라지고, 이미 완성된 렌더러가 그 데이터를 못 읽는다 — 파이프라인이 중간에서 끊긴다.
2. **UI 스펙이 이미 이 코드를 가리키고 있다.** `docs/specs/02_SETUP_WORKSPACE_SPEC.md`의 "2줄 코드 파이프라인 연동" (`plaiground.init(auto_capture=True)`)은 개념적으로 `install_error_interceptor()` + `DiffStackTracker`와 정확히 같은 기능이다. 즉 이건 아직 안 만든 기능이 아니라 **이미 구현된 기능에 UI 문서가 붙어 있는 상태**다. 여기서 새로 만들면 같은 기능의 구현체가 두 개가 되고, 나중에 UI를 연결할 때 "어느 쪽에 연결해야 하나"라는 불필요한 분기가 생긴다.
3. **Deep Module 원칙(Deletion Test)으로 봐도 그렇다.** `telemetry/interceptor.py`를 지우고 ai_set_demo 안에 다시 만든다고 하면, `sys.excepthook` 체이닝·에러 히스토리 누적·JSON 스키마 같은 복잡도가 토씨 하나 안 틀리고 다시 나타난다. 이건 "지워도 사라지는 pass-through"가 아니라 "지우면 반드시 다시 만들어야 하는 진짜 모듈"이라는 뜻 — 그러니 인스턴스를 하나 더 만들지 말고 가져다 쓰는 게 맞다.
4. **`train_real.py`는 설계 문서가 아니라 검증된 구현체다.** BoilerplateGenerator가 찍어낼 스크립트의 "모양"(임포트 순서, tracker 호출 시점, 에러 처리 위치)을 처음부터 설계하면 그 자체가 리스크다. 이미 한 번 실행되어 "✅ 실제 학습 텔레메트리 수집 완료"까지 확인된 코드가 있으므로, 그 모양을 템플릿 변수만 바꿔 재사용하면 설계 리스크가 0에 가까워진다.

정리하면: 재사용하지 않고 새로 만들면 코드가 두 벌 생기는 게 아니라, **자동 포트폴리오 생성이라는 이 제품의 핵심 기능이 새로 만든 쪽에서는 아예 동작하지 않는** 결과가 된다.

## 3. 모듈 설계 (Deep Module 원칙 적용)

| Module | Interface (인터페이스) | Depth (숨기는 구현) | Seam 메모 |
|---|---|---|---|
| **ModelCatalog** | `get_model(model_id) -> ModelSpec`<br>`list_models() -> list[ModelSpec]` | 모델별 base_model 이름, 짝지어진 데이터셋, 최소 VRAM, 하이퍼파라미터 기본값 | 구현은 그냥 dict/YAML 3~4개 항목. 별도 클래스 계층 불필요 (YAGNI) |
| **EnvironmentProvisioner** | `ensure_ready(spec: ModelSpec) -> EnvReport` | (어댑터 D) `plaiground-base` 컨테이너 실행, 레포 루트 bind mount, `spec.extra_requirements`를 컨테이너 안에서 pip install, code-server 포트 노출 → `EnvReport`에 접속 URL 포함 | **미래 확장 seam.** 로컬 어댑터 1개뿐이라 추상 인터페이스 만들지 않음. 시그니처(`spec -> EnvReport`)만 고정해두면 나중에 RunPod 어댑터로 교체 가능. base 이미지 자체는 로컬/클라우드 공용 재사용 가능 (`DECISION_ENV_PROVISIONING.md` 참고) |
| **BoilerplateGenerator** | `generate(spec: ModelSpec, out_dir: Path) -> Path` | 데이터셋 로드 스니펫, 텔레메트리 훅 삽입, `train_real.py` 골격 채우기 | 데이터셋 "객체"가 아니라 "로딩 코드 스니펫"을 다루도록 설계 — 실행 중인 프로세스에 데이터를 결합하지 않고, 학생이 그대로 소유/재실행 가능한 독립 `.py` 파일을 만듦 (제품 철학인 "실행 이력 기반 포트폴리오"와 정합) |
| **Orchestrator (CLI)** | `setup_and_train(model_id: str) -> None` | 위 3개 모듈 호출 순서 + 생성된 스크립트 subprocess 실행 + stdout 스트리밍 | 모듈이 아니라 조립 지점. 별도 추상화 없이 단일 함수로 충분 |

**Deletion test 검증:** 4개 모두 지우면 호출부(Orchestrator)에 그 복잡도가 그대로 다시 나타난다 → 진짜 모듈, 얇은 pass-through 아님.

## 4. 원클릭 플로우

```
사용자가 model_id 선택 (예: "bert-nsmc-sentiment")
  → ModelCatalog.get_model(model_id) → ModelSpec
  → EnvironmentProvisioner.ensure_ready(spec) → EnvReport (GPU 유무, 경고)
  → BoilerplateGenerator.generate(spec, out_dir) → generated/train_bert_nsmc.py
  → Orchestrator: subprocess로 스크립트 실행 (내부에서 interceptor + tracker 자동 동작)
  → 완료 후 .telemetry/raw_telemetry.json 생성됨 (기존 포트폴리오 파이프라인이 이어받음)
```

## 5. MVP 지원 모델 (2종으로 축소)

| model_id | task_type | base_model | 데이터셋 | 최소 VRAM | 선정 이유 |
|---|---|---|---|---|---|
| `klue-bert-finetune` | 텍스트 분류 (범용 파인튜닝) | `klue/bert-base` | NSMC 2,000개 서브셋 (`train_real.py`와 동일, 다른 분류 태스크로도 데이터셋만 바꿔 재사용 가능) | 4GB | 이미 `train_real.py`로 검증됨. NLP 파인튜닝의 표준 베이스라인이라 다른 텍스트 분류 과제에도 그대로 응용 가능 |
| `mnist-cnn-lite` | 이미지 분류 (처음부터 학습) | 작은 커스텀 CNN (2 conv layer) | `torchvision.datasets.MNIST` | GPU 불필요 (CPU로도 1~2분 내 수렴) | 파인튜닝이 아니라 "학습 자체"를 가장 가볍고 빠르게 보여주는 예시. 첫 실행 성공 경험(코랩보다 빠른 5분 룰)에 최적 |

두 모델은 "사전학습 모델 파인튜닝"과 "가벼운 모델 처음부터 학습"이라는 서로 다른 사용 시나리오를 각각 대표하므로, 2개만으로도 카탈로그 구조(ModelSpec)가 여러 태스크 유형을 다룰 수 있는지 검증하기에 충분하다.

## 6. 폴더 구조 제안 (구현 시)

```
ai_set_demo/
  PLAN.md                          ← 이 문서
  DECISION_ENV_PROVISIONING.md      ← 어댑터 결정 기록
  wizard_windows_gpu_setup.sh        ← Windows GPU 온보딩 마법사 (완료)
  .env                                ← 마법사가 기록한 감지값 (gitignore 대상)
  docker/
    plaiground-base/
      Dockerfile                     ← 공용 베이스 이미지 (완료)
      entrypoint.sh                   ← 모델별 동적 설치 + code-server 실행 (완료)
  catalog.py                        ← ModelCatalog + ModelSpec (dataclass) — 다음 작업
  provisioner.py                     ← EnvironmentProvisioner: LocalDockerAdapter — 다음 작업
  generator.py                        ← BoilerplateGenerator (+ templates/ 내 2개 .py.tmpl)
  templates/
    klue_bert_finetune.py.tmpl
    mnist_cnn_lite.py.tmpl
  setup_and_train.py                  ← CLI 진입점 (Orchestrator)
  generated/                          ← 생성된 스크립트 출력 (.gitignore 대상)
```

## 7. 구현 순서

1. ✅ `catalog.py` — ModelSpec dataclass + 2개 항목 하드코딩
2. ✅ `provisioner.py` — 컨테이너 실행 + GPU 감지 + 준비 대기 + 경고 문자열
3. ✅ `templates/*.tmpl` — `klue_bert_finetune`는 `train_real.py` 그대로 템플릿화, `mnist_cnn_lite`는 신규 작성이지만 텔레메트리 훅 호출부는 동일 패턴 복붙
4. ✅ `generator.py` — 템플릿에 ModelSpec 값 채워 `generated/`에 저장 (stdlib `string.Template`)
5. ✅ `setup_and_train.py` — 위 3개 연결 + `docker exec`으로 컨테이너 안에서 실행 + 로그 스트리밍
6. ✅ 2개 모델 각각 로컬 1회 실행 검증 (통합 테스트) — `mnist-cnn-lite` acc 0.125→0.984, `klue-bert-finetune` f1 0.8587, 둘 다 GPU 사용

**MVP 완료.** 실행: `python -m ai_set_demo.setup_and_train <model_id>` (`--list`로 목록).

통합 테스트에서 잡은 것 (설계 문서에 없던 실제 문제 2개):
- 베이스 이미지에 `accelerate` 누락 → transformers `Trainer`가 임포트 에러. `klue-bert-finetune`의 `extra_requirements`로 해결 (이미지 재빌드 불필요).
- `docker run -d` 직후 바로 `docker exec`하면 entrypoint의 모델별 pip install이 끝나기 전에 학습이 시작되는 경쟁 상태 → entrypoint가 `/tmp/.plaiground_ready` 마커를 만들고 `ensure_ready()`가 그걸 기다리도록 수정.

**총 예상: 3~4시간.** RunPod 연동, 웹 UI, 모델 카탈로그 확장은 이번 범위에 없음 — 필요해지면 그때 어댑터를 추가한다.

## 8. 테스트 전략

- `catalog.py`: `get_model("존재안함")` → 명확한 에러. 순수 함수라 단위 테스트 자연스러움.
- `provisioner.py`: GPU 없는 환경에서 `ensure_ready`가 예외 대신 경고를 담은 `EnvReport`를 반환하는지 확인 (크래시 금지).
- `generator.py`: 실제 학습 돌리지 않고 생성된 스크립트 문자열에 기대 스니펫(모델명, 데이터셋 로더, telemetry import)이 포함되는지만 검증 — 무거운 의존성 없이 빠르게 테스트 가능한 이유가 "코드 생성"과 "실행"을 분리했기 때문 (3번 모듈 설계 참고).
