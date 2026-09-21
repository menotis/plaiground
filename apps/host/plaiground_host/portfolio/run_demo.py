"""
run_demo.py — DiffStack Engine E2E 원클릭 검증 스크립트.

실행: python -m plaiground_host.portfolio.run_demo

시퀀스:
  1. setup_interceptor() 활성화
  2. 더미 OOM 에러 강제 발생 및 캡처
  3. DiffStackTracker로 가상 데이터 기록
  4. save_run() → .telemetry/raw_telemetry.json 생성
  5. generate_portfolio() → Gemini 1.5 Flash 또는 Mock Fallback
  6. render_portfolio() → portfolio_output.html 생성
  7. ✅ All steps completed successfully!
"""

import io
import json
import sys
from pathlib import Path

# Windows 콘솔 UTF-8 출력 강제
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from plaiground_telemetry import setup_interceptor, DiffStackTracker
from plaiground_host.portfolio.llm import generate_portfolio
from plaiground_host.portfolio.services import render_portfolio


def _simulate_oom_error() -> None:
    """
    OOM 에러를 시뮬레이션하여 interceptor가 캡처하도록 유도.
    sys.excepthook을 직접 호출해 파이프라인을 중단시키지 않음.
    """
    try:
        raise RuntimeError("CUDA out of memory. Tried to allocate 2.50 GiB (GPU 0; 23.70 GiB total capacity; batch_size=64 exceeded VRAM)")
    except RuntimeError:
        exc_type, exc_value, exc_tb = sys.exc_info()
        # excepthook 직접 호출 → last_error.json 저장 (프로세스는 계속)
        sys.excepthook(exc_type, exc_value, exc_tb)
        print("[Step 2] ✅ Dummy OOM error captured and written to .telemetry/last_error.json")


def main() -> None:
    print("=" * 60)
    print("  DiffStack Engine - E2E Demo Pipeline")
    print("=" * 60)

    # Step 1: 인터셉터 활성화
    setup_interceptor()
    print("[Step 1] ✅ sys.excepthook interceptor activated.")

    # Step 2: OOM 에러 시뮬레이션 및 캡처
    _simulate_oom_error()

    # Step 3: 가상 학습 데이터 기록
    tracker = DiffStackTracker(
        project_name="klue/bert-base 한국어 텍스트 분류 파인튜닝 (데모 파이프라인)",
        task_type="텍스트 분류 (파인튜닝)",
    )
    tracker.log_dataset(
        raw_len=50_000,
        processed_len=40_800,
        notes="Whitespace normalization, special char filter, deduplication, max-length truncation (512 tokens)",
        avg_len_before=312.4,
        avg_len_after=197.8,
    )
    tracker.log_benchmarks(
        baseline_dict={"f1": 0.412, "loss": 2.34},
        final_dict={"f1": 0.783, "loss": 1.12},
        params_dict={"base_model": "klue/bert-base", "lr": 2e-5, "epochs": 3, "batch_size": 16, "gradient_accumulation_steps": 4},
    )
    print("[Step 3] ✅ Dataset stats and benchmark metrics logged.")

    # Step 4: 텔레메트리 덤프
    raw_path = tracker.save_run()
    print(f"[Step 4] ✅ Telemetry saved → {raw_path}")

    # Step 5: LLM 포트폴리오 생성
    raw_telemetry = json.loads(raw_path.read_text(encoding="utf-8"))
    schema = generate_portfolio(raw_telemetry)
    print(f"[Step 5] ✅ PortfolioSchema validated: {schema.overview.title}")

    # Step 6: HTML 렌더링
    output_path = render_portfolio(schema, raw_telemetry, run_id=tracker.run_id)
    print(f"[Step 6] ✅ Portfolio HTML rendered → {output_path}")

    print()
    print("=" * 60)
    print("  [OK] All steps completed successfully!")
    print(f"  Open: {output_path.resolve()}")
    print("=" * 60)


if __name__ == "__main__":
    main()
