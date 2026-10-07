# plAI-ground Core Engine (`plaiground`)

plAI-ground의 BYOC(Bring Your Own Compute) 옴니채널 코어 엔진 라이브러리입니다.

## 주요 기능
1. **GPU & 드라이버 자동 감지 (`gpu_detector.py`)**:
   - `nvidia-smi`를 파싱하여 GPU 모델, 아키텍처(Compute Capability), 드라이버 버전 확인
   - Group A (Legacy / `cu126`) 및 Group B (Standard / `cu130`) 자동 분기 (PyTorch 2.14.1 통일)
   - Non-NVIDIA / Mac(MPS) / CPU 감지 시 "Google Colab 1줄 실행" 안내 제공
2. **`uv(venv)` 초고속 가상환경 빌더 (`builder.py`)**:
   - 로컬 `uv` 엔진을 통한 단일 자리 초(3~5초) 가상환경 격리 및 PyTorch 휠 설치
3. **CLI 인터페이스 (`cli.py`)**:
   - `plaiground detect`: 로컬 하드웨어 사양 및 권장 PyTorch 휠 진단
   - `plaiground init`: 디렉토리 지정 및 가상환경 즉시 빌드
