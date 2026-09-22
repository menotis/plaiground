"""
paths.py — 호스트 앱의 경로. 폴더 위치를 아는 유일한 곳.

소스는 읽기 전용, 실행 중 생기는 파일은 전부 settings.VAR_DIR 아래에 둔다.
사용자 데이터는 사용자별로 나뉜다. 인증이 꺼진 로컬에서는 사용자 id가 "local".

  var/workspaces/<user>/            컨테이너에 /workspace 로 마운트. 학습 스크립트, 실습 코드
  var/workspaces/<user>/.telemetry/ SDK가 쓰는 실행 기록 (컨테이너에서는 /workspace/.telemetry)
  var/portfolios/<user>/            생성된 포트폴리오. 마운트 밖 — 사용자가 고칠 수 없다
  var/community/                    추천·조회 누적, 댓글 (사용자 공통)
"""

import re
from pathlib import Path

from .settings import REPO_ROOT, USER, VAR_DIR

DEFAULT_USER = USER  # 인증이 꺼진 로컬은 "local"
COMMUNITY_DIR = VAR_DIR / "community"
WEB_DIST = REPO_ROOT / "apps" / "web" / "dist"

_SAFE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")


def safe_name(name: str) -> str | None:
    """경로 조각으로 써도 안전한 이름만 통과. '..', 구분자, 숨김 접두는 None."""
    return name if name and _SAFE.match(name) and ".." not in name else None


def workspace_dir(user: str = DEFAULT_USER) -> Path:
    return VAR_DIR / "workspaces" / user


def telemetry_dir(user: str = DEFAULT_USER) -> Path:
    return workspace_dir(user) / ".telemetry"


def portfolio_dir(user: str = DEFAULT_USER) -> Path:
    return VAR_DIR / "portfolios" / user


__all__ = ["REPO_ROOT", "VAR_DIR", "DEFAULT_USER", "COMMUNITY_DIR", "WEB_DIST",
           "safe_name", "workspace_dir", "telemetry_dir", "portfolio_dir"]
