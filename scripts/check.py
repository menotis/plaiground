"""
check.py — 1분 안에 끝나는 회귀 점검. Docker와 GPU 없이 돈다.

    python scripts/check.py            # pytest + 프론트 빌드
    python scripts/check.py --skip-web # pytest만

전체 흐름(Start AI → Web IDE → 학습 → 포트폴리오 → View AI)은 이 점검으로 대체되지 않는다.
그건 Docker를 켜고 직접 확인한다. 테스트는 var/ 아래 사용자 데이터를 건드리지 않는다(임시 폴더 사용).
"""

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FAILED: list[str] = []


def run(name: str, cmd: list[str], cwd: Path = ROOT) -> None:
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    ok = r.returncode == 0
    print(f"  {'ok  ' if ok else 'FAIL'}  {name}")
    if not ok:
        FAILED.append(name)
        print((r.stdout + r.stderr)[-1500:])


run("pytest (apps/host, packages/telemetry)",
    [sys.executable, "-m", "pytest", "-q", "apps/host/tests", "packages/telemetry/tests"])

if "--skip-web" not in sys.argv:
    npm = shutil.which("npm") or shutil.which("npm.cmd")
    if npm:
        run("프론트 빌드 (apps/web)", [npm, "run", "build"], cwd=ROOT / "apps" / "web")
    else:
        FAILED.append("npm 없음")
        print("  FAIL  npm을 찾을 수 없음")

print()
if FAILED:
    print(f"실패 {len(FAILED)}건: {', '.join(FAILED)}")
    sys.exit(1)
print("전부 통과")
