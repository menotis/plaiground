"""plAI-ground Core Engine Package."""

from .builder import BuildResult, build_environment
from .gpu_detector import GpuInfo, detect_gpu

__version__ = "0.2.0"

__all__ = [
    "GpuInfo",
    "detect_gpu",
    "BuildResult",
    "build_environment",
]
