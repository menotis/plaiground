"""
auth.py — 요청의 사용자 확인.

PLAIGROUND_AUTH=off      인증 없음. 모든 요청이 사용자 "local".
PLAIGROUND_AUTH=supabase Authorization: Bearer <access_token> 필수. Supabase의 사용자 조회
                         엔드포인트에 토큰을 넘겨 200이면 유효. 서명을 직접 검증하지 않으므로
                         암호 라이브러리가 필요 없고, 결과를 토큰별로 60초 캐시해 요청마다 왕복하지 않는다.

ponytail: 캐시는 프로세스 메모리 dict. 서버가 하나라 충분하다.
"""

import json
import threading
import time
import urllib.error
import urllib.request

from . import settings
from .paths import DEFAULT_USER, safe_name

_TTL = 60.0
_cache: dict[str, tuple[float, str | None]] = {}
_lock = threading.Lock()


def _lookup(token: str) -> str | None:
    req = urllib.request.Request(
        f"{settings.SUPABASE_URL}/auth/v1/user",
        headers={"apikey": settings.SUPABASE_ANON_KEY, "Authorization": f"Bearer {token}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            uid = json.loads(resp.read()).get("id")
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError):
        return None
    return safe_name(uid) if isinstance(uid, str) else None


def authenticate(headers) -> str | None:
    """헤더에서 사용자 id를 얻는다. 인증 실패면 None."""
    if settings.AUTH == "off":
        return DEFAULT_USER
    auth = headers.get("Authorization", "")
    if not auth.startswith("Bearer ") or len(auth) < 20:
        return None
    token = auth[7:].strip()
    now = time.monotonic()
    with _lock:
        hit = _cache.get(token)
        if hit and hit[0] > now:
            return hit[1]
    user = _lookup(token)
    with _lock:
        _cache[token] = (now + _TTL, user)
        if len(_cache) > 1000:  # 오래된 항목 정리 — 토큰은 1시간마다 바뀌므로 계속 쌓인다
            for k in [k for k, (exp, _) in _cache.items() if exp <= now]:
                _cache.pop(k, None)
    return user
