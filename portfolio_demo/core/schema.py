"""
schema.py — Pydantic V2 포트폴리오 데이터 스키마.

LLM 출력 및 텔레메트리 데이터의 최종 계약(Contract) 역할.
모든 모델은 Pydantic V2 문법(model_dump, model_validate)을 준수.
"""

from typing import List
from pydantic import BaseModel, Field


class ProjectOverview(BaseModel):
    """프로젝트 기본 정보."""

    title: str = Field(..., description="프로젝트 제목")
    base_model: str = Field(..., description="사용된 베이스 모델명 (e.g. BERT, LLaMA-3)")
    task_type: str = Field(..., description="태스크 유형 (e.g. Text Classification, NER)")


class DataEngineering(BaseModel):
    """데이터 전처리 및 엔지니어링 내역."""

    dataset_name: str = Field(..., description="데이터셋 이름")
    preprocessing_techniques: List[str] = Field(
        ..., description="적용된 전처리 기법 목록"
    )
    data_efficiency_impact: str = Field(
        ..., description="데이터 정제 효과 요약 (e.g. '노이즈 30% 제거로 F1 +0.12 향상')"
    )


class PerformanceBenchmarks(BaseModel):
    """베이스라인 vs 최적화 후 성능 비교."""

    evaluation_metric: str = Field(..., description="평가 지표명 (e.g. F1-Score, Perplexity)")
    baseline_performance: float = Field(..., description="파인튜닝 전 성능 수치")
    optimized_performance: float = Field(..., description="파인튜닝 후 성능 수치")
    improvement_rate: str = Field(..., description="향상률 표현 (e.g. '+47.6%')")
    optimization_methods: List[str] = Field(
        ..., description="적용된 최적화 기법 목록"
    )


class ErrorItem(BaseModel):
    """에러 하나 = 원인 하나 = 해결 하나."""

    error_type: str = Field(..., description="에러 유형과 메시지 (e.g. KeyError: 'text')")
    cause: str = Field(..., description="이 에러 하나의 원인 (한국어 1~2문장)")
    fix: str = Field(..., description="이 에러를 고친 방법 (한국어 1문장)")


class TroubleshootingNarrative(BaseModel):
    """에러 발생 → 해결 서사 (STAR 구조)."""

    errors: List[ErrorItem] = Field(default_factory=list, description="발생 순서대로, 에러당 한 항목")
    error_type: str = Field(..., description="에러 유형 (e.g. OOMError, ValueError)")
    root_cause: str = Field(..., description="근본 원인 분석")
    resolution_diff: str = Field(..., description="해결책 코드 Diff 요약")
    engineering_takeaway: str = Field(..., description="엔지니어링 교훈")


class VerificationMeta(BaseModel):
    """무결성 검증 메타데이터."""

    hardware: str = Field(..., description="실행 하드웨어 (e.g. 'NVIDIA RTX 4090')")
    total_training_time: str = Field(..., description="총 학습 소요 시간")
    integrity_hash: str = Field(..., description="SHA-256 무결성 해시")


class PortfolioSchema(BaseModel):
    """포트폴리오 최상위 컨테이너 — 모든 섹션 포함."""

    overview: ProjectOverview
    data_engineering: DataEngineering
    benchmarks: PerformanceBenchmarks
    troubleshooting: TroubleshootingNarrative
    verification: VerificationMeta
