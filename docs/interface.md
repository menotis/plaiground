# 두 층 사이의 인터페이스

작성일: 2026-09-22 · 상태: **확정 (2026-09-22).** 바꾸려면 이 문서를 고치는 PR을 올린다. 결정 근거는 [decisions.md](../plaiground_deployment/decisions.md).

프론트(`apps/web`, 상협)와 GPU 호스트(`apps/host`, 준형)가 만나는 지점 전부. 여기 없는 것을 상대 폴더에서 고치지 않는다. 바꾸고 싶으면 이 문서를 먼저 고치고 PR 설명에 링크한다.

## 1. 주소와 헤더

| 항목 | 값 | 구현 상태 |
|---|---|---|
| 호스트 주소 | 프론트 환경변수 `VITE_API_BASE`. 로컬은 빈 값(Vite 프록시 → `127.0.0.1:8770`), Stage C는 `https://<pc>.<tailnet>.ts.net` | 프론트 `api.js` 완료. 호스트는 `PLAIGROUND_ALLOWED_ORIGINS`에 Pages 주소를 넣어야 CORS 허용 |
| 인증 | `Authorization: Bearer <Supabase session.access_token>` — **모든** `/api/*`. 없거나 무효면 `401 {"error": "로그인이 필요합니다."}` | 호스트 완료(`PLAIGROUND_AUTH=supabase`일 때). 로컬 기본 `off`는 헤더 무시. 프론트는 `api.js`의 `buildHeaders`에 추가 예정 |
| Gemini 키 | `X-Gemini-Key: <사용자 AI Studio 키>` — `/api/portfolio/run`만. 서버는 저장·로그하지 않고 서브프로세스 env로만 전달. 없으면 서버 `.env` 키로 폴백(로컬 전용) | 호스트 완료. 프론트는 키 입력 칸 + `sessionStorage` 예정 |
| CORS | 허용 오리진에만 `Access-Control-Allow-Origin` 반영. `OPTIONS` → 204, 허용 헤더 `Authorization, Content-Type, X-Gemini-Key` | 호스트 완료 |
| 사용자 구분 | 서버가 토큰에서 얻은 `user.id`로 `var/workspaces/<id>/`, `var/portfolios/<id>/`를 분리. 프론트는 사용자 id를 보내지 않는다 | 호스트 완료 |

## 2. 엔드포인트 (경로 변경 없음)

| 메서드 | 경로 | 응답 | 배포 후 |
|---|---|---|---|
| GET | `/api/status` | `{docker_running, image, image_exists, gpu_name, driver_version, wsl2_ready}` | 호스트 |
| GET | `/api/models` | `ModelSpec[]` | 호스트 |
| GET | `/api/setup?model_id=` | **SSE** `log`·`ready{ide_url, script_path, run_command, ...}`·`error`. 잘못된 `model_id`는 스트림 전에 `400 JSON` | 호스트 |
| GET | `/api/ide/status` | `{running, ide_url}` — `ide_url`은 `PLAIGROUND_IDE_URL` | 호스트 |
| GET | `/api/viz/runs`, `/api/viz/<run>/schema`, `/rows`, `/frame?index=k` | JSON / JSON / float32 바이너리 | 호스트 (Stage D 이후 파일 저장소) |
| GET | `/api/portfolio/runs`, `/telemetry?run=`, `/data?run=`, `/output?run=`, `/export.md?run=` | JSON / JSON / JSON / HTML / MD | Stage C부터 Supabase `portfolios`에서 읽기로 전환(프론트) |
| GET | `/api/portfolio/run?run=&mode=` | **SSE** `log`·`ready{run_id, telemetry}`·`error`. 종료코드 2 = LLM 실패 | 호스트 + `X-Gemini-Key` |
| GET/POST | `/api/community/posts`, `/comments`, `/interact`, `/comment` | JSON | **Supabase 직접 호출로 교체(B2-5)** |
| POST | `/api/community/practice` `{post_id}` | `{script_path, run_command}` — 사용자 워크스페이스에 파일 생성 | 호스트 |

잘못된 `run` 이름(`..`, 구분자, 숨김 접두)은 전부 `404`.

## 3. SSE 형식

서버는 `Content-Type: text/event-stream`, HTTP/1.0, 줄 단위 `event: <name>\ndata: <JSON>\n\n`. 스트림 끝은 연결 종료. 프론트 `apiStream`은 이를 파싱해 `onEvent(name, rawData)`로 넘기고, `close()` 없이 끊기면 `('error', undefined)`.

**프론트에 요청 (선택):** 응답이 `!res.ok`일 때 본문 JSON의 `error`를 `onEvent('error', body)`로 넘겨 주면 "잘못된 model_id", "로그인이 필요합니다" 같은 서버 메시지가 화면에 보인다. 지금은 `undefined`라 일반 문구만 뜬다. EventSource 시절과 같은 동작이라 급하지 않다.

## 4. Supabase 테이블 (확정)

스키마의 원본은 [`plaiground_deployment/supabase/migrations/0001_init.sql`](../plaiground_deployment/supabase/migrations/0001_init.sql). 호스트가 Stage C에서 `service_role`로 쓰는 두 테이블:

| 테이블 | 호스트가 채우는 컬럼 | 출처 |
|---|---|---|
| `runs` | `run_id, user_id, model_id, script, project_name, base_model, status, error_count, saved_at` | `runs/<run_id>.json` (FORMAT.md) |
| `portfolios` | `run_id, user_id, data, integrity_hash` | `data` = `/api/portfolio/data` JSON 그대로, `integrity_hash` = `data.verification.integrity_hash` |

역할은 `student`/`faculty`/`admin`. 첫 admin은 준형, faculty 지정은 admin이 `rpc('set_role', {target, new_role})`.

## 5. 호스트 환경변수 (참고)

`apps/host/.env.example`. Stage C에서 프론트와 맞춰야 하는 것은 `PLAIGROUND_ALLOWED_ORIGINS`(Pages 주소), `PLAIGROUND_AUTH=supabase`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PLAIGROUND_IDE_URL`(Tailscale IDE 주소).

## 6. 확인된 통합 결과 (2026-09-22)

`feat/api-client`(B2-1)와 `stage-b/host-refactor`(B1)를 로컬에서 합쳐 시험했다. 파일 충돌 없음. `apiStream`이 새 서버의 `log`·`error` 이벤트를 정상 파싱하고, `X-Gemini-Key`가 서버 `.env` 키보다 우선한다. 병합 순서는 무관하다.
