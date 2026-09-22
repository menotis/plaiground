# 분담 업무 계획서 — GPU 호스트 층 (박준형)

작성일: 2026-09-22 · 기준: [MASTER_PLAN.md](MASTER_PLAN.md) Stage A~C · 짝 문서: [assignment_edge_sanghyup.md](assignment_edge_sanghyup.md)

## 0. 맡는 것

GPU 호스트에서 실행되는 모든 것. Python API 서버(`apps/host`), 사용자 컨테이너 이미지, 텔레메트리 SDK(`packages/telemetry`), Tailscale 연결, 보안 강화.

**목표 한 줄:** 상협이 자기 노트북에서 로그인 → Start AI → Web IDE 학습 → 본인 Gemini 키로 포트폴리오 생성까지 마치고, 그 뒤 준형의 PC를 꺼도 포트폴리오가 열린다. (Stage C 완료 기준)

**소유 폴더:** `apps/host/`, `packages/telemetry/`, `apps/host/docker/`. `apps/web/`은 상협 소유이므로 프론트 변경이 필요하면 `docs/interface.md`에 적고 상협에게 요청한다.

## 1. 지금 남은 것 (Stage A 마무리, 오늘)

- [ ] 2단계 인증: 루트 Gmail → Bitwarden → Cloudflare → Supabase 순. 설정 키를 Bitwarden 컬렉션 `menotis-infra`에 저장
- [ ] GitHub 조직 `menotis` — 개인 계정 `00PJH`로 생성 (공용 로그인은 GitHub 약관 위반)
- [ ] Tailscale 가입(루트 Gmail의 Google 로그인) + 이 PC에 설치
- [ ] 계획서 커밋·푸시 (`plaiground_deployment/` 미커밋 변경분)
- [ ] 8080 포트 예약 해제 — 관리자 PowerShell에서 한 번만:
  ```
  net stop winnat
  netsh int ipv4 add excludedportrange protocol=tcp startport=8080 numberofports=1
  net start winnat
  ```
- [ ] 회의: 상협을 5개 서비스에 초대, 저장소 이전·공개 여부 결정, 인터페이스 확정 (3장)

## 2. Stage B — 호스트 리팩터 (약 1주 반)

배포는 하지 않는다. 매 항목 뒤에 `python scripts/check.py --skip-web`이 통과하고 로컬 전체 흐름이 그대로 돌아야 한다. PR은 항목 단위로 하나씩.

| # | 작업 | 손댈 파일 | 완료 기준 |
|---|---|---|---|
| B1-1 | **`settings.py`** — 환경변수를 읽는 유일한 곳. `PLAIGROUND_PORT`, `PLAIGROUND_VAR_DIR`, `PLAIGROUND_ALLOWED_ORIGINS`(쉼표 구분), `PLAIGROUND_AUTH`(`off`/`supabase`), `SUPABASE_URL`, `SUPABASE_ANON_KEY`. 없으면 지금과 같은 로컬 기본값. `paths.py`는 `settings`에서 `VAR_DIR`를 받도록 | `plaiground_host/settings.py`(신규), `paths.py`, `api_server.py` | 환경변수 없이 실행하면 동작이 지금과 같다. `.env.example`에 변수 이름만 기록 |
| B1-2 | **사용자별 워크스페이스** — `var/workspaces/<user_id>/`에 생성 스크립트와 텔레메트리를 둔다. 로컬(`PLAIGROUND_AUTH=off`)에서는 `user_id="local"`. `generator.generate()`의 `out_dir`, `provisioner`의 마운트 경로, `TELEMETRY_DIR`가 이 폴더를 가리킴 | `workspace/generator.py`, `provisioner.py`, `setup_and_train.py`, `community/service.py`(실습 코드 스테이징 위치) | `var/generated/`를 더 이상 쓰지 않는다. 기존 사용자 스크립트는 `var/workspaces/local/`로 옮겨 둔다 |
| B1-3 | **레포 마운트 제거** — `pip wheel packages/telemetry`로 휠을 만들어 Dockerfile에서 설치. `docker run`의 `-v`를 `var/workspaces/<user>:/workspace`로, `PYTHONPATH` 주입 제거, `PLAIGROUND_TELEMETRY_DIR=/workspace/.telemetry`. 이미지 재빌드 | `docker/plaiground-base/Dockerfile`, `entrypoint.sh`, `provisioner.py` | IDE 터미널에서 `ls /workspace`에 자기 스크립트만 보이고, `grep -r GEMINI /`에 아무것도 없다. **B1의 핵심 보안 목표** |
| B1-4 | **서버 하나로** — `workspace/api_server.py`의 `_Handler`와 `api_server.py`의 상속 구조를 `server.py`의 라우팅 표(`(method, path) → handler`) 하나로. `/api/viz/*`는 `viz/` 모듈로 분리 | `server.py`(신규), `viz/`(신규), 기존 두 `api_server.py` 삭제 | 모든 URL이 한 파일에서 보인다. 실행 명령은 `python -m plaiground_host.server` |
| B1-5 | **인증 훅 + 경로 검증** — 라우팅 표 앞단에서 `Authorization: Bearer <JWT>` 확인. `PLAIGROUND_AUTH=off`면 통과. 검증은 Supabase `GET {SUPABASE_URL}/auth/v1/user`에 토큰을 넘겨 200이면 유효(stdlib `urllib`만 쓰고, 결과를 토큰별로 60초 캐시). `run` 파라미터는 `_viz_run_dir()`와 같은 방식으로 검증. CORS: `PLAIGROUND_ALLOWED_ORIGINS`에 있는 오리진만 허용, OPTIONS 응답 | `server.py`, `settings.py` | 토큰 없이 `/api/*` 호출 시 401. `run=../x`는 404 |
| B1-6 | **Gemini BYOK** — `/api/portfolio/run`이 `X-Gemini-Key` 헤더를 받아 서브프로세스 `env`로만 전달(argv 금지). `_call_gemini`가 `os.environ`을 그대로 읽으므로 코드 변경은 헤더 → env 한 줄. 키를 로그·파일에 남기지 않는지 확인. 서버 `.env`의 `GEMINI_API_KEY`는 헤더가 없을 때의 로컬 폴백으로만 | `server.py`, `portfolio/llm/generator.py`(변경 최소) | 헤더로 준 키로 생성되고, 로그 어디에도 키 문자열이 없다 |
| B1-7 | **테스트와 형식 명세** — `demo()` 함수들을 `apps/host/tests/`, `packages/telemetry/tests/`로 옮겨 `pytest`. `packages/telemetry/FORMAT.md`에 `schema.json`/`frames.bin`/`frames.jsonl` 명세. `schema.json`에 `"format_version": 1` 추가 | `tests/`, `FORMAT.md`, `recorder.py` | `pytest -q` 통과. `scripts/check.py`가 `pytest`를 호출 |

**Stage B 끝에 상협에게 넘길 것:** 호스트 주소 형식, 인증 헤더 이름, `X-Gemini-Key`, CORS 허용 방식. 전부 `docs/interface.md`에 적혀 있어야 한다.

## 3. 상협과의 접점 — 회의에서 확정할 것

이것이 정해지면 2주간 서로 기다리지 않는다. `docs/interface.md`로 저장한다.

| 항목 | 제안 값 |
|---|---|
| 인증 헤더 | `Authorization: Bearer <Supabase access_token>` — 모든 `/api/*` |
| Gemini 키 헤더 | `X-Gemini-Key: <사용자 키>` — `/api/portfolio/run`만 |
| 호스트 주소 | 프론트 환경변수 `VITE_API_BASE`. 로컬은 빈 문자열(상대 경로), Stage C는 `https://<pc>.<tailnet>.ts.net` |
| SSE | `EventSource` 대신 `fetch` 스트리밍. 서버 응답 형식은 지금 그대로 (`event:`/`data:` 줄) |
| 엔드포인트 경로 | 변경 없음. 커뮤니티 4개만 Supabase로 이동 |
| 호스트 오프라인 | 프론트가 `/api/status` 실패 시 안내 화면. 호스트는 관여 없음 |
| Supabase 쓰기 | Stage C부터 호스트가 `service_role` 키로 `runs`, `portfolios`에 기록. 그 전까지는 파일(`var/`) |

## 4. Stage C — Tailscale로 연결 (약 1주, B1·B2 모두 끝난 뒤)

- [ ] `tailscale serve --bg --https=443 http://127.0.0.1:8770` (API), `--https=8443 http://127.0.0.1:8080` (IDE). 인터넷 노출 없음
- [ ] `PLAIGROUND_ALLOWED_ORIGINS`에 상협이 만든 Pages 주소 추가, `PLAIGROUND_AUTH=supabase`
- [ ] **첫날 확인:** `pages.dev`에서 `ts.net` API 호출 시 크롬의 로컬 네트워크 접근 차단 여부. 막히면 API만 `tailscale funnel`로 바꾸고 JWT에 맡긴다
- [ ] 포트폴리오 생성 완료 시 본문 JSON을 Supabase `portfolios`에 `service_role`로 기록 (상협의 테이블 정의를 따른다)
- [ ] 동시 실행 잠금: 컨테이너가 하나이므로 사용 중이면 409와 안내 문구
- [ ] 완료 기준 시연: 상협 노트북에서 전체 흐름

## 5. 규칙

- 이동과 로직 변경을 한 커밋에 섞지 않는다. PR은 표의 번호 단위로.
- `main` 직접 푸시 금지, `origin` 푸시 금지. 최신 원격은 `pg_demo`(조직 이전 후 새 주소).
- `service_role` 키는 호스트 환경변수에만. 프론트·컨테이너·저장소·채팅에 넣지 않는다.
- 학습 템플릿의 의도된 오류는 건드리지 않는다. `var/`의 사용자 데이터를 덮어쓰지 않는다.
- 도구가 `.env`를 읽지 못하게 한다. 디버깅에 키 값이 필요한 경우는 없다.

## 6. 일정 (파트타임 기준)

| 주 | 할 것 |
|---|---|
| 1주차 | Stage A 마무리, 회의, B1-1 ~ B1-3 |
| 2주차 | B1-4 ~ B1-7 |
| 3주차 | Stage C. 상협의 B2와 합류 |

막히면 상협에게 알리는 것이 먼저다. 한쪽이 멈추면 다른 쪽도 Stage C에 못 들어간다.
