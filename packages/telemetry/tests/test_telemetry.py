"""SDK 점검. Docker·GPU 없이 돈다. recorder는 torch가 필요하다."""

import importlib
import json
import subprocess
import sys

import pytest

torch = pytest.importorskip("torch")


def test_recorder_roundtrip():
    from plaiground_telemetry.recorder import demo

    demo()  # 프레임 기록·복원·format_version을 assert로 검증


def test_interceptor_and_tracker_write_to_env_dir(tmp_path):
    """PLAIGROUND_TELEMETRY_DIR 만 보고 기록한다 — 컨테이너/호스트 경로 계약의 핵심."""
    env = {**dict(subprocess.os.environ), "PLAIGROUND_TELEMETRY_DIR": str(tmp_path), "PYTHONIOENCODING": "utf-8"}
    script = tmp_path / "train_x.py"
    script.write_text(
        "from plaiground_telemetry.interceptor import install_error_interceptor\n"
        "install_error_interceptor()\nraise ValueError('boom')\n", encoding="utf-8")
    subprocess.run([sys.executable, str(script)], env=env, capture_output=True)
    err = json.loads((tmp_path / "last_error.json").read_text(encoding="utf-8"))
    assert err["error_type"] == "ValueError" and err["script"] == "train_x.py"
    assert (tmp_path / "snapshots" / "train_x.py").exists(), "첫 실패 스냅샷"

    # 고친 뒤 성공 실행 → tracker가 스냅샷과 diff 를 남긴다
    script.write_text(
        "from plaiground_telemetry.interceptor import install_error_interceptor\n"
        "from plaiground_telemetry.tracker import DiffStackTracker\n"
        "install_error_interceptor()\n"
        "t = DiffStackTracker(project_name='p', task_type='t')\n"
        "t.log_dataset(10, 9)\nt.log_benchmarks(baseline={'acc': 0.1}, final={'acc': 0.9}, params={'lr': 1})\n"
        "print(t.save_run())\n", encoding="utf-8")
    r = subprocess.run([sys.executable, str(script)], env=env, capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    runs = list((tmp_path / "runs").glob("x_*.json"))
    assert len(runs) == 1
    d = json.loads(runs[0].read_text(encoding="utf-8"))
    assert d["benchmarks"]["final"] == {"acc": 0.9}
    assert d["error_history"][0]["error_type"] == "ValueError"
    assert "-raise ValueError" in d["script_diff"] and "+t = DiffStackTracker" in d["script_diff"]
    assert not (tmp_path / "snapshots" / "train_x.py").exists(), "성공 후 스냅샷 삭제"


def test_paths_default_and_env(monkeypatch):
    monkeypatch.setenv("PLAIGROUND_TELEMETRY_DIR", "/tmp/xyz")
    import plaiground_telemetry.paths as p

    importlib.reload(p)
    assert str(p.TELEMETRY_DIR).replace("\\", "/").endswith("/tmp/xyz")
    monkeypatch.delenv("PLAIGROUND_TELEMETRY_DIR")
    importlib.reload(p)
    assert p.TELEMETRY_DIR == p.REPO_ROOT / "var" / "workspaces" / "local" / ".telemetry"
