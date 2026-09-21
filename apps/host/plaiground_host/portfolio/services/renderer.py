"""
renderer.py — SHA-256 무결성 해시 부여 및 Jinja2 HTML 렌더러.

SHA-256(timestamp + raw_telemetry) 해시를 계산하여 VerificationMeta에 주입.
Jinja2 템플릿에 PortfolioSchema 데이터를 바인딩하여 portfolio_output.html 저장.
"""

import hashlib
import json
from datetime import datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from ...paths import OUTPUT_DIR
from ..core.schema import PortfolioSchema

_TEMPLATE_DIR = Path(__file__).parent.parent / "templates"
_OUTPUT_DIR = OUTPUT_DIR  # 실행별 포트폴리오 보관
_OUTPUT_FILE = _OUTPUT_DIR / "portfolio_output.html"
_OUTPUT_JSON = _OUTPUT_DIR / "portfolio_output.json"


def _compute_hash(timestamp: str, telemetry: dict) -> str:
    """
    SHA-256(timestamp + telemetry_json) 해시 계산.

    Args:
        timestamp: ISO 형식 타임스탬프 문자열.
        telemetry: raw 텔레메트리 딕셔너리.

    Returns:
        str: 16진수 SHA-256 해시 (64자).
    """
    payload = timestamp + json.dumps(telemetry, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def render_portfolio(schema: PortfolioSchema, telemetry: dict, run_id: str | None = None) -> Path:
    """
    PortfolioSchema를 HTML 포트폴리오로 렌더링 후 파일로 저장.

    Args:
        schema: Pydantic V2 검증 완료 포트폴리오 스키마.
        telemetry: SHA-256 해시 계산에 사용할 원본 텔레메트리.

    Returns:
        Path: 생성된 portfolio_output.html 경로.
    """
    timestamp = datetime.utcnow().isoformat()
    integrity_hash = _compute_hash(timestamp, telemetry)

    # 해시를 스키마에 주입 (verification.integrity_hash 교체)
    data = schema.model_dump()
    data["verification"]["integrity_hash"] = integrity_hash
    data["verification"]["generated_at"] = timestamp
    run_id = run_id or telemetry.get("run_id")
    if run_id:
        data["run_id"] = run_id

    # Jinja2 렌더링
    env = Environment(loader=FileSystemLoader(str(_TEMPLATE_DIR)), autoescape=True)
    template = env.get_template("portfolio_template.html")
    html = template.render(portfolio=data)

    payload = json.dumps(data, ensure_ascii=False, indent=2)
    _OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    if run_id:  # 실행별 보관본 — 모델마다 포트폴리오를 따로 남긴다
        (_OUTPUT_DIR / f"{run_id}.html").write_text(html, encoding="utf-8")
        (_OUTPUT_DIR / f"{run_id}.json").write_text(payload, encoding="utf-8")
    _OUTPUT_FILE.write_text(html, encoding="utf-8")  # 최신본 (하위 호환)
    _OUTPUT_JSON.write_text(payload, encoding="utf-8")
    return (_OUTPUT_DIR / f"{run_id}.html") if run_id else _OUTPUT_FILE


# 호환성을 위한 alias
render_portfolio_html = render_portfolio

