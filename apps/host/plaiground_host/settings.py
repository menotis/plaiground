"""
settings.py — 환경변수를 읽는 유일한 곳. 다른 모듈은 os.environ을 직접 읽지 않는다.

전부 선택이며, 없으면 로컬 개발 기본값(지금까지의 동작)이다. 변수 이름 목록은 apps/host/.env.example.
"""

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, "").strip() or default


PORT = int(_env("PLAIGROUND_PORT", _env("PLAIGROUND_COMBINE_PORT", "8770")))  # 옛 이름도 당분간 인정
VAR_DIR = Path(_env("PLAIGROUND_VAR_DIR", str(REPO_ROOT / "var")))
IDE_PORT = int(_env("PLAIGROUND_IDE_PORT", "8080"))
IDE_URL = _env("PLAIGROUND_IDE_URL", f"http://127.0.0.1:{IDE_PORT}")  # 브라우저가 여는 주소 (Stage C: ts.net)

# 브라우저 CORS 허용 오리진. 비어 있으면 CORS 헤더를 내지 않는다 (같은 출처·Vite 프록시만 동작).
ALLOWED_ORIGINS = [o.strip() for o in _env("PLAIGROUND_ALLOWED_ORIGINS").split(",") if o.strip()]

# off: 인증 없음, 사용자 id는 "local". supabase: Authorization: Bearer <access_token> 필수.
AUTH = _env("PLAIGROUND_AUTH", "off")
SUPABASE_URL = _env("SUPABASE_URL").rstrip("/")
SUPABASE_ANON_KEY = _env("SUPABASE_ANON_KEY")

# 서버가 포트폴리오 생성 서브프로세스에 넘기는 사용자 id. 서버 자신은 요청마다 인증 결과를 쓴다.
USER = _env("PLAIGROUND_USER", "local")

if AUTH not in ("off", "supabase"):
    raise RuntimeError(f"PLAIGROUND_AUTH는 off 또는 supabase여야 합니다: {AUTH!r}")
if AUTH == "supabase" and not (SUPABASE_URL and SUPABASE_ANON_KEY):
    raise RuntimeError("PLAIGROUND_AUTH=supabase 에는 SUPABASE_URL, SUPABASE_ANON_KEY가 필요합니다.")
