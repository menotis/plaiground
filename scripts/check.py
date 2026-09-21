"""
check.py — 1분 안에 끝나는 회귀 점검. Docker와 GPU 없이 돈다.

    python scripts/check.py            # 파이썬 점검 + 프론트 빌드
    python scripts/check.py --skip-web # 파이썬 점검만

폴더를 옮기거나 경로·import를 고친 뒤에 돌린다. 전체 흐름(Start AI → Web IDE → 학습 →
포트폴리오 → View AI)은 이 점검으로 대체되지 않는다 — 그건 Docker를 켜고 직접 확인한다.

주의: 이 점검은 var/ 아래 사용자 데이터를 쓰거나 덮어쓰지 않는다. 생성기 점검은 임시 폴더를 쓴다.
"""

import ast
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FAILED: list[str] = []


def check(name: str):
    def deco(fn):
        try:
            detail = fn()
            print(f"  ok    {name}" + (f" — {detail}" if detail else ""))
        except Exception as exc:  # noqa: BLE001 — 점검은 하나가 실패해도 나머지를 계속 돈다
            FAILED.append(name)
            print(f"  FAIL  {name} — {type(exc).__name__}: {exc}")
        return fn
    return deco


print("[python]")


@check("경로 상수")
def _():
    from plaiground_host import paths
    from plaiground_telemetry.paths import TELEMETRY_DIR

    assert paths.REPO_ROOT == ROOT, paths.REPO_ROOT
    assert paths.TELEMETRY_DIR == TELEMETRY_DIR, "호스트와 SDK의 텔레메트리 위치가 다름"
    assert (ROOT / "apps" / "web" / "package.json").is_file()
    return f"var={paths.VAR_DIR.relative_to(ROOT)}"


@check("모델 카탈로그")
def _():
    from plaiground_host.workspace.catalog import ModelCatalog, demo

    demo()
    return f"{len(ModelCatalog.list_models())} models"


@check("학습 스크립트 생성 (임시 폴더)")
def _():
    from plaiground_host.workspace.catalog import ModelCatalog
    from plaiground_host.workspace.generator import generate

    tmp = Path(tempfile.mkdtemp())
    try:
        for spec in ModelCatalog.list_models():
            source = generate(spec, out_dir=tmp).read_text(encoding="utf-8")
            ast.parse(source)
            assert "$" not in source, f"{spec.model_id}: 안 채워진 플레이스홀더"
            assert "from plaiground_telemetry" in source, f"{spec.model_id}: 텔레메트리 import 누락"
            assert "portfolio_demo" not in source and "ai_set_demo" not in source, f"{spec.model_id}: 옛 폴더 이름이 남음"
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


@check("컨테이너 경로 변환")
def _():
    from plaiground_host.paths import GENERATED_DIR
    from plaiground_host.workspace.setup_and_train import _clean, _container_path, _ide_url

    assert _container_path(GENERATED_DIR / "train_x.py") == "/workspace/var/generated/train_x.py"
    assert "folder=/workspace/var/generated" in _ide_url("http://127.0.0.1:8080", "/workspace/var/generated/train_x.py")
    assert _clean("10%|=   | 1/10\r100%|====| 10/10\n") == "100%|====| 10/10"


@check("텔레메트리 기록기 (임시 폴더)")
def _():
    from plaiground_telemetry.recorder import demo

    demo()


@check("커뮤니티 글")
def _():
    from plaiground_host.community.service import list_posts

    posts = list_posts()
    assert len(posts) == 40, len(posts)
    assert all("var/generated/" in p["practice_command"] for p in posts if p.get("practice_command"))
    return "40 posts"


@check("API 서버: 실행 목록·시각화·경로 검증")
def _():
    from plaiground_host import api_server as combined
    from plaiground_host.workspace import api_server as base

    runs = combined._list_runs()
    summary = combined._telemetry_summary(runs[0]["run_id"] if runs else "")
    assert "exists" in summary
    assert base._viz_run_dir("../secret") is None and base._viz_run_dir("a/b") is None
    viz = base._viz_runs()
    if viz:
        run_dir = base._viz_run_dir(viz[0]["run_id"])
        schema = base._viz_schema(run_dir)
        frame = base._viz_frame(run_dir, 0)
        assert frame is not None and len(frame) == schema["frame_numel"] * 4
    return f"runs={len(runs)}, viz_runs={len(viz)}"


@check("포트폴리오 모듈 import")
def _():
    import plaiground_host.portfolio.generate_real_portfolio  # noqa: F401
    from plaiground_host.portfolio.services import renderer

    assert renderer._TEMPLATE_DIR.joinpath("portfolio_template.html").is_file()


@check("옛 폴더 이름이 코드에 남아 있지 않음")
def _():
    old = ("portfolio_demo", "ai_set_demo", "community_demo", "web_combine_demo", "web_demo")
    hits = []
    for base in ("apps/host", "packages", "apps/web/src", "scripts"):
        for p in (ROOT / base).rglob("*"):
            if p.suffix not in {".py", ".tmpl", ".sh", ".jsx", ".js", ".toml"} or "node_modules" in p.parts or p == Path(__file__).resolve():
                continue
            for n, line in enumerate(p.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
                # import/실행 경로에 남은 것만 실패로 본다 — 주석 속 역사 설명은 허용
                if any(f"{o}." in line or f"{o}/" in line for o in old) and not line.lstrip().startswith(("#", "//", "*")):
                    hits.append(f"{p.relative_to(ROOT)}:{n}")
    assert not hits, ", ".join(hits[:8])


if "--skip-web" not in sys.argv:
    print("[web]")

    @check("프론트 빌드 (apps/web)")
    def _():
        npm = shutil.which("npm") or shutil.which("npm.cmd")
        assert npm, "npm을 찾을 수 없음"
        r = subprocess.run([npm, "run", "build"], cwd=ROOT / "apps" / "web", capture_output=True, text=True, encoding="utf-8", errors="replace")
        assert r.returncode == 0, (r.stderr or r.stdout)[-400:]
        assert (ROOT / "apps" / "web" / "dist" / "index.html").is_file()

print()
if FAILED:
    print(f"실패 {len(FAILED)}건: {', '.join(FAILED)}")
    sys.exit(1)
print("전부 통과")
