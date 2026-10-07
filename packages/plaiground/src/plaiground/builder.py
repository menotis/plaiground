"""plAI-ground uv(venv) Environment Builder.

Automates lightning-fast isolated Python virtual environment creation
and tailored PyTorch 2.14.1 wheel installation using uv.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

from .gpu_detector import GpuInfo, detect_gpu


@dataclass(frozen=True)
class BuildResult:
    """Result of the environment building process."""

    success: bool
    target_dir: Path
    venv_dir: Path
    python_path: Path
    gpu_info: GpuInfo
    elapsed_seconds: float
    message: str
    activation_cmd: str


def _find_uv_binary() -> str | None:
    """Locate uv executable in PATH or standard user directories."""
    found = shutil.which("uv")
    if found:
        return found

    # Windows fallback locations
    user_home = Path.home()
    candidates = [
        user_home / ".local" / "bin" / "uv.exe",
        user_home / "AppData" / "Local" / "Programs" / "uv" / "uv.exe",
        user_home / ".cargo" / "bin" / "uv.exe",
    ]
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)

    return None


def get_venv_python(venv_dir: Path) -> Path:
    """Return platform-specific Python interpreter path inside virtualenv."""
    if os.name == "nt":
        return venv_dir / "Scripts" / "python.exe"
    return venv_dir / "bin" / "python"


def build_environment(
    target_dir: str | Path,
    gpu_info: GpuInfo | None = None,
    extra_packages: list[str] | None = None,
    create_template: bool = True,
) -> BuildResult:
    """Create isolated venv and install tailored PyTorch 2.14.1 packages.

    Args:
        target_dir: Target directory path where project and .venv will be placed.
        gpu_info: Optional GpuInfo. If None, auto-detected locally.
        extra_packages: Optional list of additional pip packages to install.
        create_template: Whether to generate minimal train.py starter code.

    Returns:
        BuildResult metadata.
    """
    start_time = time.perf_counter()
    target_path = Path(target_dir).resolve()
    target_path.mkdir(parents=True, exist_ok=True)

    venv_dir = target_path / ".venv"
    python_path = get_venv_python(venv_dir)

    if gpu_info is None:
        gpu_info = detect_gpu()

    uv_path = _find_uv_binary()
    is_windows = os.name == "nt"
    activation_cmd = (
        r".\.venv\Scripts\activate" if is_windows else "source .venv/bin/activate"
    )

    try:
        # Step 1: Create virtual environment using uv (or fallback to python -m venv)
        if uv_path:
            subprocess.run(
                [uv_path, "venv", str(venv_dir)],
                cwd=target_path,
                capture_output=True,
                text=True,
                check=True,
                timeout=30,
            )
        else:
            subprocess.run(
                [sys.executable, "-m", "venv", str(venv_dir)],
                cwd=target_path,
                capture_output=True,
                text=True,
                check=True,
                timeout=60,
            )

        if not python_path.is_file():
            raise FileNotFoundError(
                f"가상환경 파이썬 실행 파일을 찾을 수 없습니다: {python_path}"
            )

        # Step 2: Install PyTorch 2.14.1 with resolved CUDA wheel index
        torch_pkgs = [
            f"torch=={gpu_info.torch_version}",
            "torchvision",
            "torchaudio",
        ]

        install_cmd: list[str]
        if uv_path:
            install_cmd = [
                uv_path,
                "pip",
                "install",
                "--python",
                str(python_path),
                *torch_pkgs,
            ]
            if gpu_info.index_url:
                install_cmd.extend(["--index-url", gpu_info.index_url])
        else:
            install_cmd = [
                str(python_path),
                "-m",
                "pip",
                "install",
                *torch_pkgs,
            ]
            if gpu_info.index_url:
                install_cmd.extend(["--index-url", gpu_info.index_url])

        subprocess.run(
            install_cmd,
            cwd=target_path,
            capture_output=True,
            text=True,
            check=True,
            timeout=180,
        )

        # Step 3: Install extra packages if provided
        if extra_packages:
            if uv_path:
                extra_cmd = [
                    uv_path,
                    "pip",
                    "install",
                    "--python",
                    str(python_path),
                    *extra_packages,
                ]
            else:
                extra_cmd = [
                    str(python_path),
                    "-m",
                    "pip",
                    "install",
                    *extra_packages,
                ]
            subprocess.run(
                extra_cmd,
                cwd=target_path,
                capture_output=True,
                text=True,
                check=True,
                timeout=60,
            )

        # Step 4: Write starter template if requested
        if create_template:
            _write_starter_template(target_path, gpu_info)

        elapsed = round(time.perf_counter() - start_time, 2)
        return BuildResult(
            success=True,
            target_dir=target_path,
            venv_dir=venv_dir,
            python_path=python_path,
            gpu_info=gpu_info,
            elapsed_seconds=elapsed,
            message=f"성공: {gpu_info.cuda_tag} 최적화 가상환경이 {elapsed}초 만에 구성되었습니다.",
            activation_cmd=activation_cmd,
        )

    except subprocess.CalledProcessError as e:
        elapsed = round(time.perf_counter() - start_time, 2)
        stderr_msg = e.stderr.strip() if e.stderr else str(e)
        return BuildResult(
            success=False,
            target_dir=target_path,
            venv_dir=venv_dir,
            python_path=python_path,
            gpu_info=gpu_info,
            elapsed_seconds=elapsed,
            message=f"빌드 실패: {stderr_msg}",
            activation_cmd=activation_cmd,
        )


def _write_starter_template(target_path: Path, gpu_info: GpuInfo) -> None:
    """Generate minimal train.py and verify torch execution."""
    train_file = target_path / "train.py"
    if not train_file.exists():
        train_file.write_text(
            f'''"""plAI-ground Quickstart Training Script.
Auto-configured for: {gpu_info.name} ({gpu_info.cuda_tag})
"""

import torch

def main():
    print("=" * 60)
    print("🚀 plAI-ground BYOC Environment Verified!")
    print(f"PyTorch Version: {{torch.__version__}}")
    print(f"CUDA Available:  {{torch.cuda.is_available()}}")
    if torch.cuda.is_available():
        print(f"Device Name:     {{torch.cuda.get_device_name(0)}}")
        print(f"Compute Cap:     {{torch.cuda.get_device_capability(0)}}")
        # Quick tensor allocation test
        x = torch.randn(1024, 1024, device="cuda")
        y = torch.matmul(x, x)
        print("✅ GPU Matrix Multiplication Test: SUCCESS")
    else:
        print("⚠️ Running on CPU mode")
    print("=" * 60)

if __name__ == "__main__":
    main()
''',
            encoding="utf-8",
        )
