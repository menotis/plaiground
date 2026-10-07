"""plAI-ground GPU & Driver Detector Engine.

Detects local GPU hardware, NVIDIA driver version, and Compute Capability,
and resolves the exact matching PyTorch 2.14.1 wheel index (cu126 vs cu130 vs CPU)
based on the verified 2-tier preset matrix in 04_BRANCH_DEVELOPMENT_PLAN.md.
"""

from __future__ import annotations

import platform
import shutil
import subprocess
from dataclasses import dataclass
from typing import Literal

PYTORCH_VERSION = "2.14.1"
TORCH_INDEX_CU126 = "https://download.pytorch.org/whl/cu126"
TORCH_INDEX_CU130 = "https://download.pytorch.org/whl/cu130"

GroupType = Literal["group_a", "group_b", "cpu", "mps"]


@dataclass(frozen=True)
class GpuInfo:
    """Hardware and PyTorch wheel resolution metadata."""

    has_nvidia_gpu: bool
    name: str
    compute_cap: float | None
    driver_version: str | None
    driver_major: int | None
    group: GroupType
    cuda_tag: str
    index_url: str | None
    torch_version: str
    recommend_colab: bool
    status_message: str


def _query_nvidia_smi() -> str | None:
    """Execute nvidia-smi query command and return raw output."""
    nvsmi_path = shutil.which("nvidia-smi")
    if not nvsmi_path:
        return None

    try:
        res = subprocess.run(
            [
                nvsmi_path,
                "--query-gpu=name,compute_cap,driver_version",
                "--format=csv,noheader",
            ],
            capture_output=True,
            text=True,
            check=True,
            timeout=5,
        )
        return res.stdout.strip()
    except (subprocess.SubprocessError, OSError):
        return None


def parse_nvidia_output(raw_output: str) -> GpuInfo:
    """Parse comma-separated nvidia-smi output and determine the optimal wheel index."""
    lines = [line.strip() for line in raw_output.splitlines() if line.strip()]
    if not lines:
        return _fallback_cpu("nvidia-smi 출력 결과가 비어 있습니다.")

    # In multi-GPU setups, examine primary GPU (device 0)
    primary_gpu = lines[0]
    parts = [p.strip() for p in primary_gpu.split(",")]
    if len(parts) < 3:
        return _fallback_cpu(f"알 수 없는 nvidia-smi 출력 형식: {primary_gpu}")

    name = parts[0]
    try:
        compute_cap = float(parts[1])
    except ValueError:
        compute_cap = None

    driver_version = parts[2]
    try:
        driver_major = int(driver_version.split(".")[0])
    except (ValueError, IndexError):
        driver_major = None

    # Resolution logic:
    # 1. Old Architectures: Compute Capability < 7.0 (Maxwell, Pascal, Volta)
    #    CUDA 13.x removed support for CC < 7.0. Must use Group A (cu126).
    if compute_cap is not None and compute_cap < 7.0:
        return GpuInfo(
            has_nvidia_gpu=True,
            name=name,
            compute_cap=compute_cap,
            driver_version=driver_version,
            driver_major=driver_major,
            group="group_a",
            cuda_tag="cu126",
            index_url=TORCH_INDEX_CU126,
            torch_version=PYTORCH_VERSION,
            recommend_colab=False,
            status_message=f"Group A (Legacy): {name} (CC {compute_cap})는 cu126 최적화 휠을 사용합니다.",
        )

    # 2. Blackwell (RTX 50 series, CC >= 12.0)
    #    Requires CUDA 12.8+ / CUDA 13.0+, minimum driver 580+.
    if compute_cap is not None and compute_cap >= 12.0:
        if driver_major is not None and driver_major < 580:
            return GpuInfo(
                has_nvidia_gpu=True,
                name=name,
                compute_cap=compute_cap,
                driver_version=driver_version,
                driver_major=driver_major,
                group="group_b",
                cuda_tag="cu130",
                index_url=TORCH_INDEX_CU130,
                torch_version=PYTORCH_VERSION,
                recommend_colab=False,
                status_message=f"주의: {name} (Blackwell) 사용을 위해 NVIDIA 드라이버를 580 이상으로 업데이트하십시오.",
            )
        return GpuInfo(
            has_nvidia_gpu=True,
            name=name,
            compute_cap=compute_cap,
            driver_version=driver_version,
            driver_major=driver_major,
            group="group_b",
            cuda_tag="cu130",
            index_url=TORCH_INDEX_CU130,
            torch_version=PYTORCH_VERSION,
            recommend_colab=False,
            status_message=f"Group B (Standard): {name} (Blackwell)에 cu130 최신 휠이 적용됩니다.",
        )

    # 3. Modern Architectures: CC >= 7.0 (Turing 2060S, Ampere 30xx, Ada 40xx, Hopper)
    if driver_major is not None and driver_major >= 580:
        return GpuInfo(
            has_nvidia_gpu=True,
            name=name,
            compute_cap=compute_cap,
            driver_version=driver_version,
            driver_major=driver_major,
            group="group_b",
            cuda_tag="cu130",
            index_url=TORCH_INDEX_CU130,
            torch_version=PYTORCH_VERSION,
            recommend_colab=False,
            status_message=f"Group B (Standard): {name} (드라이버 {driver_version})에 cu130 최신 휠이 적용됩니다.",
        )

    if driver_major is not None and driver_major >= 560:
        return GpuInfo(
            has_nvidia_gpu=True,
            name=name,
            compute_cap=compute_cap,
            driver_version=driver_version,
            driver_major=driver_major,
            group="group_a",
            cuda_tag="cu126",
            index_url=TORCH_INDEX_CU126,
            torch_version=PYTORCH_VERSION,
            recommend_colab=False,
            status_message=f"Group A (Legacy Driver): {name} (드라이버 {driver_version})에 cu126 호환 휠이 적용됩니다.",
        )

    # Driver older than 560
    return GpuInfo(
        has_nvidia_gpu=True,
        name=name,
        compute_cap=compute_cap,
        driver_version=driver_version,
        driver_major=driver_major,
        group="group_a",
        cuda_tag="cu126",
        index_url=TORCH_INDEX_CU126,
        torch_version=PYTORCH_VERSION,
        recommend_colab=False,
        status_message=f"권고: {name} 드라이버({driver_version})가 구버전입니다. 최신 성능을 위해 드라이버 580 이상 업데이트를 권장합니다.",
    )


def _fallback_cpu(reason: str) -> GpuInfo:
    """Fallback when NVIDIA GPU is absent or unsupported."""
    is_mac = platform.system() == "Darwin"
    is_arm_mac = is_mac and platform.processor() == "arm"

    if is_arm_mac:
        return GpuInfo(
            has_nvidia_gpu=False,
            name="Apple Silicon (MPS)",
            compute_cap=None,
            driver_version=None,
            driver_major=None,
            group="mps",
            cuda_tag="mps",
            index_url=None,
            torch_version=PYTORCH_VERSION,
            recommend_colab=False,
            status_message="Apple Silicon 감지: Metal Performance Shaders(MPS) 가속 빌드를 사용합니다.",
        )

    return GpuInfo(
        has_nvidia_gpu=False,
        name="CPU / Non-NVIDIA",
        compute_cap=None,
        driver_version=None,
        driver_major=None,
        group="cpu",
        cuda_tag="cpu",
        index_url=None,
        torch_version=PYTORCH_VERSION,
        recommend_colab=True,
        status_message=f"{reason} Google Colab(무료 T4 GPU) 1줄 실행을 권장합니다.",
    )


def detect_gpu() -> GpuInfo:
    """Inspect local hardware and return the resolved GpuInfo."""
    raw = _query_nvidia_smi()
    if not raw:
        return _fallback_cpu("NVIDIA GPU 또는 드라이버가 감지되지 않았습니다.")
    return parse_nvidia_output(raw)
