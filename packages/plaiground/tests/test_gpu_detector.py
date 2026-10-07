"""Unit tests for GPU detector and PyTorch wheel resolution matrix."""

import pytest
from plaiground.gpu_detector import (
    PYTORCH_VERSION,
    TORCH_INDEX_CU126,
    TORCH_INDEX_CU130,
    parse_nvidia_output,
)


def test_turing_2060_super_modern_driver():
    """RTX 2060 Super with driver 616.92 should map to Group B (cu130)."""
    raw = "NVIDIA GeForce RTX 2060 SUPER, 7.5, 616.92"
    info = parse_nvidia_output(raw)

    assert info.has_nvidia_gpu is True
    assert "2060 SUPER" in info.name
    assert info.compute_cap == 7.5
    assert info.driver_major == 616
    assert info.group == "group_b"
    assert info.cuda_tag == "cu130"
    assert info.index_url == TORCH_INDEX_CU130
    assert info.torch_version == PYTORCH_VERSION
    assert info.recommend_colab is False


def test_pascal_gtx_1060_legacy():
    """GTX 1060 (Pascal, CC 6.1) must map to Group A (cu126) regardless of driver."""
    raw = "NVIDIA GeForce GTX 1060 6GB, 6.1, 580.65"
    info = parse_nvidia_output(raw)

    assert info.has_nvidia_gpu is True
    assert info.compute_cap == 6.1
    assert info.group == "group_a"
    assert info.cuda_tag == "cu126"
    assert info.index_url == TORCH_INDEX_CU126
    assert info.recommend_colab is False


def test_blackwell_rtx_5090_modern_driver():
    """RTX 5090 (Blackwell, CC 12.0) with driver 580+ should map to Group B (cu130)."""
    raw = "NVIDIA GeForce RTX 5090, 12.0, 580.65"
    info = parse_nvidia_output(raw)

    assert info.has_nvidia_gpu is True
    assert info.compute_cap == 12.0
    assert info.group == "group_b"
    assert info.cuda_tag == "cu130"
    assert info.index_url == TORCH_INDEX_CU130


def test_ada_rtx_4090_legacy_driver():
    """RTX 4090 (CC 8.9) with older driver 565 should map to Group A (cu126)."""
    raw = "NVIDIA GeForce RTX 4090, 8.9, 565.12"
    info = parse_nvidia_output(raw)

    assert info.has_nvidia_gpu is True
    assert info.group == "group_a"
    assert info.cuda_tag == "cu126"
    assert info.index_url == TORCH_INDEX_CU126


def test_fallback_when_empty():
    """Empty or unparseable input should fallback to CPU with Colab recommendation."""
    info = parse_nvidia_output("")
    assert info.has_nvidia_gpu is False
    assert info.group == "cpu"
    assert info.index_url is None
    assert info.recommend_colab is True
