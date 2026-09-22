"""viz — TrainRecorder가 남긴 학습 시각화 기록(schema.json / frames.bin / frames.jsonl) 읽기.

형식의 주인은 기록하는 쪽(packages/telemetry, FORMAT.md)이다. 여기서는 읽기만 한다.
"""

from .store import frame, run_dir, runs, rows, schema

__all__ = ["frame", "run_dir", "runs", "rows", "schema"]
