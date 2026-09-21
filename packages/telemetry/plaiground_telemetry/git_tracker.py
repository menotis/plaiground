"""
git_tracker.py — AST/Git Diff 스냅샷 추출기.

`git diff HEAD` 또는 직전 커밋 대비 변경점을 문자열로 반환.
Git 미설치/미초기화 환경에서도 절대 크래시하지 않음.
"""

import subprocess

from .paths import REPO_ROOT as _REPO_ROOT  # 작업 디렉토리: 저장소 루트


def get_git_diff() -> str:
    """
    Git diff를 반환. 실패 시 fallback 메시지 반환.

    Returns:
        str: git diff 결과 문자열 또는 fallback 메시지.
    """
    try:
        result = subprocess.run(
            ["git", "diff", "HEAD"],
            cwd=_REPO_ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=10,
        )
        diff = result.stdout.strip()
        return diff if diff else "[No staged changes detected in git diff HEAD]"
    except FileNotFoundError:
        return "[Git not installed — diff skipped]"
    except subprocess.TimeoutExpired:
        return "[Git diff timed out — diff skipped]"
    except Exception as e:
        return f"[Git diff unavailable: {e}]"
