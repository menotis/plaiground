"""
tracker.py — DiffStackTracker: 데이터 통계 & 메트릭 로거.

log_dataset(), log_benchmarks(), save_run()으로 구성된 단일 책임 클래스.
수집된 데이터 + 에러 로그 + Git Diff를 병합하여 .telemetry/raw_telemetry.json에 덤프.
"""

import difflib
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from .git_tracker import get_git_diff
from .paths import TELEMETRY_DIR as _TELEMETRY_DIR

_ERROR_FILE = _TELEMETRY_DIR / "last_error.json"
_HISTORY_FILE = _TELEMETRY_DIR / "error_history.json"
_RAW_FILE = _TELEMETRY_DIR / "raw_telemetry.json"
_RUNS_DIR = _TELEMETRY_DIR / "runs"  # 실행별 텔레메트리 — 모델마다 포트폴리오를 따로 보관하기 위해
_SNAPSHOT_DIR = _TELEMETRY_DIR / "snapshots"  # interceptor가 남긴 실패 시점 스크립트


def _script_name() -> str:
    return Path(sys.argv[0]).name if sys.argv and sys.argv[0] else ""


def _script_fix_diff() -> str:
    """실패 시점 스냅샷과 지금(성공 시점)의 스크립트를 직접 비교한 unified diff.

    스냅샷이 없으면(실패 없이 성공) 빈 문자열. 사용한 스냅샷은 지워서
    다음 실행의 diff에 이전 수정이 섞이지 않게 한다.
    """
    name = _script_name()
    snap = _SNAPSHOT_DIR / name
    src = Path(sys.argv[0]) if sys.argv and sys.argv[0] else None
    if not name or not snap.is_file() or src is None or not src.is_file():
        return ""
    before = snap.read_text(encoding="utf-8").splitlines(keepends=True)
    after = src.read_text(encoding="utf-8").splitlines(keepends=True)
    diff = "".join(difflib.unified_diff(
        before, after, fromfile=f"a/{name} (실패 시점)", tofile=f"b/{name} (수정 후 성공)", n=2,
    ))
    try:
        snap.unlink()
    except OSError:
        pass
    return diff


def _run_stem() -> str:
    """train_mnist_cnn_lite.py → mnist_cnn_lite, run_demo.py → run_demo."""
    stem = Path(_script_name()).stem or "run"
    return stem[6:] if stem.startswith("train_") else stem


class DiffStackTracker:
    """런타임 데이터(데이터셋 통계, 벤치마크, 에러) 수집 및 덤프."""

    def __init__(self, project_name: str = "", task_type: str = "", **kwargs: Any) -> None:
        self._overview: dict[str, Any] = {
            "project_name": project_name,
            "task_type": task_type,
            **kwargs,
        }
        self._dataset: dict[str, Any] = {}
        self._benchmarks: dict[str, Any] = {}
        self.run_id: str = f"{_run_stem()}_{datetime.now().strftime('%Y%m%d-%H%M%S')}"

    def log_dataset(
        self,
        raw_len: int,
        processed_len: int,
        notes: str | list[str] = "",
        avg_len_before: float = 0.0,
        avg_len_after: float = 0.0,
    ) -> None:
        """
        데이터 전처리 전후 통계를 기록.

        Args:
            raw_len: 전처리 전 샘플 수.
            processed_len: 전처리 후 샘플 수.
            notes: 전처리 기법 설명 (문자열 또는 리스트).
            avg_len_before: 전처리 전 평균 시퀀스 길이.
            avg_len_after: 전처리 후 평균 시퀀스 길이.
        """
        removed = raw_len - processed_len
        reduction_rate = round(removed / raw_len * 100, 2) if raw_len else 0.0
        self._dataset = {
            "raw_len": raw_len,
            "processed_len": processed_len,
            "removed_samples": removed,
            "reduction_rate_pct": reduction_rate,
            "avg_len_before": avg_len_before,
            "avg_len_after": avg_len_after,
            "notes": notes,
        }

    def log_benchmarks(
        self,
        baseline_dict: dict[str, Any] | None = None,
        final_dict: dict[str, Any] | None = None,
        params_dict: dict[str, Any] | None = None,
        baseline: dict[str, Any] | None = None,
        final: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
    ) -> None:
        """
        파인튜닝 전후 성능 메트릭과 하이퍼파라미터를 기록.
        인자 이름으로 baseline/final/params 또는 baseline_dict/final_dict/params_dict 지원.
        """
        base = baseline or baseline_dict or {}
        fin = final or final_dict or {}
        prm = params or params_dict or {}

        self._benchmarks = {
            "baseline": base,
            "final": fin,
            "hyperparameters": prm,
        }

    def save_run(self) -> Path:
        """
        수집된 데이터 + 누적 에러 로그 + Git Diff를 raw_telemetry.json에 저장.

        Returns:
            Path: 저장된 파일 경로.
        """
        _TELEMETRY_DIR.mkdir(parents=True, exist_ok=True)

        # 1. last_error.json 로드 (없으면 빈 dict)
        error_data: dict[str, Any] = {}
        if _ERROR_FILE.exists():
            try:
                error_data = json.loads(_ERROR_FILE.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                pass

        # 2. error_history.json 로드 후 이 스크립트에서 난 에러만 귀속
        #    (script 태그가 없는 구버전 항목은 traceback에 파일명이 있으면 인정)
        error_history: list[dict[str, Any]] = []
        if _HISTORY_FILE.exists():
            try:
                loaded_hist = json.loads(_HISTORY_FILE.read_text(encoding="utf-8"))
                if isinstance(loaded_hist, list):
                    error_history = loaded_hist
            except json.JSONDecodeError:
                pass
        me = _script_name()
        if me:
            error_history = [
                e for e in error_history
                if e.get("script") == me or (not e.get("script") and me in str(e.get("full_traceback", "")))
            ]
            if error_data and not (error_data.get("script") == me or me in str(error_data.get("full_traceback", ""))):
                error_data = error_history[-1] if error_history else {}

        # 3. 실제 수정 이력 — 실패 스냅샷 vs 성공 시점 스크립트. 없으면 git diff로 폴백.
        script_diff = _script_fix_diff()

        payload = {
            "saved_at": datetime.utcnow().isoformat(),
            "run_id": self.run_id,
            "script": me,
            "overview": self._overview,
            "dataset": self._dataset,
            "benchmarks": self._benchmarks,
            "last_error": error_data,
            "error_history": error_history,
            "script_diff": script_diff,
            "git_diff": script_diff or get_git_diff(),  # LLM 서사가 읽는 키 — 실제 수정본 우선
        }

        text = json.dumps(payload, ensure_ascii=False, indent=2)
        _RUNS_DIR.mkdir(parents=True, exist_ok=True)
        (_RUNS_DIR / f"{self.run_id}.json").write_text(text, encoding="utf-8")  # 실행별 보관본
        _RAW_FILE.write_text(text, encoding="utf-8")  # 최신본 (하위 호환)
        return _RAW_FILE
