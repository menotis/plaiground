"""plAI-ground Command Line Interface."""

from __future__ import annotations

import sys
from pathlib import Path

import click

from .builder import build_environment
from .gpu_detector import detect_gpu


@click.group()
@click.version_option()
def main():
    """plAI-ground CLI - BYOC AI Development & Execution Engine."""


@main.command()
def detect():
    """Detect local GPU hardware and display optimal PyTorch 2.14.1 configuration."""
    click.echo("\n🔍 plAI-ground 하드웨어 및 PyTorch 최적 빌드 진단\n" + "=" * 55)
    info = detect_gpu()

    click.echo(f"  • GPU 모델명:       {info.name}")
    if info.compute_cap is not None:
        click.echo(f"  • Compute Cap:      sm_{int(info.compute_cap * 10)} ({info.compute_cap})")
    if info.driver_version:
        click.echo(f"  • NVIDIA 드라이버:  v{info.driver_version}")
    click.echo(f"  • 배정 프리셋:      {info.group.upper()} ({info.cuda_tag})")
    click.echo(f"  • PyTorch 버전:     v{info.torch_version}")
    if info.index_url:
        click.echo(f"  • 휠 인덱스 주소:   {info.index_url}")

    click.echo("-" * 55)
    if info.recommend_colab:
        click.secho(f"  💡 {info.status_message}", fg="yellow")
    else:
        click.secho(f"  ✅ {info.status_message}", fg="green")
    click.echo("=" * 55 + "\n")


@main.command()
@click.argument("directory", default=".", type=click.Path())
@click.option("--model", default="custom", help="AI 모델 템플릿 이름 (resnet, yolo, etc.)")
def init(directory: str, model: str):
    """Initialize an isolated uv(venv) environment with tailored PyTorch."""
    target_path = Path(directory).resolve()
    click.echo(f"\n🚀 plAI-ground 환경 초기화 시작: {target_path}")

    gpu_info = detect_gpu()
    click.echo(f"  • 감지된 하드웨어: {gpu_info.name} ({gpu_info.cuda_tag})")
    click.echo("  • uv(venv) 가상환경 및 PyTorch 2.14.1 설치 중...")

    res = build_environment(target_path, gpu_info=gpu_info)
    if res.success:
        click.secho(f"\n{res.message}", fg="green", bold=True)
        click.echo(f"  • 가상환경 경로: {res.venv_dir}")
        click.echo(f"  • 실행 방법:")
        click.echo(f"      cd {res.target_dir}")
        click.echo(f"      {res.activation_cmd}")
        click.echo("      python train.py\n")
    else:
        click.secho(f"\n❌ {res.message}", fg="red", bold=True)
        sys.exit(1)


@main.command()
@click.argument("recipe_code")
def pull(recipe_code: str):
    """Pull model recipe from plAI-ground Web Hub and configure local workspace."""
    click.echo(f"\n📥 레시피 코드 수신: {recipe_code}")
    click.echo("  (Phase 2: Web Hub 레시피 동기화 기능이 연동될 예정입니다.)\n")


@main.command()
@click.argument("post_id")
def fork(post_id: str):
    """Fork community post code and model to local workspace."""
    click.echo(f"\n🍴 커뮤니티 실습 코드 포크: {post_id}")
    click.echo("  (Phase 4: 커뮤니티 Fork & Run 보안 파이프라인이 연동될 예정입니다.)\n")


if __name__ == "__main__":
    main()
