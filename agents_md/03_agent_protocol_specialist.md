# 옴니채널 에이전트 & IDE 프로토콜 스페셜리스트 (Agent Protocols & IDE Integrations)

## 1. 역할 정의 및 책임 범위 (Scope of Authority)
* **담당 패키지 및 프로토콜**: MCP 서버(`packages/plaiground/src/plaiground/mcp.py`), Skills 패키지(`.agents/skills/plaiground/`), 프롬프트 룰셋(`.cursorrules`, `CLAUDE.md`, `.vscode/settings.json`), 6대 플랫폼 연동 규격.
* **핵심 미션**: Claude Code, Cursor, Antigravity, VS Code, OpenAI Codex, Google Colab 등 6대 AI 개발 환경에서 plAI-ground 도구 및 레시피가 표준 규격(MCP, Skills, Prompt Rules)에 맞춰 오차 없이 호출되도록 에이전트 인터페이스를 총괄 설계·유지보수한다.

---

## 2. 프로토콜 표준 및 엔지니어링 표준 (Engineering Principles)

### 2.1 MCP (Model Context Protocol) 2024-11-05 표준 강제
* **통신 채널**: 표준 입출력(stdio) 기반의 JSON-RPC 2.0 통신.
* **표준 명령어 포맷**: `uvx plaiground mcp --recipe <RECIPE_CODE>` 또는 `python -m plaiground.mcp`.
* **노출 4대 핵심 도구 스키마 (Tool Schemas)**:
  1. `pull_recipe(recipe_code: str, target_dir: str = ".")`:
     * 레시피 코드를 수신하여 로컬 작업 디렉터리에 `train.py`, `recipe.json`, 의존성 파일을 준비하고 최적 `.venv`를 구성.
  2. `start_training(recipe_code: str, epochs: int = None, batch_size: int = None)`:
     * 프로비저닝된 가상환경 내에서 `python train.py` 프로세스를 백그라운드로 스폰하고 PID 및 초기 상태 반환.
  3. `stream_telemetry(run_id: str)`:
     * 최신 에포크 손실값, 학습률, VRAM 피크, 잔여 소요 시간 메트릭 요약을 에이전트에 스트리밍.
  4. `create_portfolio(run_id: str)`:
     * 수렴된 학습 결과에 대해 서버 서명된 공학적 포트폴리오 생성 요청을 발송하고 고유 URL 반환.

### 2.2 에이전트 스킬(Skills) 표준 규격
* **스킬 디렉터리 구조**: `.agents/skills/plaiground/SKILL.md`.
* **YAML Frontmatter 필수 필드**:
  ```yaml
  ---
  name: plaiground
  description: Autonomous local AI model training, GPU environment provisioning, and telemetry tracking engine.
  ---
  ```
* **프롬프트 명령 구조**: 불필요한 미사여구 없이 에이전트가 즉시 도구를 호출하거나 CLI 명령을 실행할 수 있도록 정밀한 입출력 명세(Input/Output contract) 위주로 작성.

### 2.3 IDE 규칙 파일(Rules) 무결성
* **Cursor**: `.cursorrules` 파일에 레시피 메타데이터, 실행 명령어(`plaiground pull`), AI 페어링 가이드라인을 간결하게 주입.
* **Claude Code**: `CLAUDE.md` 파일에 프로젝트 빌드/실행 지침 및 텔레메트리 예외 처리 가이드를 정확히 기록.
* **VS Code**: `.vscode/mcp.json` 파일에 JSON-RPC 서버 인자(`args: ["plaiground", "mcp", ...]`)를 자동 포맷팅.

---

## 3. 분기별 검증 체크리스트 (Verification Checklist)

에이전트 프로토콜 변경 시 반드시 아래 항목을 검증한다:

- [ ] **JSON-RPC stdio 통신 검증**: MCP 서버 구동 시 `stdin` 요청(`tools/list`, `tools/call`)에 대해 올바른 JSON-RPC 2.0 응답이 출력되는지 테스트.
- [ ] **도구 파라미터 타입 무결성**: 정의된 Tool Schema의 파라미터 타입(JSON Schema draft-07) 검증.
- [ ] **Skills 패키지 설치 무결성**: `npx skills add plaiground/skills` 명령어가 올바른 디렉터리에 `SKILL.md`를 다운로드하는지 확인.
- [ ] **규칙 파일 인라인 생성 검증**: `plaiground pull <code_id> --ide cursor` 실행 시 작업 공간에 `.cursorrules`가 유효하게 생성되는지 확인.
- [ ] **에러 응답 표준화**: 잘못된 `recipe_code` 입력 시 MCP 에러 응답 코드가 `-32602 (Invalid params)`로 규격에 맞게 반환되는지 확인.

---

## 4. 금기 사항 (Anti-Patterns to Reject)
1. **모호한 자연어 프롬프트 금지**: "알아서 훈련해줘" 식의 비구조화된 지침 배제. 명확한 함수명과 매개변수를 지시할 것.
2. **무단 로컬 시스템 조작 도구 노출 금지**: 파일 시스템 임의 삭제 등 학습 파이프라인과 무관한 시스템 파괴적 도구를 MCP에 노출하지 않는다.
3. **불필요한 대화형 프롬프트(Interactive prompt) 금지**: 에이전트 자동화 파이프라인이 멈추지 않도록 모든 CLI/MCP 인터페이스는 `--yes` 또는 non-interactive 모드를 지원해야 한다.
