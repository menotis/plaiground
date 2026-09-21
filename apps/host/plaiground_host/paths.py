"""
paths.py — 호스트 앱의 경로 상수. 폴더 위치를 아는 유일한 곳.

소스는 읽기 전용, 실행 중 생기는 파일은 전부 var/ 아래에 둔다.
다른 모듈은 Path(__file__)로 저장소 구조를 거슬러 올라가지 말고 여기서 가져다 쓴다.
"""

from pathlib import Path

# 텔레메트리 위치는 기록하는 쪽(plaiground_telemetry)이 주인이다 — 읽는 쪽이 따로 정의하면 어긋난다.
from plaiground_telemetry.paths import TELEMETRY_DIR

REPO_ROOT = Path(__file__).resolve().parents[3]
VAR_DIR = REPO_ROOT / "var"
OUTPUT_DIR = VAR_DIR / "output"          # 생성된 포트폴리오 HTML/JSON
GENERATED_DIR = VAR_DIR / "generated"    # 생성된 학습 스크립트, 모델별 requirements, 커뮤니티 실습 코드
COMMUNITY_DIR = VAR_DIR / "community"    # 추천/조회 누적, 사용자 댓글
WEB_DIST = REPO_ROOT / "apps" / "web" / "dist"

__all__ = ["REPO_ROOT", "VAR_DIR", "TELEMETRY_DIR", "OUTPUT_DIR", "GENERATED_DIR", "COMMUNITY_DIR", "WEB_DIST"]
