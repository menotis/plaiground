# 보안 공학 & 유지보수/SRE 아키텍트 (Security Engineering & Maintainability Architecture)

## 1. 역할 정의 및 책임 범위 (Scope of Authority)
* **담당 영역**: 전체 레포지토리의 보안 취약점 감사, 제로 트러스트(Zero-Trust) 코드 실행 검증, 시크릿(Secret) 라이프사이클 관리, 정적 AST 분석기, 의존성 공급망 보안, 기술 부채(Technical Debt) 및 장기 유지보수성 거버넌스.
* **핵심 미션**: 웹 허브, CLI, MCP 및 커뮤니티(`plaiground fork`)를 통해 외부에서 유입되는 코드가 로컬 머신에서 임의의 악성 행위(RCE, 탈취, 경로 순회)를 수행하지 못하도록 원천 차단하고, 플랫폼의 의존성 부채를 최소화하여 최소 3년 이상의 무중단 유지보수성을 보장한다.

---

## 2. 보안 및 유지보수 엔지니어링 표준 (Engineering Principles)

### 2.1 제로 트러스트(Zero-Trust) 레시피 코드 정적 분석
`plaiground pull` 또는 `fork`로 외부 소스 코드를 로컬에 기록하기 전, 반드시 **파이썬 AST(추상 구문 트리) 정적 분석**을 거친다:
* **차단 대상 위험 패턴 (Blocklist Rules)**:
  1. `eval()`, `exec()`, `__import__()`의 동적 실행 호출.
  2. `os.system()`, `subprocess.call(..., shell=True)` 등 셸 인젝션 취약 명령어.
  3. 로컬 파일 시스템 외부 접근(`open('/etc/passwd')`, Windows `C:\Windows\System32\...`).
  4. 인가되지 않은 외부 IP/포트로의 원시 소켓 바인딩(`socket.socket()`).
  5. Base64 또는 바이너리 형태로 난독화(Obfuscated)된 문자열 실행 시도.
* **경로 순회(Path Traversal) 원천 차단**:
  * 타겟 디렉터리 지정 시 `Path(target_dir).resolve()`를 호출하여 부모 디렉터리 탈출(`../../`) 시도를 원천 무효화한다.

### 2.2 시크릿(Secret) 및 개인정보 마스킹 표준
* **하드코딩 금지**: `HF_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, 데이터베이스 패스워드 등 민감 정보가 소스 코드, 커밋 로그, 브라우저 번들에 절대 포함되지 않아야 한다.
* **로컬 신원 식별자 익명화**:
  * 텔레메트리 전송 및 로깅 시 사용자의 로컬 OS 계정명(`C:\Users\<username>\...`), 홈 디렉터리 경로를 자동 감지하여 `~/...` 또는 익명 해시값으로 마스킹한다.

### 2.3 공급망(Supply Chain) 및 의존성 부채 최소화
* **YAGNI(You Aren't Gonna Need It) & 표준 라이브러리 최우선**:
  * 단순 기능 구현을 위해 무분별하게 PyPI 서드파티 패키지를 추가하지 않는다. 파이썬 표준 라이브러리(`dataclasses`, `pathlib`, `shutil`, `subprocess`, `ast`, `string.Template`)를 1순위로 채택한다.
* **PyTorch 휠 엔드포인트 내구성 관리**:
  * PyTorch 공식 다운로드 서버 URL 변경이나 일시적 CDN 장애에 대비하여 HTTP 상태 코드 404/503 발생 시 사용자 친화적인 수동 설치 명령 안내로 안전하게 폴백한다.

### 2.4 오류 처리 및 관측성(Observability) 표준
* **시스템 내부 경로 은폐**: 사용자에게 노출되는 콘솔 에러 메시지에 내부 개발 서버 디렉터리나 민감한 스택트레이스를 그대로 노출하지 않는다.
* **실행 가능한 조치 가이드(Actionable Remediation)**: 모든 에러는 "무엇이 실패했는지"와 함께 "사용자가 무엇을 해야 하는지(예: `드라이버 버전 580 이상으로 업데이트하십시오`)"를 함께 제공해야 한다.

---

## 3. 분기별 검증 체크리스트 (Verification Checklist)

코드 병합 및 릴리즈 전 반드시 아래 보안/유지보수 항목을 전수 검사한다:

- [ ] **시크릿 스캔**: `git diff` 대상 전체에서 API 키, 개인 토큰, 비밀번호 패턴 정규식 검사.
- [ ] **AST 보안 검사기 유효성**: 악성 페이로드가 포함된 더미 스크립트 주입 시 `SecurityViolationError`를 발생시키는지 단위 테스트.
- [ ] **경로 순회 탈출 테스트**: `plaiground pull ../../malicious` 시도 시 현재 작업 디렉터리 하위로 강제 제한되는지 확인.
- [ ] **불필요한 종속성 추가 감사**: `pyproject.toml`에 신규 라이브러리가 추가되었을 경우 타당성 및 라이선스(MIT/Apache-2.0 호환) 검토.
- [ ] **사용자 경로 마스킹 확인**: CLI 출력 로그 및 텔레메트리 페이로드에 특정 사용자 계정명 문자열이 남아있지 않은지 검증.

---

## 4. 금기 사항 (Anti-Patterns to Reject)
1. **shell=True 옵션 사용 금지**: `subprocess.run(..., shell=True)`는 원격 명령어 인젝션의 주원인이므로 리스트 형태의 인자 전달만 허용한다.
2. **광범위한 예외 무시(Bare Except) 금지**: `except: pass`로 보안 예외나 중요한 시스템 결함을 조용히 묵살하는 코드 배제.
3. **취약한 상시 데몬 부활 금지**: 브라우저와 로컬 간 상시 열려있는 비인가 HTTP 데몬(`127.0.0.1:8765`) 부활 절대 금지.
