"""
api_server.py — GPU 호스트 통합 API 서버 (실행: python -m plaiground_host.api_server).

workspace의 API(환경 감지·모델 카탈로그·SSE 프로비저닝·학습 시각화)를 그대로 상속하고,
portfolio 파이프라인 실행/조회와 community 엔드포인트를 추가한다.

추가 엔드포인트:
  GET /api/portfolio/run        run_demo.py 파이프라인을 서브프로세스로 실행,
                                stdout을 SSE로 스트리밍. 끝나면 ready 이벤트.
  GET /api/portfolio/output     생성된 portfolio_output.html
  GET /api/portfolio/telemetry  .telemetry/raw_telemetry.json 요약

ponytail: 인증 없이 127.0.0.1에만 바인딩. docker/학습을 실행하므로 외부 노출 금지.
"""

import json
import os
import socket
import subprocess
import sys
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from .community import service as community
from .paths import OUTPUT_DIR, REPO_ROOT, TELEMETRY_DIR, WEB_DIST
from .workspace.api_server import _Handler as _BaseHandler

_REPO_ROOT = REPO_ROOT
_STATIC_DIR = WEB_DIST
_DEFAULT_PORT = 8770


_IDE_URL = "http://127.0.0.1:8080"


def _ide_running() -> bool:
    """code-server(8080) 응답 여부 — Start AI를 거치지 않아도 IDE에 들어갈 수 있게."""
    with socket.socket() as s:
        s.settimeout(0.3)
        return s.connect_ex(("127.0.0.1", 8080)) == 0


def _build_markdown(d: dict) -> str:
    """portfolio_output.json → 내보내기용 Markdown."""
    ov, de, bm, ts, vf = d["overview"], d["data_engineering"], d["benchmarks"], d["troubleshooting"], d["verification"]
    lines = [
        f"# {ov['title']}",
        "",
        f"- 기반 모델: {ov['base_model']}",
        f"- 태스크: {ov['task_type']}",
        f"- 하드웨어: {vf['hardware']}",
        f"- 검증 엔진: plAI-ground / DiffStack v1.0",
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


_RUNS_DIR = TELEMETRY_DIR / "runs"
_OUTPUT_DIR = OUTPUT_DIR


def _telemetry_path(run: str) -> Path:
    return (_RUNS_DIR / f"{run}.json") if run else (TELEMETRY_DIR / "raw_telemetry.json")


def _output_path(run: str, ext: str) -> Path:
    return (_OUTPUT_DIR / f"{run}.{ext}") if run else (_OUTPUT_DIR / f"portfolio_output.{ext}")


def _list_runs() -> list[dict]:
    """실행 이력 — 최신순. 모델별 포트폴리오를 따로 고르기 위한 목록."""
    if not _RUNS_DIR.exists():
        return []
    runs = []
    for f in _RUNS_DIR.glob("*.json"):
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
            "has_portfolio": (_OUTPUT_DIR / f"{rid}.json").exists(),
        })
    return sorted(runs, key=lambda r: r["saved_at"], reverse=True)


def _telemetry_summary(run: str = "") -> dict:
    """포트폴리오 화면 상단 지표용 — 원본 JSON에서 가벼운 필드만 추린다."""
    path = _telemetry_path(run)
    if not path.exists():
        return {"exists": False, "run_id": run}
    data = json.loads(path.read_text(encoding="utf-8"))
    return {
        "exists": True,
        "run_id": data.get("run_id", run),
        "saved_at": data.get("saved_at", ""),
        "overview": data.get("overview", {}),
        "dataset": data.get("dataset", {}),
        "benchmarks": data.get("benchmarks", {}),
        "error_count": len(data.get("error_history", [])),
        "script_diff": data.get("script_diff", ""),  # 실패 스냅샷 vs 성공본 실제 diff
        "last_error_type": (data.get("last_error") or {}).get("error_type", ""),
        "output_exists": _output_path(run, "html").exists(),
        "data_exists": _output_path(run, "json").exists(),
    }


def _run_of(route) -> str:
    return parse_qs(route.query).get("run", [""])[0]


class _Handler(_BaseHandler):
    def do_GET(self) -> None:  # noqa: N802 (stdlib 규약)
        route = urlparse(self.path)
        if route.path == "/api/community/posts":
            self._send_json(community.list_posts())
        elif route.path == "/api/community/comments":
            try:
                self._send_json(community.list_comments(parse_qs(route.query).get("post_id", [""])[0]))
            except KeyError as exc:
                self._send_json({"error": str(exc)}, status=404)
        elif route.path == "/api/portfolio/runs":
            self._send_json(_list_runs())
        elif route.path == "/api/portfolio/run":
            qs = parse_qs(route.query)
            self._stream_portfolio_run(qs.get("mode", [""])[0], qs.get("run", [""])[0])
        elif route.path == "/api/ide/status":
            self._send_json({"running": _ide_running(), "ide_url": _IDE_URL})
        elif route.path == "/api/portfolio/export.md":
            self._send_portfolio_md(_run_of(route))
        elif route.path == "/api/portfolio/data":
            self._send_portfolio_data(_run_of(route))
        elif route.path == "/api/portfolio/output":
            self._send_portfolio_html(_run_of(route))
        elif route.path == "/api/portfolio/telemetry":
            self._send_json(_telemetry_summary(_run_of(route)))
        elif route.path.startswith("/api/"):
            super().do_GET()
        elif not _STATIC_DIR.exists():
            self._send_json(
                {"error": "프론트엔드 빌드가 없습니다. apps/web에서 'npm run build'를 먼저 실행하세요."},
                status=503,
            )
        else:
            super().do_GET()

    def do_POST(self) -> None:  # noqa: N802 (stdlib 규약)
        route = urlparse(self.path)
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0)) or 0) or b"{}")
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._send_json({"error": "잘못된 JSON 본문입니다 (UTF-8 인코딩 필요)."}, status=400)
            return
        try:
            if route.path == "/api/community/interact":
                self._send_json(community.interact(body.get("post_id", ""), body.get("action", "")))
            elif route.path == "/api/community/practice":
                self._send_json(community.stage_practice(body.get("post_id", "")))
            elif route.path == "/api/community/comment":
                self._send_json(community.add_comment(body.get("post_id", ""), body.get("author", ""), body.get("text", "")))
            else:
                self._send_json({"error": "알 수 없는 엔드포인트입니다."}, status=404)
        except (KeyError, ValueError) as exc:
            self._send_json({"error": str(exc)}, status=400)

    def _send_portfolio_md(self, run: str = "") -> None:
        path = _output_path(run, "json")
        if not path.exists():
            self._send_json({"error": "포트폴리오가 아직 생성되지 않았습니다."}, status=404)
            return
        body = _build_markdown(json.loads(path.read_text(encoding="utf-8"))).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/markdown; charset=utf-8")
        self.send_header("Content-Disposition", f'attachment; filename="plaiground_portfolio{"_" + run if run else ""}.md"')
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_portfolio_data(self, run: str = "") -> None:
        """렌더러가 저장한 포트폴리오 스키마 JSON — 프론트엔드 네이티브 렌더링용."""
        path = _output_path(run, "json")
        if not path.exists():
            self._send_json({"error": "포트폴리오가 아직 생성되지 않았습니다. 먼저 파이프라인을 실행하세요."}, status=404)
            return
        self._send_json(json.loads(path.read_text(encoding="utf-8")))

    def _send_portfolio_html(self, run: str = "") -> None:
        path = _output_path(run, "html")
        if not path.exists():
            self._send_json({"error": "포트폴리오가 아직 생성되지 않았습니다. 먼저 파이프라인을 실행하세요."}, status=404)
            return
        body = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _stream_portfolio_run(self, mode: str = "", run: str = "") -> None:
        """포트폴리오 파이프라인을 서브프로세스로 돌리고 stdout을 SSE로 흘린다.

        - 기본: Web IDE 학습이 남긴 실제 텔레메트리(raw_telemetry.json)로 생성
          (generate_real_portfolio). 텔레메트리가 없으면 데모 파이프라인으로 폴백.
        - mode=demo: 강제로 run_demo (가상 OOM + 데모 수치로 텔레메트리를 덮어쓴다).
        서브프로세스로 격리하는 이유: run_demo가 sys.excepthook을 갈아끼우기 때문.
        """
        has_real = _telemetry_path(run).exists()
        use_demo = mode == "demo" or not has_real
        module = "plaiground_host.portfolio.run_demo" if use_demo else "plaiground_host.portfolio.generate_real_portfolio"
        extra = [] if use_demo or not run else ["--run", run]
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()

        # 파이프로 연결된 파이썬은 stdout을 블록 버퍼링해 종료 때까지 한 줄도 안 보낸다.
        # 재시도 대기(최대 50초)까지 겹치면 화면이 멈춘 것처럼 보이므로 무버퍼로 강제한다.
        env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUNBUFFERED": "1"}
        self._sse("log", f"[source] {'데모 파이프라인 (가상 데이터)' if use_demo else '실제 학습 텔레메트리 (' + _telemetry_path(run).name + ')'}")
        proc = subprocess.Popen(
            [sys.executable, "-m", module, *extra],
            cwd=_REPO_ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=env,
        )
        try:
            for line in proc.stdout:
                if "automatic function calling" in line:  # Gemini SDK 경고 — 사용자에게 의미 없음
                    continue
                self._sse("log", line.rstrip())
            code = proc.wait()
            if code == 0:
                # 데모는 새 run_id를 만드므로 최신 run을 되돌려 준다
                rid = run if (run and not use_demo) else ((_list_runs() or [{}])[0].get("run_id", "") if use_demo else "")
                self._sse("ready", {"output_url": "/api/portfolio/output", "run_id": rid, "telemetry": _telemetry_summary(rid)})
            else:
                self._sse("error", "LLM 호출이 실패해 생성을 중단했습니다 — 위 로그의 마지막 줄에 이유(과부하/할당량)가 있습니다." if code == 2
                          else f"파이프라인이 종료 코드 {code}로 실패했습니다. 서버 로그를 확인하세요.")
        except (BrokenPipeError, ConnectionAbortedError):
            proc.kill()  # 브라우저가 탭을 닫음


def serve(port: int = _DEFAULT_PORT) -> None:
    handler = partial(_Handler, directory=str(_STATIC_DIR))
    with ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"plAI-ground 통합 데모 서버: http://127.0.0.1:{port}")
        if not _STATIC_DIR.exists():
            print("  (프론트엔드 미빌드 - apps/web에서 'npm run build' 또는 'npm run dev')")
        print("  중지: Ctrl+C")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n서버 종료")


def demo() -> None:
    summary = _telemetry_summary()
    assert "exists" in summary
    if summary["exists"]:
        assert "benchmarks" in summary and "error_count" in summary
    print(f"api_server.py self-check OK - telemetry exists={summary['exists']}")


if __name__ == "__main__":
    if "--self-check" in sys.argv:
        demo()
    else:
        serve(int(os.environ.get("PLAIGROUND_COMBINE_PORT", _DEFAULT_PORT)))
