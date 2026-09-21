"""
generator.py — BoilerplateGenerator: ModelSpec을 템플릿에 채워 실행 가능한 학습 스크립트를 만든다.

PLAN.md 섹션 3/7-4 반영. 템플릿 엔진은 stdlib string.Template —
프로젝트에 Jinja2가 이미 있지만, 생성 대상이 파이썬 소스라서
리터럴 중괄호(dict, f-string)와 충돌한다. $placeholder 문법이 충돌이 없다.

"코드 생성"과 "실행"을 분리했기 때문에, 이 모듈은 무거운 의존성(torch 등)
없이 생성된 문자열만 검사하는 것으로 테스트가 끝난다 (PLAN.md 섹션 8).
"""

import ast
from pathlib import Path
from string import Template

from ..paths import GENERATED_DIR
from .catalog import ModelCatalog, ModelSpec

_TEMPLATE_DIR = Path(__file__).resolve().parent / "templates"
_DEFAULT_OUT_DIR = GENERATED_DIR


def generate(spec: ModelSpec, out_dir: Path = _DEFAULT_OUT_DIR) -> Path:
    """
    spec에 맞는 템플릿을 채워 out_dir에 .py로 저장하고 그 경로를 반환한다.

    템플릿 파일명은 model_id에서 유도한다
    (klue-bert-finetune -> templates/klue_bert_finetune.py.tmpl).

    Args:
        spec: ModelCatalog에서 조회한 ModelSpec.
        out_dir: 생성 스크립트 출력 디렉터리 (기본 var/generated).

    Returns:
        생성된 .py 파일 경로.
    """
    stem = spec.model_id.replace("-", "_")
    tmpl_path = _TEMPLATE_DIR / f"{stem}.py.tmpl"
    if not tmpl_path.exists():
        raise FileNotFoundError(f"'{spec.model_id}'용 템플릿이 없습니다: {tmpl_path}")

    values = {
        "project_name": f"{spec.base_model} 기반 {spec.task_type}",
        "task_type": spec.task_type,
        "base_model": spec.base_model,
        **spec.hyperparameters,
    }
    # safe_substitute가 아니라 substitute — 안 채워진 자리가 있으면 조용히 넘어가지 않고 KeyError.
    source = Template(tmpl_path.read_text(encoding="utf-8")).substitute(values)

    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"train_{stem}.py"
    out_path.write_text(source, encoding="utf-8")
    return out_path


def demo() -> None:
    import tempfile

    # 기본 출력 폴더에는 사용자가 직접 고친 스크립트가 있다 — 점검은 임시 폴더에만 쓴다
    tmp = Path(tempfile.mkdtemp())
    for spec in ModelCatalog.list_models():
        path = generate(spec, out_dir=tmp)
        source = path.read_text(encoding="utf-8")
        ast.parse(source)  # 문법이 깨졌으면 SyntaxError
        assert "$" not in source, f"{path.name}: 안 채워진 플레이스홀더가 남아 있음"
        assert spec.base_model in source, f"{path.name}: base_model 미반영"
        assert "install_error_interceptor" in source, f"{path.name}: 에러 인터셉터 훅 누락"
        assert "DiffStackTracker" in source, f"{path.name}: 트래커 훅 누락"
        print(f"  {spec.model_id} -> {path}")
    print("generator.py self-check OK")


if __name__ == "__main__":
    demo()
