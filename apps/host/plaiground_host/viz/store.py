import json
from pathlib import Path

from ..paths import DEFAULT_USER, safe_name, telemetry_dir


def run_dir(run_id: str, user: str = DEFAULT_USER) -> Path | None:
    """run_id를 사용자의 viz 폴더 안으로만 해석한다 — 경로 탈출('..', 구분자)은 None."""
    if safe_name(run_id) is None:
        return None
    d = telemetry_dir(user) / "viz" / run_id
    return d if (d / "schema.json").is_file() else None


def schema(d: Path) -> dict:
    s = json.loads((d / "schema.json").read_text(encoding="utf-8"))
    frames = d / "frames.bin"
    s["frame_count"] = frames.stat().st_size // s["frame_bytes"] if frames.exists() else 0
    s["run_id"] = d.name
    return s


def runs(user: str = DEFAULT_USER) -> list[dict]:
    root = telemetry_dir(user) / "viz"
    if not root.is_dir():
        return []
    out = []
    for d in sorted(root.iterdir(), reverse=True):
        if (d / "schema.json").is_file():
            s = schema(d)
            out.append({k: s.get(k) for k in ("run_id", "model_class", "total_params", "frame_count", "record_every", "format_version")})
    return out


def rows(d: Path) -> list[dict]:
    lines = (d / "frames.jsonl").read_text(encoding="utf-8").splitlines()
    return [json.loads(l) for l in lines if l.strip()]


def frame(d: Path, index: int) -> bytes | None:
    """k번째 fp16 프레임을 float32 바이트로. 브라우저의 Float32Array가 바로 읽도록 서버가 변환한다."""
    import numpy as np

    s = schema(d)
    if not 0 <= index < s["frame_count"]:
        return None
    with open(d / "frames.bin", "rb") as f:
        f.seek(index * s["frame_bytes"])
        buf = f.read(s["frame_bytes"])
    return np.frombuffer(buf, dtype=np.float16).astype(np.float32).tobytes()
