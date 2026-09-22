"""api.py — 포트폴리오 실행 기록·산출물 조회와 생성 파이프라인 실행 준비. HTTP를 모른다 (server.py가 부른다)."""

import json
import os
import sys
from pathlib import Path

from ..paths import DEFAULT_USER, portfolio_dir, safe_name, telemetry_dir


def telemetry_path(run: str, user: str = DEFAULT_USER) -> Path | None:
    """run이 있으면 runs/<run>.json, 없으면 최신본 raw_telemetry.json. 이름이 위험하면 None."""
    base = telemetry_dir(user)
    if not run:
        return base / "raw_telemetry.json"
    return (base / "runs" / f"{run}.json") if safe_name(run) else None


def output_path(run: str, ext: str, user: str = DEFAULT_USER) -> Path | None:
    base = portfolio_dir(user)
    if not run:
        return base / f"portfolio_output.{ext}"
    return (base / f"{run}.{ext}") if safe_name(run) else None


def list_runs(user: str = DEFAULT_USER) -> list[dict]:
    """실행 이력 — 최신순. 모델별 포트폴리오를 따로 고르기 위한 목록."""
    runs_dir = telemetry_dir(user) / "runs"
    if not runs_dir.exists():
        return []
    runs = []
    for f in runs_dir.glob("*.json"):
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        rid = d.get("run_id") or f.stem
        runs.append({
            "run_id": rid,
            "saved_at": d.get("saved_at", ""),
            "script": d.get("script", ""),
            "project_name": (d.get("overview") or {}).get("project_name", ""),
            "base_model": ((d.get("benchmarks") or {}).get("hyperparameters") or {}).get("base_model", ""),
            "error_count": len(d.get("error_history") or []),
            "has_portfolio": (portfolio_dir(user) / f"{rid}.json").exists(),
        })
    return sorted(runs, key=lambda r: r["saved_at"], reverse=True)


def telemetry_summary(run: str = "", user: str = DEFAULT_USER) -> dict:
    """포트폴리오 화면 상단 지표용 — 원본 JSON에서 가벼운 필드만 추린다."""
    path = telemetry_path(run, user)
    if path is None or not path.exists():
        return {"exists": False, "run_id": run}
    data = json.loads(path.read_text(encoding="utf-8"))
    html, js = output_path(run, "html", user), output_path(run, "json", user)
    return {
        "exists": True,
        "run_id": data.get("run_id", run),
        "saved_at": data.get("saved_at", ""),
        "overview": data.get("overview", {}),
        "dataset": data.get("dataset", {}),
        "benchmarks": data.get("benchmarks", {}),
        "error_count": len(data.get("error_history", [])),
        "script_diff": data.get("script_diff", ""),
        "last_error_type": (data.get("last_error") or {}).get("error_type", ""),
        "output_exists": bool(html and html.exists()),
        "data_exists": bool(js and js.exists()),
    }


def pipeline(run: str, mode: str, user: str = DEFAULT_USER, gemini_key: str = "") -> tuple[list[str], dict, str, bool]:
    """생성 파이프라인의 (argv, env, 안내 문구, 데모 여부).

    - 기본: Web IDE 학습이 남긴 실제 텔레메트리로 생성. 텔레메트리가 없으면 데모 파이프라인으로 폴백.
    - mode=demo: 강제로 run_demo.
    - gemini_key: 요청 헤더로 받은 사용자 키. env로만 넘긴다 — argv는 프로세스 목록에 보인다.
      generator.py의 load_dotenv는 이미 있는 환경변수를 덮지 않으므로 헤더 키가 서버 .env보다 우선한다.
    서브프로세스로 격리하는 이유: run_demo가 sys.excepthook을 갈아끼우기 때문.
    """
    tpath = telemetry_path(run, user)
    has_real = bool(tpath and tpath.exists())
    use_demo = mode == "demo" or not has_real
    module = "plaiground_host.portfolio.run_demo" if use_demo else "plaiground_host.portfolio.generate_real_portfolio"
    argv = [sys.executable, "-m", module] + ([] if use_demo or not run else ["--run", run])
    # 파이프로 연결된 파이썬은 stdout을 블록 버퍼링해 종료 때까지 한 줄도 안 보낸다 — 무버퍼로 강제.
    env = {
        **os.environ,
        "PYTHONIOENCODING": "utf-8",
        "PYTHONUNBUFFERED": "1",
        "PLAIGROUND_USER": user,
        "PLAIGROUND_TELEMETRY_DIR": str(telemetry_dir(user)),
    }
    if gemini_key:
        env["GEMINI_API_KEY"] = gemini_key
    label = "데모 파이프라인 (가상 데이터)" if use_demo else f"실제 학습 텔레메트리 ({tpath.name})"
    return argv, env, label, use_demo


def build_markdown(d: dict) -> str:
    """포트폴리오 JSON → 내보내기용 Markdown."""
    ov, de, bm, ts, vf = d["overview"], d["data_engineering"], d["benchmarks"], d["troubleshooting"], d["verification"]
    lines = [
        f"# {ov['title']}",
        "",
        f"- 기반 모델: {ov['base_model']}",
        f"- 태스크: {ov['task_type']}",
        f"- 하드웨어: {vf['hardware']}",
        "- 검증 엔진: plAI-ground / DiffStack v1.0",
        f"- SHA-256 무결성 해시: `{vf['integrity_hash']}`",
        f"- 발급 일시: {vf.get('generated_at', '')[:19]} UTC",
        "",
        "## 성능 벤치마크",
        "",
        f"- 지표: {bm['evaluation_metric']}",
        f"- Baseline {bm['baseline_performance']} → Fine-tuned {bm['optimized_performance']} ({bm['improvement_rate']})",
        "",
        "## 데이터 전처리",
        "",
        *[f"- {t}" for t in de["preprocessing_techniques"]],
        "",
        de["data_efficiency_impact"],
        "",
        "## 학습 방법 · 성능 향상",
        "",
        *[f"- {m}" for m in bm["optimization_methods"]],
        "",
        "## 에러 · 문제 해결",
        "",
        *[line for i, e in enumerate(ts.get("errors") or [], start=1)
          for line in (f"### #{i} {e['error_type']}", f"- 원인: {e['cause']}", f"- 해결: {e['fix']}", "")],
        f"- 최종 에러: {ts['error_type']}",
        f"- 원인 요약: {ts['root_cause']}",
        "",
        "```diff",
        ts["resolution_diff"],
        "```",
        "",
        f"> {ts['engineering_takeaway']}",
        "",
    ]
    return "\n".join(lines)
