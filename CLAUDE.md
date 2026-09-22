# plAI-ground — 에이전트 작업 지침

구조, 설치, 실행 방법은 [README.md](README.md)를 먼저 읽는다. 아래는 코드를 고칠 때 반드시 지킬 규칙이다.

## 명령

```bash
pip install -e packages/telemetry -e apps/host   # 최초 1회
python scripts/check.py --skip-web               # 파이썬을 고친 뒤 (약 10초)
python scripts/check.py                          # 프론트도 고쳤을 때 (프론트 빌드 포함)
python -m plaiground_host.server                 # 서버, http://127.0.0.1:8770
```

작업을 마쳤다고 말하기 전에 점검 명령을 돌린다.

## 절대 하지 말 것

- **학습 템플릿의 "의도된 오류"를 고치지 않는다.** `apps/host/plaiground_host/workspace/templates/*.py.tmpl`에는 `[실습 과제 · 의도된 오류]` 주석이 붙은 버그가 들어 있다. 학생이 직접 고치고 그 수정 이력이 포트폴리오가 되는 것이 제품의 핵심이다. 고치는 방법을 설명해 달라는 요청에는 설명만 한다.
- **`var/workspaces/<user>/`의 스크립트를 덮어쓰지 않는다.** 사용자가 직접 고친 학습 스크립트가 들어 있다. `generate()`를 기본 출력 폴더로 호출하는 테스트나 스크립트를 만들지 않는다. 점검에는 임시 폴더를 쓴다.
- **`var/`의 다른 데이터도 지우거나 덮어쓰지 않는다.** 학습 기록과 생성된 포트폴리오는 재생성 비용이 크다(GPU 학습, Gemini 호출).
- **비밀을 커밋하지 않는다.** `.env`는 gitignore 대상이다. 키 값을 코드, 문서, 로그, 채팅에 옮겨 적지 않는다. Supabase `service_role` 키는 프론트엔드와 사용자 컨테이너에 절대 넣지 않는다.
- **`main`에 직접 푸시하지 않는다.** 브랜치를 만들고 PR로 올린다. 원격은 `origin`(menotis/plaiground) 하나다.
- **API 서버를 `0.0.0.0`에 바인딩하지 않는다.** 인증 없이 docker를 실행하는 서버다.

## 구조 규칙

- 의존 방향은 한쪽이다. `apps/*`는 `packages/*`를 import할 수 있다. `packages/*`는 `apps/*`를 import하지 않는다. `apps/web`과 `apps/host`는 HTTP로만 만난다.
- `packages/telemetry`는 사용자 컨테이너 안에서 실행된다. 적대적일 수 있는 환경이다. 플랫폼 로직, 비밀, LLM 호출을 넣지 않는다.
- 폴더 위치를 코드에 하드코딩하지 않는다. 호스트는 `plaiground_host/paths.py`(사용자별 `workspace_dir/telemetry_dir/portfolio_dir`), SDK는 `plaiground_telemetry/paths.py`에서 가져다 쓴다. 환경변수는 `plaiground_host/settings.py`에서만 읽는다. `Path(__file__).parent.parent...`로 저장소 구조를 거슬러 올라가지 않는다.
- 실행 중 생기는 파일은 `var/` 아래에만 쓴다. 사용자 컨테이너에는 `var/workspaces/<user>/`만 마운트된다. 플랫폼 소스와 `.env`가 컨테이너에 보이면 안 된다.
- 새 `/api/*` 라우트는 `server.py`의 `ROUTES` 표에 추가한다. 인증·CORS는 표 앞단에서 공통 처리되므로 핸들러에서 다시 하지 않는다.
- 프론트엔드 작업은 `apps/web`에서만 한다. 디자인 규칙은 `apps/web/DESIGN.md`.

## 커밋

- 파일 이동과 로직 변경을 한 커밋에 섞지 않는다.
- `main`에 직접 푸시하지 않는다. 브랜치를 만들고 PR로 올린다. 규칙 전체는 [CONTRIBUTING.md](CONTRIBUTING.md).
- 배포 전환 작업 중에는 폴더 소유권이 있다. 담당과 순서는 [plaiground_deployment/MASTER_PLAN.md](plaiground_deployment/MASTER_PLAN.md).
