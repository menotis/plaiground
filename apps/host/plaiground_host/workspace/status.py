"""status.py — 환경 감지 결과 (Docker 데몬, 이미지, GPU 마법사 기록)."""

import subprocess
from pathlib import Path

from .provisioner import _IMAGE, _image_exists

_ENV_FILE = Path(__file__).resolve().parent / ".env"  # wizard_windows_gpu_setup.sh가 기록


def _read_env() -> dict[str, str]:
    if not _ENV_FILE.exists():
        return {}
    values = {}
    for line in _ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            values[key.strip()] = value.strip().strip('"')
    return values


def docker_running() -> bool:
    return subprocess.run(["docker", "info"], capture_output=True, text=True).returncode == 0


def status() -> dict:
    env = _read_env()
    docker_ok = docker_running()
    return {
        "docker_running": docker_ok,
        "image": _IMAGE,
        "image_exists": docker_ok and _image_exists(),
        "gpu_name": env.get("DETECTED_GPU_NAME", ""),
        "driver_version": env.get("DETECTED_DRIVER_VERSION", ""),
        "wsl2_ready": env.get("WSL2_READY", "") == "true",
    }
