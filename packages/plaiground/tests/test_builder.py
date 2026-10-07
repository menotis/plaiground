"""Unit tests for uv builder components."""

from pathlib import Path
from plaiground.builder import (
    _find_uv_binary,
    _write_starter_template,
    get_venv_python,
)
from plaiground.gpu_detector import GpuInfo


def test_find_uv_binary():
    """Verify that uv executable can be found on this system."""
    uv_path = _find_uv_binary()
    assert uv_path is not None
    assert "uv" in uv_path.lower()


def test_get_venv_python(tmp_path: Path):
    """Verify correct python executable path inside venv."""
    py_path = get_venv_python(tmp_path)
    assert "python" in py_path.name.lower()


def test_write_starter_template(tmp_path: Path):
    """Verify starter template generation with GPU info."""
    fake_info = GpuInfo(
        has_nvidia_gpu=True,
        name="RTX 2060 Super",
        compute_cap=7.5,
        driver_version="616.92",
        driver_major=616,
        group="group_b",
        cuda_tag="cu130",
        index_url="https://download.pytorch.org/whl/cu130",
        torch_version="2.14.1",
        recommend_colab=False,
        status_message="OK",
    )
    _write_starter_template(tmp_path, fake_info)
    train_file = tmp_path / "train.py"
    assert train_file.exists()
    content = train_file.read_text(encoding="utf-8")
    assert "RTX 2060 Super" in content
    assert "cu130" in content
    assert "torch.cuda.is_available()" in content
