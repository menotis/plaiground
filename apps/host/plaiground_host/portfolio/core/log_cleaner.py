"""
log_cleaner.py — 스택트레이스 노이즈 필터링.

수백 줄의 raw traceback에서 site-packages 등 내부 라이브러리 경로를 
정규식으로 제거하고 사용자 코드 에러 블록만 압축 추출.
"""

import re

# site-packages, lib/python, frozen importlib 등 내부 경로 패턴
_STDLIB_PATTERNS = re.compile(
    r'File ".*?(?:site-packages|lib[\\/]python|<frozen|importlib)[^"]*".*\n(?:.*\n)?',
    re.MULTILINE,
)

# 빈 줄 연속 제거
_BLANK_LINES = re.compile(r"\n{3,}")


def clean_traceback(raw: str) -> str:
    """
    raw traceback에서 내부 라이브러리 경로를 제거하고 사용자 코드 블록만 반환.

    Args:
        raw: 전체 traceback 문자열.

    Returns:
        str: 정제된 traceback 문자열.
    """
    if not raw:
        return ""

    cleaned = _STDLIB_PATTERNS.sub("", raw)
    cleaned = _BLANK_LINES.sub("\n\n", cleaned)
    return cleaned.strip()
