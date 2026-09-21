"""
catalog.py — ModelCatalog: 지원 모델 정의 및 조회.

PLAN.md 섹션 3/5 반영. 모델이 2개뿐이라 YAML/클래스 계층 없이
dict 하드코딩으로 충분 (YAGNI).
"""

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class ModelSpec:
    """모델 1개에 대한 학습 파이프라인 스펙."""

    model_id: str
    task_type: str
    base_model: str
    dataset_name: str
    min_vram_gb: int
    # 모델 브라우저(카테고리/계열 필터)용 메타데이터
    category: str = "기타"          # LLM 파인튜닝 / 텍스트 분류 / 이미지 분류 …
    family: str = "기타"            # Llama / Gemma / BERT / CNN …
    params: str = ""                # 파라미터 규모 표기 (110M, 1.2B, E2B …)
    modality: str = "텍스트"
    access_note: str = ""           # 게이트 모델 등 접근 조건 안내
    extra_requirements: list[str] = field(default_factory=list)
    hyperparameters: dict[str, Any] = field(default_factory=dict)


_CATALOG: dict[str, ModelSpec] = {
    "klue-bert-finetune": ModelSpec(
        model_id="klue-bert-finetune",
        task_type="텍스트 분류 (범용 파인튜닝)",
        base_model="klue/bert-base",
        dataset_name="NSMC 2,000개 서브셋",
        min_vram_gb=4,
        category="텍스트 분류",
        family="BERT",
        params="110M",
        modality="텍스트",
        # torch/transformers/datasets는 base 이미지에 포함.
        # accelerate는 base에 없다 — transformers의 Trainer가 요구한다.
        extra_requirements=["accelerate>=1.1.0"],
        hyperparameters={
            "learning_rate": 2e-5,
            "epochs": 2,
            "batch_size": 16,
            "max_length": 128,
        },
    ),
    "mnist-cnn-lite": ModelSpec(
        model_id="mnist-cnn-lite",
        task_type="이미지 분류 (처음부터 학습)",
        base_model="custom-cnn-2conv",
        dataset_name="torchvision.datasets.MNIST",
        min_vram_gb=0,  # CPU로도 1~2분 내 수렴
        category="이미지 분류",
        family="CNN",
        params="<1M",
        modality="이미지",
        extra_requirements=[],  # torchvision은 base 이미지에 포함
        hyperparameters={
            "learning_rate": 1e-3,
            "epochs": 3,
            "batch_size": 64,
        },
    ),
    "llama32-1b-sft": ModelSpec(
        model_id="llama32-1b-sft",
        task_type="LLM 지시 파인튜닝 (SFT · LoRA)",
        base_model="meta-llama/Llama-3.2-1B",
        dataset_name="KoAlpaca-v1.1a 1,000개 서브셋",
        min_vram_gb=6,
        category="LLM 파인튜닝",
        family="Llama",
        params="1.2B",
        modality="텍스트",
        access_note="게이트 모델 — Hugging Face 라이선스 동의 및 HF_TOKEN 필요",
        extra_requirements=["accelerate>=1.1.0", "peft>=0.11.0"],
        hyperparameters={
            "learning_rate": 2e-4,
            "epochs": 1,
            "batch_size": 4,
            "max_length": 512,
            "lora_r": 8,
        },
    ),
    "gemma4-e2b-sft": ModelSpec(
        model_id="gemma4-e2b-sft",
        task_type="LLM 지시 파인튜닝 (SFT · LoRA)",
        base_model="google/gemma-4-E2B-it",
        dataset_name="NSMC 감성 지시형 1,200개 서브셋",
        min_vram_gb=8,
        category="LLM 파인튜닝",
        family="Gemma",
        params="E2B (실효 ~2B)",
        modality="멀티모달 (텍스트·이미지·오디오 입력)",
        access_note="게이트 모델 — Hugging Face 라이선스 동의 및 HF_TOKEN 필요",
        extra_requirements=["accelerate>=1.1.0", "peft>=0.11.0"],
        hyperparameters={
            "learning_rate": 2e-4,
            "epochs": 1,
            "batch_size": 2,
            "max_length": 384,
            "lora_r": 8,
        },
    ),
}


class ModelCatalog:
    """모델 카탈로그 조회 인터페이스."""

    @staticmethod
    def get_model(model_id: str) -> ModelSpec:
        try:
            return _CATALOG[model_id]
        except KeyError:
            available = ", ".join(_CATALOG)
            raise ValueError(f"알 수 없는 model_id: '{model_id}' (사용 가능: {available})") from None

    @staticmethod
    def list_models() -> list[ModelSpec]:
        return list(_CATALOG.values())


def demo() -> None:
    assert len(ModelCatalog.list_models()) == 4
    assert ModelCatalog.get_model("llama32-1b-sft").family == "Llama"
    assert ModelCatalog.get_model("gemma4-e2b-sft").base_model == "google/gemma-4-E2B-it"
    assert ModelCatalog.get_model("klue-bert-finetune").base_model == "klue/bert-base"
    assert ModelCatalog.get_model("mnist-cnn-lite").min_vram_gb == 0
    try:
        ModelCatalog.get_model("no-such-model")
    except ValueError:
        pass
    else:
        raise AssertionError("존재하지 않는 model_id는 ValueError를 던져야 함")
    print("catalog.py self-check OK")


if __name__ == "__main__":
    demo()
