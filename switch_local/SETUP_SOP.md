# 기기 전환 환경 세팅 및 설치 행동 지침서 (Setup SOP)

> **문서 목적:** 노트북 ➔ 컴퓨터(데스크톱) 또는 컴퓨터 ➔ 노트북으로 작업 장소를 바꿀 때, 누락 없이 3분 만에 모든 MCP·스킬·환경을 100% 동일하게 복제하고 동기화하기 위한 표준 행동 지침.

---

## 🛠️ 1. 현재 설치된 스킬(Skills) 및 동기화 방법

### 1) 설치된 스킬 목록
* **`supabase`** (`.agents/skills/supabase`): Supabase 제품군(Auth, DB, Storage, RLS) 표준 가이드.
* **`supabase-postgres-best-practices`** (`.agents/skills/supabase-postgres-best-practices`): PostgreSQL 쿼리 및 인덱싱 최적화 가이드.

### 2) 설치/동기화 방법
* **자동 동기화 (권장)**: 이 스킬들은 프로젝트 내부 `.agents/skills/`에 저장되어 Git에 올라가 있습니다. 새 기기에서 **`git pull origin main`을 실행하면 별도 설치 없이 100% 자동으로 가져옵니다.**
* **수동 설치 명령어 (필요 시)**:
  ```bash
  npx skills add supabase/agent-skills
  ```

---

## 🔌 2. 글로벌 MCP 서버 설정 (`mcp_config.json`)

> ⚠️ **주의:** 이 설정 파일은 Git 저장소 내부가 아니라, **윈도우 사용자 개인 폴더(`~/.gemini/config`)**에 존재하므로 `git pull`로 동기화되지 않습니다. 새 기기에서 아래 내용을 복사해 붙여넣어야 합니다.

### 1) 파일 경로
* **경로:** `C:\Users\<윈도우사용자명>\.gemini\config\mcp_config.json`

### 2) 오늘 변경된 핵심 내역 (Changelog)
1. **`linter`**: PyPI에 없던 패키지(`mcp-server-ruff`) 에러 해결 ➔ 검증된 GitHub 소스에서 직접 빌드/실행하도록 수정 (`--from git+https://github.com/drewsonne/ruff-mcp-server`).
2. **`supabase`**: 대괄호 템플릿(`[YOUR-PASSWORD]`)으로 인한 Invalid URL 에러 해결 ➔ Supabase 공식 원격 SSE 엔드포인트(`serverUrl`)로 교체하여 비밀번호 입력 없이 동작하도록 개선.
3. **`fetch`**: 웹 리소스 조회를 위한 `mcp-server-fetch` 유지.
4. **`sequential-thinking`**: 복잡한 다단계 추론을 위한 공식 MCP 서버 유지.

> 💡 **Windows 사전 준비**: `uvx` 명령어가 없을 경우 먼저 `pip install uv`를 실행하면 즉시 사용 가능합니다.

### 3) 새 컴퓨터에 그대로 붙여넣을 완성형 JSON 전문
```json
{
    "mcpServers": {
        "sequential-thinking": {
            "command": "npx",
            "args": [
                "-y",
                "@modelcontextprotocol/server-sequential-thinking"
            ]
        },
        "linter": {
            "command": "uvx",
            "args": [
                "--from",
                "git+https://github.com/drewsonne/ruff-mcp-server",
                "ruff-mcp-server"
            ]
        },
        "supabase": {
            "serverUrl": "https://mcp.supabase.com/mcp?project_ref=mevtfzmqohjtsnnghzwt&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching"
        },
        "fetch": {
            "command": "uvx",
            "args": [
                "mcp-server-fetch"
            ]
        }
    }
}
```

---

## 📋 3. 기기 전환 시 5단계 행동 체크리스트 (노트북 ➔ 컴퓨터)

새 컴퓨터 앞에 앉았을 때 아래 순서대로 5단계만 수행하면 세팅이 끝납니다.

1. **저장소 최신화**:
   * 터미널 열기: `cd c:\workspace\plaiground`
   * 명령어 실행: `git pull origin main` (스킬 및 전략 문서 자동 동기화)
2. **MCP 설정 동기화**:
   * 새 컴퓨터의 `C:\Users\<사용자명>\.gemini\config\mcp_config.json` 파일 열기
   * 위 **2.3절의 JSON 전문**을 그대로 덮어쓰고 저장.
3. **환경 변수(`.env`) 확인**:
   * 노트북의 `c:\workspace\plaiground\.env` 내용을 복사하여 새 컴퓨터의 동일 경로 `.env`에 붙여넣기.
4. **도커(Docker) 구동 확인**:
   * Docker Desktop 실행 후 `docker ps` 정상 동작 확인.
5. **안티그래비티 대화 시작**:
   * 새 대화창을 열고 [switch_local/CONTEXT_HANDOFF.md](file:///c:/workspace/plaiground/switch_local/CONTEXT_HANDOFF.md)의 핵심 내용을 복붙하여 이전 맥락을 주입하고 작업 개시.

---

## 🔄 4. 앞으로 새 스킬/MCP가 추가될 때의 누적 행동 지침

추후 컴퓨터나 노트북에서 작업 중 **새로운 도구가 추가되거나 변경될 때** 다음 규칙을 따릅니다:

### 규칙 A: 프로젝트 스킬(`.agents/skills/`)을 추가했을 때
1. 터미널에서 스킬 설치 (예: `npx skills add <저장소명>`)
2. 즉시 Git에 커밋 & 푸시:
   ```bash
   git add .agents/skills skills-lock.json
   git commit -m "feat(skills): 새 스킬 OOO 추가"
   git push origin main
   ```
3. ➔ 다른 기기에서는 `git pull`만 하면 자동으로 동기화 완료!

### 규칙 B: 글로벌 MCP(`mcp_config.json`)를 추가/수정했을 때
1. 현재 기기의 `mcp_config.json` 수정 및 동작 테스트 완료.
2. 이 문서([switch_local/SETUP_SOP.md](file:///c:/workspace/plaiground/switch_local/SETUP_SOP.md))의 **2.3절 JSON 전문에 수정 사항을 즉시 반영**.
3. Git 커밋 & 푸시:
   ```bash
   git add switch_local/SETUP_SOP.md
   git commit -m "docs(sop): mcp_config.json 신규 설정 누적 반영"
   git push origin main
   ```
4. ➔ 다음 기기로 넘어갔을 때, 이 문서의 2.3절을 열어서 새 기기의 `mcp_config.json`에 그대로 복붙하면 1초 만에 동기화 완료!
