"""
setup_and_train.py — Orchestrator (CLI 진입점).

PLAN.md 섹션 3/4/7-5. 모듈이 아니라 조립 지점이라 추상화 없이 단일 함수.

카탈로그 조회 → 컨테이너 준비 → 스크립트 생성 → 컨테이너 안에서 실행.

학습을 호스트가 아니라 컨테이너 안(`docker exec`)에서 돌리는 이유:
어댑터 D의 전제가 "사용자 호스트에 torch/transformers가 없어도 된다"는 것이다.
호스트에서 돌리면 프로비저닝이 의미가 없어진다. 레포 루트가 /workspace로
bind mount 되어 있으므로 tracker가 쓰는 var/telemetry/ 는
호스트 쪽 같은 폴더에 그대로 떨어진다 (기존 포트폴리오 파이프라인이 이어받음).
"""

import argparse
import json
import re
import subprocess
import sys
from collections.abc import Iterator
from pathlib import Path, PurePosixPath
from urllib.parse import quote

from ..paths import GENERATED_DIR, REPO_ROOT
from .catalog import ModelCatalog
from .generator import generate
from .provisioner import ensure_ready

_REPO_ROOT = REPO_ROOT
_ANSI = re.compile(r"\x1b\[[0-9;]*[a-zA-Z]")


def _container_path(host_path: Path) -> str:
    """레포 루트 기준 호스트 경로를 컨테이너 안 /workspace 경로로 변환."""
    return f"/workspace/{host_path.resolve().relative_to(_REPO_ROOT).as_posix()}"


def _clean(line: str) -> str:
    """터미널 제어문자 정리. tqdm은 \\r로 같은 줄을 덮어쓰므로 마지막 상태만 남긴다."""
    return _ANSI.sub("", line.rstrip("\n").split("\r")[-1])


def _ide_url(base_url: str, script_container_path: str) -> str:
    """code-server가 생성된 스크립트를 바로 열도록 folder/payload 쿼리를 붙인다."""
    folder = str(PurePosixPath(script_container_path).parent)
    host = base_url.split("//", 1)[-1]
    payload = json.dumps([["openFile", f"vscode-remote://{host}{script_container_path}"]])
    return f"{base_url}/?folder={quote(folder)}&payload={quote(payload)}"


def provision(model_id: str, host_port: int = 8080) -> Iterator[str]:
    """
    환경 세팅과 스크립트 생성까지만 수행한다 (학습은 하지 않는다).

    로그를 한 줄씩 yield하고, 끝나면 웹 IDE 접속 정보를 담은 dict를 return한다
    (제너레이터의 return 값이므로 `StopIteration.value`로 받는다).

    Args:
        model_id: ModelCatalog에 등록된 모델 id.
        host_port: code-server를 노출할 호스트 포트.
    """
    spec = ModelCatalog.get_model(model_id)
    yield f"[1/3] 모델: {spec.model_id} ({spec.task_type}, base={spec.base_model})"
    yield "[2/3] 컨테이너 준비 중 (이미지 확인 · GPU 감지 · 모델별 패키지 설치)..."

    report = ensure_ready(spec, host_port=host_port)
    for warning in report.warnings:
        yield f"  경고: {warning}"
    gpu = "GPU 사용" if report.gpu_available else "CPU 전용"
    yield f"      환경 준비 완료 ({gpu})"

    script = generate(spec)
    container_path = _container_path(script)
    yield f"[3/3] 학습 스크립트 생성: {script.name}"
    yield f"      웹 IDE에서 열기: {report.url}"

    return {
        "model_id": spec.model_id,
        "gpu_available": report.gpu_available,
        "container_id": report.container_id,
        "base_url": report.url,
        "ide_url": _ide_url(report.url, container_path),
        "script_name": script.name,
        "script_path": container_path,
        # PYTHONPATH는 컨테이너에 이미 박혀 있으므로 경로만 주면 실행된다.
        "run_command": f"python {container_path.removeprefix('/workspace/')}",
    }


def run_pipeline(model_id: str, host_port: int = 8080) -> Iterator[str]:
    """
    환경 준비부터 학습까지 한 번에 실행하며 로그를 한 줄씩 내보낸다 (CLI 경로).

    웹 데모는 provision()으로 세팅만 하고 학습은 사용자가 IDE에서 직접 돌린다.
    학습이 실패하면 RuntimeError를 던진다.
    """
    setup = yield from provision(model_id, host_port)
    yield f"      컨테이너에서 학습을 실행합니다: {setup['run_command']}"

    proc = subprocess.Popen(
        [
            "docker", "exec",
            "-e", "PYTHONUNBUFFERED=1",
            "-w", "/workspace",
            setup["container_id"],
            "python", setup["script_path"],
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
    )
    assert proc.stdout is not None
    for line in proc.stdout:
        yield _clean(line)
    if proc.wait() != 0:
        raise RuntimeError(
            f"학습 실패 (exit {proc.returncode}). "
            f"에러는 var/telemetry/last_error.json에 기록되어 있습니다."
        )

    yield "완료. 텔레메트리: var/telemetry/raw_telemetry.json"
    yield f"웹 IDE는 계속 떠 있습니다: {setup['base_url']}"
    yield "컨테이너 정리: docker rm -f plaiground-workspace"


def setup_and_train(model_id: str, host_port: int = 8080, setup_only: bool = False) -> None:
    """파이프라인 로그를 그대로 콘솔에 흘려보내는 CLI 래퍼."""
    sys.stdout.reconfigure(line_buffering=True)
    gen = provision(model_id, host_port) if setup_only else run_pipeline(model_id, host_port)
    try:
        while True:
            try:
                print(next(gen))
            except StopIteration as stop:
                if stop.value:
                    print(f"\n웹 IDE에서 이어서 실행하세요: {stop.value['ide_url']}")
                    print(f"  IDE 터미널에서: {stop.value['run_command']}")
                break
    except RuntimeError as exc:
        raise SystemExit(f"\n{exc}") from None


def main() -> None:
    parser = argparse.ArgumentParser(description="모델 하나 골라 환경 세팅부터 학습까지 원클릭 실행")
    parser.add_argument("model_id", nargs="?", help="학습할 모델 id (--list로 목록 확인)")
    parser.add_argument("--list", action="store_true", help="지원 모델 목록 출력")
    parser.add_argument("--port", type=int, default=8080, help="code-server 호스트 포트 (기본 8080)")
    parser.add_argument(
        "--setup-only",
        action="store_true",
        help="환경 세팅과 스크립트 생성까지만 하고 학습은 웹 IDE에서 직접 실행",
    )
    args = parser.parse_args()

    if args.list or not args.model_id:
        for spec in ModelCatalog.list_models():
            vram = f"{spec.min_vram_gb}GB+" if spec.min_vram_gb else "GPU 불필요"
            print(f"  {spec.model_id:<22} {spec.task_type} / {spec.dataset_name} ({vram})")
        if not args.model_id:
            sys.exit(0 if args.list else 1)
        return

    setup_and_train(args.model_id, host_port=args.port, setup_only=args.setup_only)


def demo() -> None:
    # Docker 없이 검증 가능한 부분: 경로 변환과 카탈로그 연결.
    script = GENERATED_DIR / "train_mnist_cnn_lite.py"  # 생성은 하지 않는다 — 사용자가 고친 스크립트 보호
    assert _container_path(script) == "/workspace/var/generated/train_mnist_cnn_lite.py"
    # tqdm이 \r로 덮어쓴 진행바는 마지막 상태만, ANSI 색상코드는 제거.
    assert _clean("10%|=   | 1/10\r100%|====| 10/10\n") == "100%|====| 10/10"
    assert _clean("\x1b[1mBOLD\x1b[0m\n") == "BOLD"
    # IDE URL은 스크립트가 든 폴더를 열고 그 파일을 바로 띄워야 한다.
    url = _ide_url("http://127.0.0.1:8080", "/workspace/var/generated/train_x.py")
    assert "folder=/workspace/var/generated" in url, url
    assert "openFile" in url and "train_x.py" in url, url
    try:
        setup_and_train("no-such-model")
    except ValueError:
        pass
    else:
        raise AssertionError("존재하지 않는 model_id는 컨테이너를 띄우기 전에 ValueError를 던져야 함")
    print("setup_and_train.py self-check OK")


if __name__ == "__main__":
    main()
