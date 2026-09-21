# plAI-ground — 구현 현황 (AI 엔지니어 리뷰)

작성 기준: 2026-09-19 · 최신 커밋 `6340c88` (View AI 실데이터 시각화)
이전 상태 문서: `../MVP_STATUS.md` (2026-09-08, `485ecbf` 기준 — **View AI 항목은 이 문서 작성 시점 기준 stale**)

---

## 0. 한 줄 요약

모델 선택 → Docker 환경 세팅 → Web IDE에서 실제 학습 실행 → 텔레메트리 기반 포트폴리오 자동 생성까지의 파이프라인은 끝까지 실동작한다. 여기에 더해 **View AI가 mnist 모델 한정으로 시뮬레이션에서 실데이터 재생으로 전환**되었다 — `TrainRecorder`가 학습 중 스텝별 가중치 전체를 디스크에 기록하고, 프론트엔드가 그 기록을 슬라이더로 스크러빙하며 노드/엣지를 그린다. 단, **klue-bert / llama / gemma 세 모델은 아직 이 기록기에 연결되지 않았고**, 현재 방식(스텝마다 학습 가능 파라미터 전체를 fp16으로 덤프)은 파라미터 수가 큰 모델에는 그대로 확장되지 않는다 — 아래 4장에서 구체적으로 다룬다.

---

## 1. 아키텍처

```
[web_combine_demo]  React SPA + 통합 API 서버 :8770
        │
        ├── 상속 ──> [ai_set_demo]      환경 프로비저닝 · 코드 생성 · code-server :8080
        │                │                   └── 학습 스크립트 실행 → .telemetry/{runs,viz}/
        ├── 호출 ──> [portfolio_demo]   텔레메트리 수집(tracker) + 스텝 기록(recorder) → LLM 구조화 → HTML/JSON
        └── 호출 ──> [community_demo]   글 40건 + 상호작용 상태 + 실습 코드 스테이징
```

레이어 3개가 각각 독립 실행 가능하고, `web_combine_demo/api_server.py`가 `ai_set_demo.api_server._Handler`를 **상속**해서 `/api/status`, `/api/models`, `/api/setup`, `/api/viz/*`를 그대로 물려받는다. `/api/viz/*`는 `ai_set_demo/api_server.py`에 구현되어 있고, `web_combine_demo/api_server.py`의 `do_GET`은 이 경로를 명시적으로 처리하지 않으므로 `route.path.startswith("/api/")` 분기(154-179행)를 타고 부모 클래스로 그대로 위임된다 — 확인 완료, 별도 라우트 추가가 필요 없다.

---

## 2. 레이어별 구현 상태

| 레이어 | 상태 | 비고 |
|---|---|---|
| `ai_set_demo` (환경 세팅) | ✅ 실동작 | Docker 컨테이너 기동, 템플릿 렌더링, code-server 연결까지 실제 파이프라인 |
| `portfolio_demo` (포트폴리오) | ✅ 실동작 | 텔레메트리 → Gemini 구조화 → SHA-256 서명 HTML/MD. Gemini 실패 시 `allow_mock=False`로 목업 서사 차단 |
| `community_demo` | ✅ 실동작 (콘텐츠는 고정 시드) | 게시글 40건은 정적 데이터, 상호작용/댓글은 실제 상태 변경 |
| Faculty LMS | ⚠️ 샘플 데이터 | 학생 60명은 고정 시드 PRNG — 화면에 명시됨 |
| **View AI (mnist)** | ✅ **실데이터** | 이번 커밋에서 시뮬레이션 제거, 아래 4장 |
| **View AI (klue-bert/llama/gemma)** | ❌ **미연결** | `TrainRecorder`가 템플릿에 아직 삽입 안 됨 — 4.4절 |

---

## 3. View AI — 요구사항 대비 구현 매핑

사용자가 제시한 6개 요구사항 기준으로 점검한 결과:

| # | 요구사항 | 구현 여부 | 구현 위치 |
|---|---|---|---|
| 1 | 입력/은닉/출력층 노드·엣지 전부 표시 | ✅ | `netLayout.buildLayout()` — `schema.flow`를 따라 레이어를 컬럼으로 배치, 엣지 3만 개 이하면 전부, 넘으면 선택 노드만 |
| 2 | 초기값·가중치·손실 실시간 변화 표시 | ⚠️ **부분** | 스텝별 실측값은 맞지만 "실시간"이 아니라 **학습 종료 후 재생(replay)**. 학습 중인 run을 폴링해서 프레임 수가 늘어나는 걸 자동 갱신하는 로직은 없음 — 4.5절 |
| 3 | 노드 클릭 → 그 시점의 가중치·손실 확인 | ✅ | `ViewAI.jsx`의 `selInfo` — 가중치 평균/표준편차/최소·최대/bias/grad 크기/직전 대비 Δw, 상위 6개 연결까지 표시 |
| 4 | 값 저장, 학습 후에도 열람 가능 | ✅ | `.telemetry/viz/<run_id>/{schema.json, frames.bin, frames.jsonl}`에 영구 저장, run 선택 드롭다운으로 과거 실행도 재생 |
| 5 | 애니메이션이 아니라 "껍데기 + 값", 슬라이더+숫자 입력으로 스텝/에폭 탐색 | ✅ | `schema.json`이 곧 껍데기(레이어 구조·shape·파라미터 offset), `range` 슬라이더 + 스텝 숫자 입력이 나란히 동기화됨 (`ViewAI.jsx` 하단 재생바) |
| 6 | 어떤 오픈소스 모델이든 일반화된 알고리즘으로 노드/파라미터/손실함수/배치를 자동 파악 | ⚠️ **부분** | `TrainRecorder` 자체는 `model.named_parameters()`/`named_modules()`로 동작해 모델 종류를 가리지 않는 범용 코드다. 하지만 **템플릿에 수동으로 심어야 하며(4.4절), 대형 모델에는 현재 저장 전략이 그대로 안 맞는다(4.3절)** — "일반화된 알고리즘"이라기보단 "일반화 가능한 컴포넌트, 아직 배선 미완료"가 정확한 평가 |

---

## 4. View AI 딥다이브

### 4.1 기록기 — `portfolio_demo/telemetry/recorder.py` (`TrainRecorder`)

- **껍데기 추출**: 생성자에서 `model.named_modules()` 각각에 forward hook을 걸어 첫 forward 1회만 관찰 → 레이어 실행 순서(`flow`)와 각 레이어의 in/out shape를 알아낸다. 이 hook들은 첫 forward 직후 전부 해제된다(`_stop_trace`). **이 방식 덕분에 CNN이든 Transformer든 모델 클래스를 하드코딩하지 않고 구조를 파악한다** — 요구사항 6의 핵심 근거.
- **스키마 기록**: `_write_schema()`가 `model.named_parameters()`를 순회해 파라미터별 offset(프레임 내 위치)을 계산하고 `schema.json`에 씀. `total_params`, `trainable_params`, `frame_bytes`, `hparams`(배치·lr·에폭·옵티마이저·손실함수 — 템플릿이 직접 전달), `layers`, `flow`를 포함.
- **스텝 기록**: `record(loss, epoch)`가 `optimizer.step()` 직후 호출됨. `every`(현재 mnist는 5)마다 한 번씩:
  - 학습 가능한 파라미터 전체를 `torch.cat(...).to(float16).cpu()`로 이어붙여 `frames.bin`에 **append**(누적 파일, 프레임 k의 위치는 `k * frame_bytes`로 고정 계산 가능)
  - 2차원 이상 파라미터의 grad를 출력 뉴런/채널 단위로 L2 norm 계산해 `frames.jsonl`에 한 줄(`step, epoch, loss, layer_grad, node_grad`) append
- **self-check**: `demo()` 함수가 `nn.Sequential(Linear→ReLU→Linear)`로 3스텝 학습 후 `frame_numel`, `flow`, 레이어 타입, 프레임 간 가중치 변화, 프레임 복원(`read_frame`)까지 assert로 검증 — 모듈 단독 실행 시 자체 검증됨.

### 4.2 백엔드 — `ai_set_demo/api_server.py`

- `GET /api/viz/runs` — `.telemetry/viz/` 하위 디렉터리 중 `schema.json`이 있는 것만 최신순으로 목록화
- `GET /api/viz/<run>/schema` — 스키마 + `frame_count`(파일 크기 ÷ `frame_bytes`로 즉시 계산, 별도 카운터 불필요)
- `GET /api/viz/<run>/rows` — `frames.jsonl` 전체를 JSON 배열로
- `GET /api/viz/<run>/frame?index=k` — fp16 프레임을 읽어 **서버에서 fp32로 변환**해 바이너리로 전송(`Float32Array`로 브라우저가 바로 읽도록). fp16은 JS TypedArray 표준에 없어서 이 변환이 필수.
- **경로 검증**: `_viz_run_dir()`이 `run_id != Path(run_id).name`이면 `None` 반환 — `..`/경로 구분자 주입을 원천 차단. (`web_combine_demo/api_server.py`의 `/api/portfolio/*`는 이 방어가 없다는 점과 대비됨 — 6장 참고)

### 4.3 대형 모델 확장성 — 가장 중요한 기술 부채

현재 전략은 **매 기록 시점마다 학습 가능한 파라미터 전체를 fp16으로 덤프**한다. mnist-cnn-lite처럼 파라미터가 수만~수십만 개인 모델에는 문제없지만:

| 모델 | trainable params(대략) | 프레임 1개 크기(fp16) | 200스텝·every=5 기준 총 용량 |
|---|---|---|---|
| mnist-cnn-lite | ~수만 개 | 수백 KB 이하 | 수십 MB |
| klue-bert (풀 파인튜닝) | ~1.1억 개 | **~220MB** | **~8.8GB** |
| llama32-1b / gemma4-e2b (LoRA r=8) | LoRA 어댑터만 수백만 개 수준 | 수 MB | 수백 MB~1GB대 — **감당 가능** |

**결론**: klue-bert처럼 전체 가중치를 학습하는 모델은 지금 방식 그대로 연결하면 디스크·네트워크 부담이 비현실적이다. llama/gemma는 LoRA로 trainable params가 이미 작아져 있어 오히려 이 방식이 잘 맞는다 — **LoRA 모델부터 연결하는 게 다음 단계로 합리적**이다. klue-bert(풀 파인튜닝)까지 지원하려면 전체 덤프 대신 (a) 레이어별 요약 통계(norm, 상위 N개 가중치)만 기록하거나 (b) 고정된 서브샘플 파라미터 집합만 기록하는 방식으로 바꿔야 한다.

### 4.4 템플릿 연결 상태

이번 커밋은 `ai_set_demo/templates/mnist_cnn_lite.py.tmpl`에만 `TrainRecorder`를 심었다(수동 루프라 `optimizer.step()` 직후 `recorder.record()` 한 줄 추가로 끝남). 나머지 세 템플릿은 HuggingFace `Trainer`를 쓰므로 학생이 작성한 코드가 아니라 **`Trainer` 내부 루프**에서 `optimizer.step()`이 일어난다. 이 세 템플릿을 연결하려면 `TrainerCallback`을 만들어 `Trainer(callbacks=[...])`로 주입해야 한다 — 아직 `recorder.py`에 이 브리지가 없다. (`on_log`에서 `state.log_history[-1]["loss"]`를 읽거나, 설치된 `transformers` 버전이 지원하면 `on_pre_optimizer_step`에서 그래드가 아직 살아있을 때 기록하는 두 방법이 있음 — 버전 확인 필요.)

klue-bert/llama/gemma로 세팅한 사용자가 View AI에 들어가면 현재는 그 모델의 run이 목록에 없어 "NO RUNS" 배지가 뜬다(다른 모델의 과거 run이 있으면 그것만 보임).

### 4.5 "실시간"에 대한 정직한 평가

요구사항 2번은 "학습 중 실시간으로 값이 바뀌는 걸 본다"를 포함하지만, 현재 프론트엔드(`ViewAI.jsx`)는 `runId`가 바뀔 때 딱 한 번 `schema`/`rows`를 fetch하고, 이후에는 로컬 슬라이더 조작으로만 프레임을 다시 받아온다. 학습이 진행 중인 run을 열어도 `frame_count`가 자동으로 늘어나지 않는다 — 사실상 **"학습 완료 후 재생"** 기능이고, 이름 그대로의 "라이브"는 아니다. 다만 기반은 이미 있다: `frames.jsonl`/`frames.bin`은 학습 도중에도 append되므로, 프론트에 3~5초 간격 폴링(`_stream_setup`/`_stream_portfolio_run`이 쓰는 SSE 대신, 여기는 새 프레임이 몇 개 생겼는지만 확인하면 되므로 폴링이 더 단순하고 적절함)을 추가하면 라이브 요구사항을 채울 수 있다.

### 4.6 배지/문서 정합성

`ViewAI.jsx`는 이제 `REAL DATA`/`NO RUNS` 배지를 쓰는데, 아래 문서들은 여전히 예전 `SIMULATION` 배지를 언급한다 — 문서 부채:
- `../MVP_STATUS.md` 170·240·253행
- `../PRODUCT.md` 36행
- `README.md` (본 폴더) 15행
- `DESIGN.md` (본 폴더) 294행의 "현재 인스턴스: View AI=SIMULATION" 예시

---

## 5. 프론트엔드 구현 메모

- `netLayout.js` — 순수 함수 모듈(리액트 의존 없음). `schema` → 컬럼 레이아웃(`buildLayout`), 프레임 → 엣지 가중치(`edgeWeights`)/그리드 서브샘플(`edgeMask`, 입력 64개 초과 레이어는 노드당 상위 8%만), 노드 정규화 값(`nodeValues`, metric = grad 크기 또는 직전 프레임 대비 Δw). 2D/3D 뷰가 이 레이아웃을 공유해서 좌표 계산 중복이 없다.
- `Network2D` — Canvas 2D, `devicePixelRatio` 대응, 클릭 히트테스트로 노드 선택.
- `Network3D.jsx` — `three.js`를 `lazy()`로 지연 로드(약 600KB, 3D 모드를 켤 때만 다운로드). WASD/QE 키보드 비행, 드래그 회전 지원.
- 이미지 입력(conv) 레이어는 "커널이 이미지 전체를 훑는다"는 개념을 시각적으로 보여주기 위해 별도 렌더링 경로(쐐기 모양 엣지, 커널 훑기 애니메이션 버튼)를 갖는다 — CNN 한정 특수 처리이며, 이 부분은 모델 유형에 따라 분기하는 코드라 완전히 일반화되어 있진 않다.
- `package.json`에 `three` 추가(`^0.186.0`), 그 외 신규 의존성 없음.

---

## 6. 알려진 한계 (우선순위순)

1. **klue-bert/llama/gemma 미연결** — HF `Trainer` 콜백 브리지 부재. LoRA 두 모델(llama/gemma)부터 연결하는 게 다음 스텝으로 합리적(4.3절 근거).
2. **대형 모델 저장 전략 부재** — 풀 파인튜닝 모델(klue-bert)은 현재 방식으로 디스크 용량이 비현실적. 요약 통계/서브샘플링 방식 설계 필요.
3. **라이브 폴링 없음** — 학습 중 자동 갱신이 안 되어 "실시간"이라는 이름에 비해 실제로는 재생 기능임(4.5절).
4. **문서 부채** — `SIMULATION` 배지를 언급하는 4개 문서가 최신 상태를 반영하지 못함(4.6절).
5. **`/api/portfolio/*`의 `run` 파라미터 경로 검증 없음** — `/api/viz/*`는 `_viz_run_dir()`로 방어하지만 포트폴리오 쪽 `_telemetry_path()`는 그대로 f-string에 꽂는다. 루프백 전용 바인딩으로 완화되고 있으나 같은 패턴을 포트폴리오 쪽에도 적용하는 게 일관적이다.

---

## 7. 핵심 파일 인벤토리

| 파일 | 역할 |
|---|---|
| `portfolio_demo/telemetry/recorder.py` | `TrainRecorder` — 스텝별 가중치·grad 기록기 (신규) |
| `portfolio_demo/telemetry/tracker.py` | `DiffStackTracker` — 실행 단위 요약(데이터셋·벤치마크·에러) |
| `ai_set_demo/templates/mnist_cnn_lite.py.tmpl` | `TrainRecorder` 연결된 유일한 템플릿 |
| `ai_set_demo/templates/{klue_bert_finetune,llama32_1b_sft,gemma4_e2b_sft}.py.tmpl` | 미연결 — HF `Trainer` 콜백 브리지 필요 |
| `ai_set_demo/api_server.py` | `/api/viz/*` 라우트 (스키마/프레임/rows), `/api/status`, `/api/models`, `/api/setup` |
| `web_combine_demo/api_server.py` | 위를 상속 + `/api/portfolio/*`, `/api/community/*`, `/api/ide/status` |
| `web_combine_demo/app/src/ViewAI.jsx` | View AI 화면 — run 선택, 재생바, 노드 상세 패널, 손실 곡선 |
| `web_combine_demo/app/src/netLayout.js` | 스키마 → 레이아웃/엣지/노드값 순수 함수 (2D/3D 공유) |
| `web_combine_demo/app/src/Network3D.jsx` | three.js 기반 3D 노드 뷰어 (지연 로드) |

---

## 8. 다음 단계 제안

1. `recorder.py`에 `TrainerCallback` 서브클래스 추가 → llama/gemma 템플릿에 연결(LoRA라 프레임 크기 감당 가능)
2. klue-bert용 저장 전략 설계 — 레이어별 요약 통계 또는 고정 서브샘플 파라미터 방식
3. `/api/viz/<run>/rows`를 폴링하는 "라이브 모드" 프론트 로직 추가(학습 중인 run에서 새 프레임 수 자동 반영)
4. `MVP_STATUS.md`/`PRODUCT.md`/`README.md`/`DESIGN.md`의 `SIMULATION` 배지 언급을 현재 상태로 갱신
5. `/api/portfolio/*`의 `run` 파라미터에 `_viz_run_dir()`과 동일한 경로 검증 적용
