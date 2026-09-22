"""호스트 서버 점검. Docker·GPU·네트워크 없이 돈다. 사용자 데이터(var/)를 쓰지 않는다."""

import ast
import json
import threading
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path

import pytest


@pytest.fixture(scope="module")
def var(tmp_path_factory, monkeypatch_module):
    """PLAIGROUND_VAR_DIR 을 임시 폴더로 바꾼 뒤 모듈을 새로 읽는다."""
    d = tmp_path_factory.mktemp("var")
    monkeypatch_module.setenv("PLAIGROUND_VAR_DIR", str(d))
    monkeypatch_module.setenv("PLAIGROUND_ALLOWED_ORIGINS", "https://ok.example")
    monkeypatch_module.delenv("PLAIGROUND_AUTH", raising=False)
    import importlib

    import plaiground_host.settings as s

    importlib.reload(s)
    import plaiground_host.paths as p

    importlib.reload(p)
    assert p.VAR_DIR == d
    return d


@pytest.fixture(scope="module")
def monkeypatch_module():
    from _pytest.monkeypatch import MonkeyPatch

    mp = MonkeyPatch()
    yield mp
    mp.undo()


def test_safe_name():
    from plaiground_host.paths import safe_name

    assert safe_name("mnist_cnn_lite_20260921-061402")
    for bad in ("../x", "a/b", ".hidden", "", "a\\b", "x" * 200):
        assert safe_name(bad) is None, bad


def test_generate_all_templates(tmp_path):
    from plaiground_host.workspace.catalog import ModelCatalog
    from plaiground_host.workspace.generator import generate

    for spec in ModelCatalog.list_models():
        src = generate(spec, out_dir=tmp_path).read_text(encoding="utf-8")
        ast.parse(src)
        assert "$" not in src and "from plaiground_telemetry" in src


def test_container_paths():
    from plaiground_host.paths import workspace_dir
    from plaiground_host.workspace.setup_and_train import _clean, _container_path, _ide_url

    ws = workspace_dir("u1")
    assert _container_path(ws / "train_x.py", ws) == "/workspace/train_x.py"
    assert "folder=/workspace" in _ide_url("http://127.0.0.1:8080", "/workspace/train_x.py")
    assert _clean("10%|=\r100%|====\n") == "100%|===="


def test_portfolio_pipeline_env_not_argv():
    from plaiground_host.portfolio import api

    argv, env, _, use_demo = api.pipeline("", "", "u1", gemini_key="SECRET")
    assert env["GEMINI_API_KEY"] == "SECRET" and "SECRET" not in " ".join(argv)
    assert env["PLAIGROUND_USER"] == "u1" and env["PLAIGROUND_TELEMETRY_DIR"].endswith(str(Path("u1") / ".telemetry"))
    assert use_demo  # 텔레메트리가 없으면 데모
    assert api.telemetry_path("../x") is None and api.output_path("a/b", "json") is None


def test_routes_table():
    from plaiground_host import server

    for (method, pat), name in server.Handler.ROUTES.items():
        assert method in ("GET", "POST") and callable(getattr(server.Handler, name)), name


@pytest.fixture(scope="module")
def client(var):
    from functools import partial

    from plaiground_host import server

    httpd = ThreadingHTTPServer(("127.0.0.1", 0), partial(server.Handler, directory=str(var)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield lambda: HTTPConnection("127.0.0.1", httpd.server_address[1], timeout=5)
    httpd.shutdown()


def _get(client, path, headers=None):
    c = client()
    c.request("GET", path, headers=headers or {})
    r = c.getresponse()
    return r.status, dict(r.getheaders()), r.read()


def test_server_routes_and_guards(client):
    status, _, body = _get(client, "/api/models")
    assert status == 200 and json.loads(body)[0]["model_id"]
    assert _get(client, "/api/viz/..%2Fsecret/schema")[0] == 404
    assert _get(client, "/api/portfolio/data?run=..%2Fx")[0] == 404
    assert _get(client, "/api/nope")[0] == 404
    assert _get(client, "/api/portfolio/runs")[0] == 200  # 빈 var 에서도 200 []


def test_cors_only_for_allowed_origin(client):
    _, h, _ = _get(client, "/api/models", {"Origin": "https://ok.example"})
    assert h.get("Access-Control-Allow-Origin") == "https://ok.example"
    _, h, _ = _get(client, "/api/models", {"Origin": "https://evil.example"})
    assert "Access-Control-Allow-Origin" not in h
    c = client()
    c.request("OPTIONS", "/api/models", headers={"Origin": "https://ok.example"})
    r = c.getresponse()
    assert r.status == 204 and "X-Gemini-Key" in r.getheader("Access-Control-Allow-Headers")


def test_auth_required_when_supabase(monkeypatch):
    from plaiground_host import auth, settings

    monkeypatch.setattr(settings, "AUTH", "supabase")
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://example.invalid")
    monkeypatch.setattr(settings, "SUPABASE_ANON_KEY", "anon")
    assert auth.authenticate({}) is None
    assert auth.authenticate({"Authorization": "Bearer short"}) is None
    monkeypatch.setattr(auth, "_lookup", lambda tok: "user-123")
    assert auth.authenticate({"Authorization": "Bearer " + "t" * 40}) == "user-123"
    monkeypatch.setattr(auth, "_lookup", lambda tok: pytest.fail("캐시를 써야 한다"))
    assert auth.authenticate({"Authorization": "Bearer " + "t" * 40}) == "user-123"


def test_no_old_folder_names_in_code():
    """옛 폴더 이름이 import/실행 경로에 남아 있으면 이동이 덜 끝난 것이다 (주석은 허용)."""
    root = Path(__file__).resolve().parents[3]
    old = ("portfolio_demo", "ai_set_demo", "community_demo", "web_combine_demo", "web_demo")
    hits = []
    for base in ("apps/host", "packages", "apps/web/src", "scripts"):
        for p in (root / base).rglob("*"):
            if p.suffix not in {".py", ".tmpl", ".sh", ".jsx", ".js", ".toml"} or "node_modules" in p.parts or "tests" in p.parts:
                continue
            for n, line in enumerate(p.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
                if any(f"{o}." in line or f"{o}/" in line for o in old) and not line.lstrip().startswith(("#", "//", "*")):
                    hits.append(f"{p.relative_to(root)}:{n}")
    assert not hits, hits[:8]
