"""
provisioner.py — EnvironmentProvisioner: LocalDockerAdapter (어댑터 D).

DECISION_ENV_PROVISIONING.md 최종 결정 반영: `plaiground-base` 컨테이너를 띄우고
사용자 워크스페이스 폴더만 /workspace로 bind mount, spec.extra_requirements를 컨테이너 안에서
동적 설치, code-server 포트를 로컬 루프백에만 노출한다.

시그니처(ensure_ready(spec) -> EnvReport)만 고정 — 로컬 어댑터 1개뿐이라
추상 인터페이스는 만들지 않음 (나중에 RunPod 어댑터로 교체 가능한 seam).
"""

import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path

from ..paths import workspace_dir
from .catalog import ModelCatalog, ModelSpec

_IMAGE = "ghcr.io/menotis/plaiground-base:dev"  # 노트북은 docker pull, SDK를 고친 사람만 빌드·푸시
_CONTAINER_NAME = "plaiground-workspace"
_READY_MARKER = "/tmp/.plaiground_ready"  # entrypoint.sh가 모델별 설치를 끝낸 뒤 생성
_HOST_PORT = 8080


@dataclass
class EnvReport:
    """ensure_ready() 결과."""

    gpu_available: bool
    container_id: str
    url: str
    warnings: list[str] = field(default_factory=list)


def _run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True)


def _image_exists() -> bool:
    return _run(["docker", "image", "inspect", _IMAGE]).returncode == 0


def _docker_running() -> bool:
    return _run(["docker", "info"]).returncode == 0


def _gpu_available() -> bool:
    # entrypoint.sh는 CMD 인자를 무시하고 항상 code-server를 실행하므로,
    # --entrypoint로 직접 덮어써야 컨테이너가 즉시 종료된다.
    return _run(["docker", "run", "--rm", "--gpus", "all", "--entrypoint", "true", _IMAGE]).returncode == 0


def _wait_ready(container_id: str, timeout_s: int = 300) -> bool:
    """entrypoint가 모델별 pip install을 끝내고 준비 마커를 만들 때까지 대기."""
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        if _run(["docker", "exec", container_id, "test", "-f", _READY_MARKER]).returncode == 0:
            return True
        time.sleep(1)
    return False


def _write_requirements(spec: ModelSpec, workspace: Path) -> str | None:
    """spec.extra_requirements를 워크스페이스에 파일로 써서 컨테이너 안 경로를 반환."""
    if not spec.extra_requirements:
        return None
    req_path = workspace / f"requirements_{spec.model_id}.txt"
    req_path.write_text("\n".join(spec.extra_requirements), encoding="utf-8")
    return f"/workspace/{req_path.name}"


def ensure_ready(spec: ModelSpec, host_port: int = _HOST_PORT, workspace: Path | None = None) -> EnvReport:
    """
    모델 스펙에 맞는 컨테이너 환경을 준비하고 code-server를 띄운다.

    Args:
        spec: ModelCatalog에서 조회한 ModelSpec.
        host_port: code-server를 노출할 호스트 포트 (기본 8080, 루프백 전용).
        workspace: /workspace로 마운트할 호스트 폴더. 기본은 로컬 사용자 워크스페이스.

    Returns:
        EnvReport: GPU 가용 여부, 컨테이너 ID, 접속 URL, 경고 목록.
    """
    if not _image_exists():
        # 데몬이 꺼져 있어도 image inspect는 실패한다 — 원인을 구분하지 않으면
        # "이미지를 빌드하세요"라는 엉뚱한 안내가 나간다.
        if not _docker_running():
            raise RuntimeError("Docker 데몬에 연결할 수 없습니다. Docker Desktop을 먼저 실행하세요.")
        raise RuntimeError(
            f"'{_IMAGE}' 이미지가 없습니다. "
            f"저장소 루트에서 'docker build -f apps/host/docker/plaiground-base/Dockerfile -t {_IMAGE} .'를 먼저 실행하세요."
        )

    warnings: list[str] = []
    gpu_available = _gpu_available()
    if not gpu_available and spec.min_vram_gb > 0:
        warnings.append(
            f"GPU가 감지되지 않았습니다. '{spec.model_id}'는 "
            f"GPU({spec.min_vram_gb}GB+) 권장 모델이라 CPU 실행 시 느릴 수 있습니다."
        )

    # 모델 전환 시 컨테이너 재사용하지 않고 매번 새로 띄움 (DECISION 문서 권고).
    _run(["docker", "rm", "-f", _CONTAINER_NAME])

    workspace = (workspace or workspace_dir()).resolve()
    (workspace / ".telemetry").mkdir(parents=True, exist_ok=True)
    requirements_container_path = _write_requirements(spec, workspace)

    cmd = [
        "docker", "run", "-d", "--rm",
        "--name", _CONTAINER_NAME,
        *(["--gpus", "all"] if gpu_available else []),
        "-v", f"{workspace}:/workspace",
        "-p", f"127.0.0.1:{host_port}:8080",
        # SDK(plaiground_telemetry)는 이미지에 설치되어 있다. 컨테이너에는 사용자 폴더만 보인다 —
        # 플랫폼 소스·.env는 마운트되지 않는다. SDK 기록 위치는 마운트 안의 .telemetry.
        "-e", "PLAIGROUND_TELEMETRY_DIR=/workspace/.telemetry",
        *(["-e", f"MODEL_REQUIREMENTS_FILE={requirements_container_path}"] if requirements_container_path else []),
        _IMAGE,
    ]
    result = _run(cmd)
    if result.returncode != 0:
        raise RuntimeError(f"컨테이너 실행 실패: {result.stderr.strip()}")

    container_id = result.stdout.strip()
    if not _wait_ready(container_id):
        # PLAN.md 섹션 8: 프로비저너는 크래시 대신 경고를 담은 EnvReport를 돌려준다.
        warnings.append(
            "컨테이너 준비 신호를 기다리다 시간이 초과됐습니다. "
            "모델별 패키지 설치가 끝나지 않은 상태일 수 있습니다."
        )

    return EnvReport(
        gpu_available=gpu_available,
        container_id=container_id,
        url=f"http://127.0.0.1:{host_port}",
        warnings=warnings,
    )


def demo() -> None:
    spec = ModelCatalog.get_model("mnist-cnn-lite")
    report = ensure_ready(spec)
    try:
        assert report.container_id
        assert report.url == f"http://127.0.0.1:{_HOST_PORT}"
        print(f"provisioner.py self-check OK - gpu_available={report.gpu_available}, url={report.url}")
    finally:
        _run(["docker", "stop", _CONTAINER_NAME])


if __name__ == "__main__":
    demo()
