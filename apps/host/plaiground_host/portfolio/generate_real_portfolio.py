"""
실제 학습 텔레메트리로 포트폴리오를 생성한다.

  python -m plaiground_host.portfolio.generate_real_portfolio              # 최신 raw_telemetry.json
  python -m plaiground_host.portfolio.generate_real_portfolio --run <id>   # var/telemetry/runs/<id>.json

run_id를 주면 산출물도 var/output/<id>.{html,json}으로 따로 보관된다.
"""
import json
import sys
from pathlib import Path

if sys.platform == "win32":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from plaiground_host.portfolio.llm.generator import generate_portfolio
from plaiground_host.portfolio.services.renderer import render_portfolio
from plaiground_host.paths import TELEMETRY_DIR


def build_real_portfolio(run_id: str | None = None) -> None:
    base = TELEMETRY_DIR
    telemetry_path = (base / "runs" / f"{run_id}.json") if run_id else (base / "raw_telemetry.json")

    if not telemetry_path.exists():
        print(f"텔레메트리 파일이 없습니다: {telemetry_path.name} — Web IDE에서 학습을 먼저 실행하세요.")
        sys.exit(1)

    raw_telemetry = json.loads(telemetry_path.read_text(encoding="utf-8"))

    print(f"[1/2] 실제 학습 텔레메트리({telemetry_path.name})로 포트폴리오 서사 생성 중...")
    try:
        portfolio_schema = generate_portfolio(raw_telemetry, allow_mock=False)
    except RuntimeError as exc:
        print(f"생성 중단: {exc}")
        sys.exit(2)

    print("[2/2] 템플릿 바인딩 및 SHA-256 해시 주입 중...")
    output_path = render_portfolio(portfolio_schema, raw_telemetry, run_id=run_id or raw_telemetry.get("run_id"))

    print(f"완성된 포트폴리오 파일: {output_path}")


if __name__ == "__main__":
    _args = sys.argv[1:]
    _run = _args[_args.index("--run") + 1] if "--run" in _args and _args.index("--run") + 1 < len(_args) else None
    build_real_portfolio(_run)
