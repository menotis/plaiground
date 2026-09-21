"""
paths.py — 텔레메트리 기록 위치. 이 패키지에서 경로를 정하는 유일한 곳.

PLAIGROUND_TELEMETRY_DIR 환경변수가 우선한다 (컨테이너에서는 프로비저너가 설정).
없으면 저장소의 var/telemetry — 호스트에서 저장소를 그대로 쓰는 개발 환경용.

ponytail: REPO_ROOT는 저장소 안에서 실행될 때만 의미가 있다. 휠로 설치된 환경에서는
엉뚱한 경로가 되지만 쓰는 곳이 git diff(실패해도 안전)와 위 기본값뿐이라 괜찮다.
휠 배포로 전환할 때는 환경변수를 반드시 설정할 것.
"""

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
TELEMETRY_DIR = Path(os.environ.get("PLAIGROUND_TELEMETRY_DIR") or REPO_ROOT / "var" / "telemetry")
