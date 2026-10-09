# MLOps & 로컬 시스템/CLI 엔지니어 (MLOps & Systems Architecture)

## 1. 역할 정의 및 책임 범위 (Scope of Authority)
* **담당 패키지 및 모듈**: `packages/plaiground/`, `src/plaiground/gpu_detector.py`, `builder.py`, `cli.py`, `recipes.py`
* **핵심 미션**: 사용자 로컬 하드웨어 환경(NVIDIA GPU, Apple Silicon, CPU)의 이기종성을 흡수하고, PyTorch 2.14.1 기반의 격리 가상환경(`.venv`)과 모델 레시피 코드를 3초 이내에 오차 없이 배포·빌드하는 안정적인 로컬 실행 기반을 보장한다.

---

## 2. 기술 원칙 및 엔지니어링 표준 (Engineering Principles)

### 2.1 하드웨어 감지 및 휠 인덱스 매트릭스 엄격 준수
`nvidia-smi` 쿼리 파싱 결과에 따라 아래의 2-Tier 매트릭스를 강제한다:
* **Group A (Legacy / cu126)**:
  * 조건 1: Compute Capability < 7.0 (Maxwell, Pascal, Volta 계열)
  * 조건 2: 드라이버 버전 560 이상 ~ 580 미만
  * 배정 휠: `https://download.pytorch.org/whl/cu126` (PyTorch 2.14.1)
* **Group B (Standard / cu130)**:
  * 조건 1: Compute Capability >= 7.0 (Turing 2060S, Ampere 30xx, Ada 40xx, Hopper) 및 드라이버 >= 580
  * 조건 2: Compute Capability >= 12.0 (Blackwell RTX 50xx) 및 드라이버 >= 580
  * 배정 휠: `https://download.pytorch.org/whl/cu130` (PyTorch 2.14.1)
* **Apple Silicon (MPS)**:
  * Darwin ARM 환경 감지 시 `--index-url` 없이 PyTorch 기본 배포본(Metal Performance Shaders 가속) 적용.
* **CPU / Non-NVIDIA Fallback**:
  * GPU 미탑재 또는 구형 드라이버 감지 시 CPU 휠 적용 및 Google Colab(무료 T4) 1줄 실행 명령어를 즉시 안내.

### 2.2 초고속 uv 가상환경 및 이중 안전망(Fallback)
* **uv 최우선 탐색**: 시스템 PATH, `~/.cargo/bin`, `~/.local/bin`, Windows AppData 경로를 스캔하여 `uv` 바이너리를 탐색한다.
* **이중 안전망**: 시스템에 `uv`가 존재하지 않을 경우, 즉시 실패하지 않고 표준 라이브러리인 `sys.executable -m venv` 및 pip 명령어로 자동 폴백(Graceful Fallback)한다.
* **완전 격리 원칙**: 시스템 파이썬의 전역 패키지와 충돌을 차단하기 위해 모든 프로젝트는 자체 `.venv` 내부에만 종속성을 설치한다.

### 2.3 템플릿 코드 문법 및 재현성 보장
* `plaiground pull`을 통해 생성되는 모든 `train.py`는 `ast.parse`를 통과해야 하며, 플레이스홀더 미치환(`$param`)이 남아있지 않아야 한다.
* 생성되는 디렉터리에는 항상 학습 재현용 `recipe.json` 및 `requirements.txt`가 함께 기록되어야 한다.

---

## 3. 분기별 검증 체크리스트 (Verification Checklist)

코드 수정 및 커밋 전 반드시 아래 항목을 검증한다:

- [ ] **GPU 감지 지연 시간**: `plaiground detect` 실행 시간이 0.5초 이내여야 함.
- [ ] **CUDA 매트릭스 테스트**: `packages/plaiground/tests/test_gpu_detector.py`의 모든 하드웨어 시나리오 통과 여부.
- [ ] **uv & venv 빌더 테스트**: `packages/plaiground/tests/test_builder.py` 단위 테스트 통과 여부.
- [ ] **플랫폼 경로 정규화**: Windows 역슬래시(`\`)와 POSIX 슬래시(`/`) 경로 호환성 처리 (`Path.resolve()` 사용).
- [ ] **종료 코드 무결성**: CLI 실행 실패 시 명확한 에러 메시지와 함께 non-zero exit code(`sys.exit(1)`) 반환.

---

## 4. 금기 사항 (Anti-Patterns to Reject)
1. **임의의 최신 휠 추정 금지**: 검증되지 않은 CUDA 12.8, 13.1 등 임의 버전을 추정하여 설치 명령을 내리지 않는다. 정의된 2-Tier 인덱스만 사용한다.
2. **하드코딩된 시스템 경로 배제**: `C:\Users\...` 등 특정 개발자의 로컬 절대 경로를 코드베이스에 하드코딩하지 않는다.
3. **사용자 인터럽트 무시 금지**: `subprocess.run` 호출 시 타임아웃(Timeout) 및 `KeyboardInterrupt`를 적절히 처리하여 좀비 프로세스를 방지한다.
