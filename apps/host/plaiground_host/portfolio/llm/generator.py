"""
generator.py — Gemini 3.6 Flash JSON Mode 포트폴리오 생성 엔진.

GEMINI_API_KEY 없음 / 네트워크 오류 시 Mock Data Fallback으로 자동 전환.
LLM 응답을 PortfolioSchema(Pydantic V2)로 파싱 및 검증.
"""

import json
import os
import time
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

from ..core.schema import PortfolioSchema
from .prompt import SYSTEM_PROMPT, build_user_message

# .env 로드 (plaiground_host/portfolio/.env)
_ENV_PATH = Path(__file__).parent.parent / ".env"
load_dotenv(_ENV_PATH)

# ─── Mock Fallback 데이터 (한국어 기본 제공) ──────────────────────────────────
_MOCK_DATA: dict[str, Any] = {
    "overview": {
        "title": "한국어 NLP 언어 모델 파인튜닝 파이프라인 (CUDA OOM 장애 복구 및 최적화)",
        "base_model": "klue/bert-base",
        "task_type": "개체명 인식 (NER: Named Entity Recognition)",
    },
    "data_engineering": {
        "dataset_name": "KLUE-NER 한국어 데이터셋",
        "preprocessing_techniques": [
            "정규표현식 기반 연속 공백 정규화 및 노이즈 특수문자 제거",
            "토크나이저 최대 시퀀스 길이 제한 (Max Length: 512 토큰)",
            "MD5 해시 기반 중복 및 불완전 문장 정제 필터링",
        ],
        "data_efficiency_impact": (
            "노이즈 및 중복 샘플 18.4%를 정제 제거함. 평균 시퀀스 길이를 312토큰에서 198토큰으로 36.5% 단축시켜 "
            "GPU 메모리 점유율을 대폭 낮추고, 단일 RTX 4090 환경에서 배치 크기 32 학습을 안정적으로 확보함."
        ),
    },
    "benchmarks": {
        "evaluation_metric": "F1-Score (개체명 엔티티 단위 검증)",
        "baseline_performance": 0.412,
        "optimized_performance": 0.783,
        "improvement_rate": "+90.0%",
        "optimization_methods": [
            "선형 학습률 웜업 스케줄러 (Linear Warmup Scheduler)",
            "그래디언트 누적 (Gradient Accumulation, Steps=4)",
            "FP16 혼합 정밀도 학습 (Mixed-Precision Training)",
            "과적합 방지를 위한 레이블 스무딩 (Label Smoothing, ε=0.1)",
        ],
    },
    "troubleshooting": {
        "error_type": "RuntimeError: CUDA out of memory",
        "root_cause": (
            "2번째 에포크 진입 시 배치 크기 64 설정으로 인해 VRAM 한도(24GB)를 초과함. "
            "그래디언트 누적 연산 간 중간 은닉 상태(Hidden States) 캐시가 적시에 해제되지 않고 누적된 것이 근본 원인임."
        ),
        "resolution_diff": (
            "- batch_size = 64 (초기 VRAM 초과 설정)\n"
            "+ batch_size = 16, gradient_accumulation_steps = 4\n"
            "+ 매 누적 사이클 완료 후 torch.cuda.empty_cache() 명시적 호출\n"
            "실효 배치 크기 64를 유지하면서 메모리 피크치를 14.2GB로 40% 이상 절감하여 OOM 완전 해결"
        ),
        "engineering_takeaway": (
            "그래디언트 누적 기법을 적용하면 추가 물리 VRAM 증설 없이도 큰 실효 배치를 안전하게 학습할 수 있음. "
            "모델 학습 전 에포크 평균이 아닌 스텝별 피크 메모리 프로파일링을 선행하는 습관이 매우 중요함."
        ),
    },
    "verification": {
        "hardware": "NVIDIA GeForce RTX 4090 (24GB) / AMD Ryzen 9 7950X",
        "total_training_time": "2시간 34분 17초 (총 3 Epochs 완주)",
        "integrity_hash": "PLACEHOLDER",
    },
}


_RETRY_WAITS = (8, 25, None)  # 무료 등급 일일 한도(20요청)를 아끼기 위해 재시도는 최대 2회


def _call_gemini(telemetry: dict[str, Any]) -> dict[str, Any]:
    """
    Gemini 3.6 Flash를 JSON Mode로 호출.

    Args:
        telemetry: raw telemetry 딕셔너리.

    Returns:
        dict: LLM 응답 JSON.

    Raises:
        Exception: API 호출 실패 시 상위로 전파.
    """
    from google import genai  # noqa: PLC0415
    from google.genai import types  # noqa: PLC0415

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("GEMINI_API_KEY가 설정되지 않았습니다.")

    # 요청당 90초 상한(ms 단위). 없으면 서버가 응답을 안 줄 때 영원히 매달린다.
    client = genai.Client(api_key=api_key, http_options=types.HttpOptions(timeout=90_000))
    model = os.getenv("GEMINI_MODEL", "gemini-3.6-flash").strip() or "gemini-3.6-flash"

    # 503 UNAVAILABLE(과부하)·429(할당량)는 일시적이라 지수 백오프로 재시도한다.
    last_exc: Exception | None = None
    for attempt, wait in enumerate(_RETRY_WAITS, start=1):
        try:
            response = client.models.generate_content(
                model=model,
                contents=build_user_message(telemetry),
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",
                ),
            )
            return json.loads(response.text)
        except Exception as exc:  # noqa: BLE001 — SDK 예외 계층이 버전마다 달라 문자열로 판별
            last_exc = exc
            msg = str(exc)
            # 일일 한도 소진: 재시도가 곧 할당량 낭비. 바로 사람이 읽을 수 있는 메시지로 중단.
            if "429" in msg and ("PerDay" in msg or "per day" in msg.lower()):
                raise RuntimeError(
                    f"Gemini 무료 등급 일일 할당량 소진 (모델 {model}). 한국시간 다음날 16시(태평양 자정)에 초기화됩니다. "
                    "apps/host/plaiground_host/portfolio/.env 의 GEMINI_MODEL 을 할당량이 남은 다른 모델로 바꾸거나, 결제(유료 등급)를 켜면 즉시 재개됩니다."
                ) from exc
            transient = any(k in msg for k in ("503", "UNAVAILABLE", "429", "RESOURCE_EXHAUSTED", "overloaded"))
            if not transient or wait is None:
                raise
            print(f"[LLM] 일시 장애({msg[:60]}...) — {wait}초 후 재시도 ({attempt}/{len(_RETRY_WAITS) - 1})")
            time.sleep(wait)
    raise last_exc  # 도달하지 않지만 타입 체커용


def _collapse_repeated_errors(telemetry: dict[str, Any]) -> dict[str, Any]:
    """같은 에러(유형+메시지)가 연속으로 반복되면 하나로 묶고 occurrences에 횟수를 남긴다.

    학생이 고치기 전에 재실행하면 동일 에러가 여러 번 쌓이는데, 포트폴리오에서는
    "에러 하나 = 원인 하나"여야 한다. 원본 파일은 건드리지 않고 LLM 입력만 정리한다.
    """
    history = telemetry.get("error_history") or []
    collapsed: list[dict[str, Any]] = []
    for e in history:
        key = (e.get("error_type"), (e.get("error_message") or "")[:200])
        if collapsed and (collapsed[-1].get("error_type"), (collapsed[-1].get("error_message") or "")[:200]) == key:
            collapsed[-1]["occurrences"] = collapsed[-1].get("occurrences", 1) + 1
            continue
        collapsed.append({**e, "occurrences": 1})
    if len(collapsed) == len(history):
        return telemetry
    return {**telemetry, "error_history": collapsed}


def generate_portfolio(telemetry: dict[str, Any], allow_mock: bool = True) -> PortfolioSchema:
    """
    텔레메트리 데이터로 포트폴리오 스키마를 생성.

    Gemini API 호출을 시도하고 실패 시 Mock Fallback을 반환.
    allow_mock=False(실제 학습 실행)면 폴백 대신 RuntimeError — 가짜 서사에
    검증 해시가 찍히는 일을 막는다.

    Args:
        telemetry: raw_telemetry.json 내용.

    Returns:
        PortfolioSchema: Pydantic V2 검증 완료 포트폴리오 객체.
    """
    telemetry = _collapse_repeated_errors(telemetry)
    try:
        print(f"[LLM] {os.getenv('GEMINI_MODEL', 'gemini-3.6-flash')} 호출 중... (응답까지 보통 20~60초)")
        raw = _call_gemini(telemetry)
        schema = PortfolioSchema.model_validate(raw)
        print("[LLM] ✅ Gemini 응답 파싱 및 Pydantic 검증 완료.")
        return _backfill_overview(schema, telemetry)
    except Exception as e:
        if not allow_mock:
            raise RuntimeError(
                f"Gemini 호출 실패 ({str(e)[:120]}). 실제 학습 결과에는 Mock 서사를 쓰지 않습니다 — "
                "잠시 후 '포트폴리오 생성 실행'을 다시 눌러 주세요."
            ) from e
        print(f"[LLM] 경고: Gemini 호출 실패 ({e}). 데모용 Mock 데이터로 전환합니다.")
        return _backfill_overview(PortfolioSchema.model_validate(_MOCK_DATA), telemetry)


def _backfill_overview(schema: PortfolioSchema, telemetry: dict[str, Any]) -> PortfolioSchema:
    """LLM이 'N/A'로 비운 개요 필드를 텔레메트리 실측값으로 채운다.

    텔레메트리에 이미 있는 사실이 N/A로 렌더링되는 것을 막는 최종 방어선.
    """
    ov = telemetry.get("overview", {}) or {}
    hp = (telemetry.get("benchmarks", {}) or {}).get("hyperparameters", {}) or {}
    fallbacks = {
        "title": ov.get("project_name"),
        "base_model": hp.get("base_model") or ov.get("project_name"),
        "task_type": ov.get("task_type"),
    }
    for field, value in fallbacks.items():
        if value and str(getattr(schema.overview, field, "")).strip() in ("", "N/A", "n/a"):
            setattr(schema.overview, field, value)
    return schema


# 호환성을 위한 alias
generate_portfolio_json = generate_portfolio

