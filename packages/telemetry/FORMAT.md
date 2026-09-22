# 텔레메트리 파일 형식

기록하는 쪽(이 패키지)이 형식의 주인이다. 읽는 쪽(`apps/host/plaiground_host/viz`, `portfolio/api.py`, 프론트 `apps/web/src/netLayout.js`)은 여기에 맞춘다. 형식을 바꾸면 이 문서와 `format_version`을 함께 올린다.

모든 파일은 `PLAIGROUND_TELEMETRY_DIR` 아래에 쓴다. 컨테이너 안에서는 `/workspace/.telemetry`, 호스트에서는 `var/workspaces/<user>/.telemetry`.

```
<TELEMETRY_DIR>/
  last_error.json            interceptor — 마지막 예외 1건
  error_history.json         interceptor — 예외 누적 배열 (실행마다 append)
  snapshots/<script>.py      interceptor — 첫 실패 시점의 스크립트 원본 (성공 시 tracker가 diff 후 삭제)
  raw_telemetry.json         tracker    — 최신 실행 요약 (하위 호환용 복사본)
  runs/<run_id>.json         tracker    — 실행별 요약
  viz/<run_id>/schema.json   recorder   — 모델 껍데기
  viz/<run_id>/frames.bin    recorder   — 스텝별 가중치 프레임 (append)
  viz/<run_id>/frames.jsonl  recorder   — 스텝별 loss·grad (한 줄/프레임, append)
```

`run_id` = `<스크립트 stem에서 train_ 제거>_<YYYYmmdd-HHMMSS>`. 예: `mnist_cnn_lite_20260921-061402`. 경로 조각으로 쓰이므로 영숫자, `.`, `_`, `-`만 나온다.

## interceptor — `last_error.json`, `error_history.json[]`

| 키 | 타입 | 설명 |
|---|---|---|
| `timestamp` | str (ISO) | 발생 시각 |
| `script` | str | `sys.argv[0]`의 파일 이름 |
| `error_type` | str | 예외 클래스 이름 |
| `error_message` | str | `str(exc)` |
| `last_frame_file`, `last_frame_line` | str, int | 사용자 코드의 마지막 프레임 |
| `full_traceback` | str | 전체 트레이스백 |

## tracker — `runs/<run_id>.json`

| 키 | 타입 | 설명 |
|---|---|---|
| `saved_at` | str (ISO, UTC) | 저장 시각 |
| `run_id`, `script` | str | 위 규칙 |
| `overview` | `{project_name, task_type, ...}` | 생성자 인자 |
| `dataset` | `{raw_len, processed_len, removed_samples, reduction_rate_pct, avg_len_before, avg_len_after, notes}` | `log_dataset()` |
| `benchmarks` | `{baseline, final, hyperparameters}` | `log_benchmarks()`. 값은 자유 형식 dict |
| `last_error` | object 또는 `{}` | 이 스크립트의 마지막 예외 |
| `error_history` | array | 이 스크립트의 예외만 필터 |
| `script_diff` | str | 실패 스냅샷 → 성공본 unified diff. 실패가 없었으면 빈 문자열 |
| `git_diff` | str | `script_diff`가 비었을 때 `git diff HEAD` 결과 |

## recorder — `viz/<run_id>/`

### `schema.json` (format_version 1)

| 키 | 타입 | 설명 |
|---|---|---|
| `format_version` | int | 이 문서의 버전. 현재 1 |
| `model_class` | str | `type(model).__name__` |
| `total_params`, `trainable_params` | int | 전체 / `requires_grad` 파라미터 수 |
| `frame_dtype` | `"float16"` | 프레임 원소 타입 |
| `frame_numel`, `frame_bytes` | int | 프레임 하나의 원소 수와 바이트 (= numel × 2) |
| `record_every` | int | 몇 스텝마다 한 프레임인지 |
| `hparams` | object | 템플릿이 넘긴 설명용 값 (`batch_size`, `learning_rate`, `optimizer`, `loss`, `steps_per_epoch` 등) |
| `layers[]` | `{name, type, params[], in_shape, out_shape}` | leaf 모듈 순서. `params[]`는 `{name, shape, numel, trainable, offset}` — `offset`은 프레임 내 시작 위치(원소 단위), 학습 불가 파라미터는 `null` |
| `flow[]` | str[] | 첫 forward에서 관찰한 leaf 모듈 실행 순서 (모듈 이름) |

### `frames.bin`

고정 크기 프레임을 이어 붙인 바이너리. 프레임 k의 바이트 범위는 `[k·frame_bytes, (k+1)·frame_bytes)`. 안에서 파라미터 `p`의 값은 `[offset, offset + numel)` 구간을 `shape`로 reshape한 것. `requires_grad` 파라미터만 포함하며, 순서는 `model.named_parameters()` 순서. 프레임 수 = 파일 크기 ÷ `frame_bytes`.

호스트 API(`/api/viz/<run>/frame?index=k`)는 브라우저가 `Float32Array`로 읽을 수 있게 float32로 변환해 보낸다.

### `frames.jsonl` (한 줄 = 한 프레임, `frames.bin`과 같은 순서)

| 키 | 타입 | 설명 |
|---|---|---|
| `step` | int | `record()` 호출 누적 횟수 (1부터) |
| `epoch` | float | 템플릿이 넘긴 값. `epoch + (i+1)/steps_per_epoch` 형태 |
| `loss` | float | 그 스텝의 loss |
| `layer_grad` | `{layer_name: float}` | 2차원 이상 파라미터의 grad L2 norm (레이어 단위) |
| `node_grad` | `{layer_name: float[]}` | 출력 뉴런/채널별 grad L2 norm |

## 알려진 한계 (format_version 1)

- 파라미터 전체를 매 프레임 저장하므로 대형 모델(수억 파라미터)에는 맞지 않는다. 서브샘플링 방식으로 바꿀 때 `format_version` 2로 올린다.
- `frames.jsonl`은 서명되지 않는다. 진위 증명은 호스트 서명(Stage D)에서 다룬다.
