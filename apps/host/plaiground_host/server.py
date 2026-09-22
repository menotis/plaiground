"""
server.py — GPU 호스트 API 서버. 실행: python -m plaiground_host.server

모든 URL은 아래 ROUTES 표 하나에 있다. 핸들러 메서드는 HTTP 입출력만 하고, 일은 각 모듈이 한다.
  workspace/  환경 감지, 모델 카탈로그, 컨테이너 프로비저닝(SSE)
  viz/        학습 시각화 기록 읽기
  portfolio/  실행 기록·산출물 조회, 생성 파이프라인(SSE)
  community/  글·댓글·상호작용, 실습 코드 스테이징

요청 처리 순서: OPTIONS(CORS 사전 요청) → /api/* 인증(auth.authenticate) → 라우팅 표 → 정적 파일.
stdlib http.server만 쓴다. ThreadingHTTPServer라 SSE 연결 하나가 스레드 하나를 점유한다.

ponytail: 127.0.0.1에만 바인딩. docker와 학습을 실행하므로 0.0.0.0으로 여는 순간 원격 코드 실행이다.
"""

import json
import os
import re
import socket
import subprocess
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from . import settings, viz
from .auth import authenticate
from .community import service as community
from .paths import WEB_DIST
from .portfolio import api as portfolio
from .workspace.catalog import ModelCatalog
from .workspace.setup_and_train import provision
from .workspace.status import status

_VIZ = re.compile(r"^/api/viz/([^/]+)/(schema|rows|frame)$")


def _ide_running() -> bool:
    with socket.socket() as s:
        s.settimeout(0.3)
        return s.connect_ex(("127.0.0.1", settings.IDE_PORT)) == 0


class Handler(SimpleHTTPRequestHandler):
    user: str = ""  # authenticate()가 채운다

    # ── 라우팅 표: (메서드, 경로) → 핸들러 이름. 경로가 정규식이면 match 인자를 받는다 ──
    ROUTES = {
        ("GET", "/api/status"): "get_status",
        ("GET", "/api/models"): "get_models",
        ("GET", "/api/setup"): "stream_setup",
        ("GET", "/api/ide/status"): "get_ide_status",
        ("GET", "/api/viz/runs"): "get_viz_runs",
        ("GET", _VIZ): "get_viz",
        ("GET", "/api/portfolio/runs"): "get_portfolio_runs",
        ("GET", "/api/portfolio/run"): "stream_portfolio_run",
        ("GET", "/api/portfolio/telemetry"): "get_portfolio_telemetry",
        ("GET", "/api/portfolio/data"): "get_portfolio_data",
        ("GET", "/api/portfolio/output"): "get_portfolio_output",
        ("GET", "/api/portfolio/export.md"): "get_portfolio_md",
        ("GET", "/api/community/posts"): "get_posts",
        ("GET", "/api/community/comments"): "get_comments",
        ("POST", "/api/community/interact"): "post_interact",
        ("POST", "/api/community/practice"): "post_practice",
        ("POST", "/api/community/comment"): "post_comment",
    }

    # ── 공통 ──
    def end_headers(self) -> None:
        origin = self.headers.get("Origin", "")
        if origin and origin in settings.ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        super().end_headers()

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Gemini-Key")
        self.send_header("Access-Control-Max-Age", "600")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        self._dispatch("GET")

    def do_POST(self) -> None:  # noqa: N802
        self._dispatch("POST")

    def _dispatch(self, method: str) -> None:
        route = urlparse(self.path)
        if not route.path.startswith("/api/"):
            if method != "GET":
                return self.json({"error": "알 수 없는 엔드포인트입니다."}, 404)
            if not WEB_DIST.exists():
                return self.json({"error": "프론트엔드 빌드가 없습니다. apps/web에서 'npm run build'를 먼저 실행하세요."}, 503)
            return super().do_GET()

        user = authenticate(self.headers)
        if user is None:
            return self.json({"error": "로그인이 필요합니다."}, 401)
        self.user = user

        query = parse_qs(route.query)
        for (m, pat), name in self.ROUTES.items():
            if m != method:
                continue
            if isinstance(pat, str):
                if pat == route.path:
                    return getattr(self, name)(query)
            elif (match := pat.match(route.path)):
                return getattr(self, name)(query, match)
        self.json({"error": "알 수 없는 엔드포인트입니다."}, 404)

    def json(self, payload, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self._bytes(body, "application/json; charset=utf-8", status)

    def _bytes(self, body: bytes, content_type: str, status: int = 200, extra: dict | None = None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _body(self) -> dict | None:
        try:
            return json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0)) or 0) or b"{}")
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.json({"error": "잘못된 JSON 본문입니다 (UTF-8 인코딩 필요)."}, 400)
            return None

    def _sse_begin(self) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()

    def _sse(self, event: str, data) -> None:
        self.wfile.write(f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n".encode())
        self.wfile.flush()

    def log_message(self, fmt: str, *args) -> None:
        # send_error()는 args[0]에 HTTPStatus를 넘긴다 — str()로 감싸지 않으면 404마다 핸들러가 죽는다
        if args and "/api/" in str(args[0]):
            super().log_message(fmt, *args)  # 정적 파일 요청 로그는 소음이라 생략

    # ── workspace ──
    def get_status(self, q) -> None:
        self.json(status())

    def get_models(self, q) -> None:
        self.json([vars(spec) for spec in ModelCatalog.list_models()])

    def get_ide_status(self, q) -> None:
        self.json({"running": _ide_running(), "ide_url": settings.IDE_URL})

    def stream_setup(self, q) -> None:
        """환경 세팅 로그를 SSE로 흘리고, 끝나면 웹 IDE 접속 정보를 ready 이벤트로."""
        model_id = q.get("model_id", [""])[0]
        try:  # 스트림을 열기 전에 검증 — 제너레이터는 지연 실행이라 잘못된 model_id가 200으로 나간다
            ModelCatalog.get_model(model_id)
        except ValueError as exc:
            return self.json({"error": str(exc)}, 400)
        self._sse_begin()
        gen = provision(model_id, host_port=settings.IDE_PORT, user=self.user)
        try:
            while True:
                try:
                    self._sse("log", next(gen))
                except StopIteration as stop:
                    return self._sse("ready", stop.value)
        except (RuntimeError, OSError) as exc:
            self._sse("error", str(exc))
        except BrokenPipeError:
            pass

    # ── viz ──
    def get_viz_runs(self, q) -> None:
        self.json(viz.runs(self.user))

    def get_viz(self, q, match) -> None:
        d = viz.run_dir(match.group(1), self.user)
        if d is None:
            return self.json({"error": "해당 run의 시각화 데이터가 없습니다."}, 404)
        what = match.group(2)
        if what == "schema":
            return self.json(viz.schema(d))
        if what == "rows":
            return self.json(viz.rows(d))
        try:
            index = int(q.get("index", ["0"])[0])
        except ValueError:
            index = -1
        body = viz.frame(d, index)
        if body is None:
            return self.json({"error": "index 범위 밖"}, 404)
        self._bytes(body, "application/octet-stream")

    # ── portfolio ──
    def _run(self, q) -> str:
        return q.get("run", [""])[0]

    def get_portfolio_runs(self, q) -> None:
        self.json(portfolio.list_runs(self.user))

    def get_portfolio_telemetry(self, q) -> None:
        self.json(portfolio.telemetry_summary(self._run(q), self.user))

    def _output(self, q, ext: str):
        path = portfolio.output_path(self._run(q), ext, self.user)
        if path is None or not path.exists():
            self.json({"error": "포트폴리오가 아직 생성되지 않았습니다. 먼저 파이프라인을 실행하세요."}, 404)
            return None
        return path

    def get_portfolio_data(self, q) -> None:
        if path := self._output(q, "json"):
            self.json(json.loads(path.read_text(encoding="utf-8")))

    def get_portfolio_output(self, q) -> None:
        if path := self._output(q, "html"):
            self._bytes(path.read_bytes(), "text/html; charset=utf-8")

    def get_portfolio_md(self, q) -> None:
        if path := self._output(q, "json"):
            run = self._run(q)
            body = portfolio.build_markdown(json.loads(path.read_text(encoding="utf-8"))).encode("utf-8")
            self._bytes(body, "text/markdown; charset=utf-8",
                        extra={"Content-Disposition": f'attachment; filename="plaiground_portfolio{"_" + run if run else ""}.md"'})

    def stream_portfolio_run(self, q) -> None:
        """생성 파이프라인을 서브프로세스로 돌리고 stdout을 SSE로 흘린다. Gemini 키는 헤더로만 받아 env로 넘긴다."""
        run = self._run(q)
        if run and portfolio.telemetry_path(run, self.user) is None:
            return self.json({"error": "잘못된 run 이름입니다."}, 404)
        argv, env, label, use_demo = portfolio.pipeline(run, q.get("mode", [""])[0], self.user,
                                                        gemini_key=self.headers.get("X-Gemini-Key", "").strip())
        self._sse_begin()
        self._sse("log", f"[source] {label}")
        proc = subprocess.Popen(argv, cwd=settings.REPO_ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                text=True, encoding="utf-8", errors="replace", env=env)
        try:
            for line in proc.stdout:
                if "automatic function calling" in line:  # Gemini SDK 경고 — 사용자에게 의미 없음
                    continue
                self._sse("log", line.rstrip())
            code = proc.wait()
            if code == 0:
                rid = run if (run and not use_demo) else ((portfolio.list_runs(self.user) or [{}])[0].get("run_id", "") if use_demo else "")
                self._sse("ready", {"output_url": "/api/portfolio/output", "run_id": rid,
                                    "telemetry": portfolio.telemetry_summary(rid, self.user)})
            else:
                self._sse("error", "LLM 호출이 실패해 생성을 중단했습니다 — 위 로그의 마지막 줄에 이유(과부하/할당량)가 있습니다." if code == 2
                          else f"파이프라인이 종료 코드 {code}로 실패했습니다. 서버 로그를 확인하세요.")
        except (BrokenPipeError, ConnectionAbortedError):
            proc.kill()  # 브라우저가 탭을 닫음

    # ── community ──
    def get_posts(self, q) -> None:
        self.json(community.list_posts())

    def get_comments(self, q) -> None:
        try:
            self.json(community.list_comments(q.get("post_id", [""])[0]))
        except KeyError as exc:
            self.json({"error": str(exc)}, 404)

    def _post(self, fn) -> None:
        if (body := self._body()) is None:
            return
        try:
            self.json(fn(body))
        except (KeyError, ValueError) as exc:
            self.json({"error": str(exc)}, 400)

    def post_interact(self, q) -> None:
        self._post(lambda b: community.interact(b.get("post_id", ""), b.get("action", "")))

    def post_practice(self, q) -> None:
        self._post(lambda b: community.stage_practice(b.get("post_id", ""), user=self.user))

    def post_comment(self, q) -> None:
        self._post(lambda b: community.add_comment(b.get("post_id", ""), b.get("author", ""), b.get("text", "")))


def serve(port: int = settings.PORT) -> None:
    handler = partial(Handler, directory=str(WEB_DIST))
    with ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"plAI-ground 호스트 서버: http://127.0.0.1:{port}  (auth={settings.AUTH}, var={settings.VAR_DIR})")
        if not WEB_DIST.exists():
            print("  (프론트엔드 미빌드 - apps/web에서 'npm run build' 또는 'npm run dev')")
        print("  중지: Ctrl+C")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n서버 종료")


def main() -> None:
    serve()


if __name__ == "__main__":
    main()
