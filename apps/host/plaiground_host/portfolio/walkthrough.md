# DiffStack Engine — 구현 완료 Walkthrough

## 최종 실행 결과 (E2E 검증)

```
============================================================
  DiffStack Engine - E2E Demo Pipeline
============================================================
[Step 1] ✅ sys.excepthook interceptor activated.
[Step 2] ✅ Dummy OOM error captured → .telemetry/last_error.json
[Step 3] ✅ Dataset stats and benchmark metrics logged.
[Step 4] ✅ Telemetry saved → .telemetry/raw_telemetry.json
[LLM] Calling Gemini 3.6 Flash...
[LLM] ✅ Gemini response parsed and validated successfully.
[Step 5] ✅ PortfolioSchema validated.
[Step 6] ✅ Portfolio HTML rendered → portfolio_output.html

============================================================
  [OK] All steps completed successfully!
============================================================
```

---

## 생성된 파일 목록

| 파일 | 역할 |
|------|------|
| [telemetry/interceptor.py](file:///c:/workspace/plaiground/portfolio_demo/telemetry/interceptor.py) | sys.excepthook 에러 인터셉터 |
| [telemetry/git_tracker.py](file:///c:/workspace/plaiground/portfolio_demo/telemetry/git_tracker.py) | Git diff 추출기 (Fallback 포함) |
| [telemetry/tracker.py](file:///c:/workspace/plaiground/portfolio_demo/telemetry/tracker.py) | DiffStackTracker 클래스 |
| [core/schema.py](file:///c:/workspace/plaiground/portfolio_demo/core/schema.py) | Pydantic V2 포트폴리오 스키마 |
| [core/log_cleaner.py](file:///c:/workspace/plaiground/portfolio_demo/core/log_cleaner.py) | 스택트레이스 필터 |
| [llm/prompt.py](file:///c:/workspace/plaiground/portfolio_demo/llm/prompt.py) | STAR 기반 System Prompt |
| [llm/generator.py](file:///c:/workspace/plaiground/portfolio_demo/llm/generator.py) | Gemini 3.6 Flash + Mock Fallback |
| [templates/portfolio_template.html](file:///c:/workspace/plaiground/portfolio_demo/templates/portfolio_template.html) | Jinja2 + Tailwind CDN 템플릿 |
| [services/renderer.py](file:///c:/workspace/plaiground/portfolio_demo/services/renderer.py) | SHA-256 해시 + HTML 렌더러 |
| [run_demo.py](file:///c:/workspace/plaiground/portfolio_demo/run_demo.py) | E2E 원클릭 검증 스크립트 |

---

## 주요 동작 특성

### Zero-Crash 보장
- **Git 없음**: `[Git not installed — diff skipped]` fallback 반환, 계속 진행
- **API 키 없음/네트워크 오류**: Mock Fallback 데이터로 HTML까지 완주
- **OOM 시뮬레이션**: `sys.excepthook` 직접 호출로 프로세스 중단 없이 JSON 캡처

### SHA-256 무결성
```
SHA-256(ISO_timestamp + raw_telemetry_json) → 64자 hex 해시
```
포트폴리오 HTML의 Header 카드와 Footer에 워터마크로 삽입

### LLM 연동 (google.genai SDK)
- 모델: `gemini-3.6-flash`
- JSON Mode: `response_mime_type="application/json"`
- 시스템 프롬프트: STAR 구조 강제 + Hallucination 방지 규칙

---

## 알려진 무해한 경고들

| 경고 | 원인 | 영향 |
|------|------|------|
| `Thread-1 UnicodeDecodeError` | Windows 콘솔 cp949 vs UTF-8 (run_demo.py stdout 리디렉션 이슈) | 없음 (파이프라인 정상 완주) |
| AFC in Models.generate_content warning | google.genai SDK 경고 (Automatic Function Calling) | 없음 (기능 정상 동작) |

---

## 실행 방법

```bash
cd c:\workspace\plaiground
python -m portfolio_demo.run_demo
# → portfolio_demo/portfolio_output.html 생성
```
