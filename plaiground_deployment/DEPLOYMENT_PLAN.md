# plAI-ground 배포 전환 계획

작성일: 2026-09-21 · 기준 커밋: `6340c88` · 대상 독자: 박준형, 한상협

> **실행 순서는 [MASTER_PLAN.md](MASTER_PLAN.md)를 따른다.** 이 문서는 각 단계의 상세 체크리스트와 근거다. 폴더 이동([directory_plan.md](directory_plan.md)) 이후에는 이 문서의 경로가 `web_combine_demo/app` → `apps/web`, `ai_set_demo`·`portfolio_demo` → `apps/host`, `portfolio_demo/telemetry` → `packages/telemetry`로 바뀐다.

이 문서 하나로 "지금 무엇이 막혀 있고, 무엇을 먼저 만들어야 하고, 어떤 순서로 배포까지 가는지"를 알 수 있게 썼다. 위에서부터 순서대로 진행하면 된다. 각 단계에는 **완료 기준**이 있고, 그 기준을 통과해야 다음 단계로 간다.

> 무료 등급 한도 수치는 서비스 측에서 수시로 바뀐다. 이 문서의 수치는 계획용이며, 가입 시점에 각 요금 페이지에서 다시 확인한다.

---

## 1. 지금 상태와 배포를 막는 것

현재 플랫폼은 **한 사람이 자기 PC에서 쓰는 것**을 전제로 만들어져 있다. 기능은 끝까지 동작하지만, 아래 4가지 때문에 지금 코드를 그대로 인터넷에 올리면 안 된다.

| # | 현재 구조 | 배포 시 문제 | 해결 단계 |
|---|---|---|---|
| 1 | `web_combine_demo/api_server.py`가 인증 없이 `docker run`을 실행 (127.0.0.1 전용이라 지금은 안전) | 외부에 열면 누구나 서버에서 임의 코드를 실행할 수 있다 | Phase 1, 3 |
| 2 | 컨테이너가 **레포 전체**를 `/workspace`로 마운트 (`ai_set_demo/provisioner.py`) | Web IDE 안에서 플랫폼 소스, `.env`의 API 키, 다른 사람의 학습 기록이 전부 보인다 | Phase 1 |
| 3 | code-server가 `--auth none`으로 실행 (`entrypoint.sh`) | URL만 알면 누구나 IDE에 들어온다 | Phase 3 |
| 4 | 상태가 전부 로컬 파일 (`community_demo/state.json`, `comments.json`, `portfolio_demo/.telemetry/`, `portfolio_demo/output/`) | 사용자 구분이 없고, 두 명이 쓰면 서로 덮어쓴다 | Phase 2, 4 |

Cloudflare와 Supabase는 GPU도 Docker도 실행하지 못한다. 그래서 배포 후 구조는 **두 층**으로 나뉜다.

```
[엣지 층]  항상 켜져 있음, 무료 등급
  Cloudflare Pages   React SPA
  Supabase           로그인, 커뮤니티 글·댓글, 실행 기록·포트폴리오 메타데이터
  Cloudflare R2      포트폴리오 HTML/MD, View AI 프레임 파일

[GPU 호스트 층]  켜져 있을 때만 동작
  API 서버           환경 세팅, 학습 실행, 포트폴리오 생성, View AI 데이터
  Docker + code-server  사용자별 워크스페이스
  Cloudflare Tunnel + Access 뒤에만 노출 (포트를 열지 않는다)
```

핵심 설계 원칙 두 가지:
- **GPU 호스트가 꺼져 있어도 커뮤니티와 포트폴리오 열람은 동작해야 한다.** 그래서 생성된 산출물은 엣지 층으로 올려 둔다.
- **컨테이너 안에는 비밀이 하나도 없어야 한다.** 사용자가 IDE에서 Claude나 Codex를 연결해도, 읽을 수 있는 것이 자기 파일뿐이면 빼갈 것이 없다.

---

## 2. Phase 0 — 예비 작업 (약 3시간, 두 사람이 같이)

배포 작업을 시작하기 전에 끝내야 하는 계정·합의 작업이다. **순서가 중요하다.** 뒤 항목이 앞 항목에 의존한다.

사업자등록은 필요 없다. 아래 서비스는 모두 이메일만으로 조직을 만들 수 있다.

### 2.1 먼저 합의할 것 4가지

- [ ] **도메인 이름** (예: `plaiground.dev`). Cloudflare Tunnel과 Access는 Cloudflare에 등록된 도메인이 있어야 쓸 수 있으므로 선택이 아니라 필수다.
- [ ] **저장소 이전 여부.** 현재 저장소는 개인 계정 `00PJH/pg_demo`에 있다. 조직으로 이전(Transfer)하면 기존 URL은 자동으로 리다이렉트된다. 권장: 이전한다.
- [ ] **저장소 공개 여부.** 템플릿에 실습용 의도적 버그와 해설이 들어 있으므로 비공개를 권장한다. GitHub 무료 조직도 비공개 저장소는 무제한이다.
- [ ] **GPU 호스트 층 담당자 1명.** 보안 사고가 나는 곳이 이 층이라 한 사람이 끝까지 책임진다. 4장 참고.

### 2.2 계정 만들기 (이 순서대로)

**원칙: 루트 계정 1개 + 개인 계정으로 멤버 참여.** 루트 계정은 조직을 만들 때와 비상시에만 쓴다. 평소 작업은 각자 개인 계정으로 한다. 한 사람이 빠져도 서비스가 멈추지 않는다.

1. - [ ] **Bitwarden 조직 (무료, 2인)** — 가장 먼저. 이후 단계에서 나오는 모든 비밀번호·키가 여기로 간다. 카카오톡, 노션, 이메일에 비밀을 적지 않기로 합의한다.
2. - [ ] **루트 Gmail** (예: `plaiground.team@gmail.com`). 2단계 인증을 TOTP(인증 앱) 방식으로 켜고, **TOTP 시드를 Bitwarden에 저장**해 두 사람 모두 코드를 만들 수 있게 한다. 복구 전화번호는 두 사람 중 한 명, 복구 이메일은 다른 한 명으로.
3. - [ ] **Cloudflare 계정** — 루트 Gmail로 가입. 두 사람의 개인 이메일을 Members에 Super Administrator로 초대. 계정 전체에 2단계 인증 강제.
4. - [ ] **도메인 구매** — Cloudflare Registrar에서 원가로 구매(연 1~2만 원대). `.kr`은 지원하지 않으므로 `.com` / `.dev` / `.app` 중에서 고른다. 결제 카드는 개인 카드로 등록하고, 사업자등록 후 청구 정보만 바꾼다.
5. - [ ] **Cloudflare Email Routing** (무료) — `admin@도메인`, `hello@도메인`을 루트 Gmail로 포워딩. 수신 전용이며 계정 가입·알림 수신에는 이것으로 충분하다.
6. - [ ] **GitHub Organization** (무료) — 루트 계정으로 생성, 두 사람의 개인 GitHub 계정을 Owner로 초대. 조직 설정에서 2단계 인증 필수로. 그 뒤 2.1에서 합의했다면 `pg_demo`를 조직으로 이전하고, 각자 로컬에서 원격 주소를 갱신한다.
7. - [ ] **Supabase Organization** (무료) — 루트 계정으로 생성, 두 사람을 Owner로 초대. 프로젝트 2개 생성: `plaiground-dev`, `plaiground-prod`. 리전은 Northeast Asia (Seoul). DB 비밀번호는 Bitwarden으로. 무료 등급은 활성 프로젝트 2개까지이고, **7일간 요청이 없으면 일시정지**되므로 Phase 5에서 핑을 건다.
8. - [ ] **Google Cloud 프로젝트** — 루트 Gmail로 생성. 용도는 "Google로 로그인"용 OAuth 클라이언트 하나뿐이다. 클라이언트 ID/시크릿은 Bitwarden에 넣고 Supabase 대시보드 Auth 설정에 입력한다.
9. - [ ] **Cloudflare R2와 Zero Trust 활성화** — 둘 다 무료 등급이지만 활성화할 때 결제 수단 등록을 요구한다. 과금은 0원이며, R2에는 지출 알림을 걸어 둔다.

### 2.3 하지 않아도 되는 것

- **플랫폼용 Gemini 키 발급.** 개인 사용자는 본인 키를 넣는 방식(BYOK)으로 가므로 플랫폼 키가 필요 없다. 기관(교수) 패키지용 플랫폼 키는 파일럿 계약이 잡힌 뒤에 만든다.
- **Google Workspace, 유료 플랜.** 전부 무료 등급으로 시작한다.

### 완료 기준

두 사람 모두 **자기 개인 계정으로** GitHub 조직, Cloudflare, Supabase 두 프로젝트에 로그인되고, Bitwarden에서 루트 계정의 비밀번호와 TOTP 코드를 볼 수 있다.

---

## 3. 단계별 로드맵

기간은 두 사람이 파트타임으로 일한다는 가정의 추정치다.

| 단계 | 내용 | 기간 | 끝나면 되는 것 |
|---|---|---|---|
| Phase 0 | 예비 작업 (2장) | 3시간 | 협업 가능한 계정 체계 |
| Phase 1 | 로컬에서 "배포 모양"으로 리팩터 | 1주 | IDE 안에서 플랫폼 소스와 키가 안 보임 |
| Phase 2 | 엣지 층 배포 | 2주 | 공개 URL, 회원가입, 커뮤니티 실사용 |
| Phase 3 | GPU 호스트를 터널로 공개 (시연용) | 1주 | 다른 노트북에서 전체 흐름 시연 |
| Phase 4 | 멀티유저 워크스페이스 | 3~4주 | 학생 여러 명 동시 사용 |
| Phase 5 | 파일럿 운영 준비 | 1주 (Phase 4와 병행) | 약관, 백업, 모니터링 |

Phase 1과 Phase 2는 서로 의존하지 않아 **동시에 진행**할 수 있다. 4장의 분담이 이 구분을 따른다.

### Phase 1 — 로컬 리팩터 (GPU 호스트 층 담당)

배포하지 않고 로컬에서 한다. 끝나도 로컬 데모는 그대로 동작해야 한다.

- [ ] **텔레메트리 SDK를 pip 패키지로 분리.** `portfolio_demo/telemetry/`(interceptor, tracker, recorder)를 휠로 만들어 베이스 이미지에 설치한다. 이렇게 하면 컨테이너가 `PYTHONPATH=/workspace`로 레포를 볼 이유가 사라진다.
- [ ] **레포 마운트 제거.** `provisioner.py`의 `-v {_REPO_ROOT}:/workspace`를 사용자별 워크스페이스 디렉터리 마운트로 바꾼다. 생성된 학습 스크립트만 그 안에 복사한다.
- [ ] **텔레메트리 기록 위치 분리.** SDK가 레포 경로가 아니라 워크스페이스 안의 정해진 디렉터리에 쓰고, API 서버가 거기서 읽는다.
- [ ] **설정을 환경변수로.** 포트, 데이터 디렉터리, 허용 오리진(CORS), 인증 on/off. 로컬 기본값은 지금과 동일하게.
- [ ] **Gemini BYOK.** `_call_gemini`가 키를 인자로 받고, `/api/portfolio/run`은 요청 헤더로 키를 받아 서브프로세스에 **env로** 전달한다(argv는 프로세스 목록에 보인다). 키는 저장하지 않고 로그에 남기지 않는다. 프론트는 `sessionStorage`에 보관.
- [ ] **`run` 파라미터 경로 검증.** `/api/viz/*`의 `_viz_run_dir()`와 같은 검증을 `/api/portfolio/*`에도 적용.
- [ ] **인증 훅 자리 만들기.** 모든 `/api/*` 앞에서 Supabase JWT를 검증하는 함수. 로컬에서는 환경변수로 끈다.

**완료 기준:** 로컬에서 Start AI → Web IDE → 학습 → 포트폴리오 생성이 그대로 되고, IDE 터미널에서 `ls /workspace`를 했을 때 자기 학습 스크립트만 보이며 `grep -r GEMINI /`에 아무것도 안 나온다.

### Phase 2 — 엣지 층 배포 (엣지 층 담당)

- [ ] **Supabase 스키마와 RLS.** 테이블 초안은 5장. Supabase의 `anon key`는 SPA에 그대로 노출되는 공개 키이므로 **RLS(행 수준 보안)가 유일한 방어선**이다. 모든 테이블에 RLS를 켜고, 정책 없이 만든 테이블이 없는지 확인한다.
- [ ] **커뮤니티 글 40건 시드.** `community_demo/posts.py`를 SQL 시드로 변환.
- [ ] **로그인.** Supabase Auth + Google OAuth. 이메일 로그인은 무료 등급의 발송 한도가 매우 낮아 기본으로 쓰지 않는다. 학생은 BYOK 때문에 어차피 Google 계정이 필요하다.
- [ ] **SPA 수정.** 커뮤니티 API 4개(`posts`, `comments`, `interact`, `comment`)를 `supabase-js` 직접 호출로 교체. 나머지 `/api/*` 호출은 `src/api.js`의 호출 함수 하나로 모아 주소, 인증 헤더, Gemini 키 헤더를 한 곳에서 붙인다. 지금은 `fetch` 15곳과 `EventSource` 2곳이 컴포넌트에 흩어져 있고 전부 상대 경로다.
- [ ] **SSE를 `fetch` 스트리밍으로 교체.** `EventSource`는 요청 헤더를 설정할 수 없어 인증 토큰과 Gemini 키를 보낼 수 없다. 키를 URL 쿼리에 넣는 것은 로그에 남으므로 금지. 대상은 `/api/setup`, `/api/portfolio/run` 두 곳.
- [ ] **관리자 역할.** 현재 Login 드롭다운의 "관리자" 선택을 `profiles.role`로 교체. Faculty LMS는 `role = 'faculty'`만 접근.
- [ ] **Cloudflare Pages 연결.** GitHub 조직 저장소 연결, 빌드 디렉터리 `web_combine_demo/app`, `main` 푸시 시 자동 배포, PR마다 미리보기 URL.
- [ ] **GPU 호스트 오프라인 상태 처리.** Start AI, Web IDE, View AI 화면에서 API가 응답하지 않으면 "워크스페이스 서버가 꺼져 있습니다" 안내를 띄운다.

**완료 기준:** 처음 보는 사람이 `https://도메인`에 들어와 Google로 가입하고, 커뮤니티 글을 읽고 댓글을 쓰고, 다른 계정으로는 그 댓글을 수정할 수 없다.

### Phase 3 — GPU 호스트를 터널로 공개 (시연용)

준형의 PC(Windows + Docker Desktop)를 그대로 쓴다. 동시 사용자 1명이라는 한계를 명시적으로 받아들이는 단계다.

- [ ] **Cloudflare Tunnel.** `cloudflared`로 `api.도메인` → `localhost:8770`, `ide.도메인` → `localhost:8080`. 공유기 포트는 열지 않는다.
- [ ] **Cloudflare Access 정책.** IDE 호스트를 이메일 허용 목록(두 사람 + 파일럿 테스터) 뒤에 둔다. 무료 등급 50명까지. API 호스트까지 Access 뒤에 두면 다른 주소의 SPA에서 `fetch`할 때 호스트별 쿠키와 CORS 사전 요청 문제로 막힐 가능성이 높다. 첫날 시험해 보고, 막히면 API는 아래 JWT 검증만으로 보호한다.
- [ ] **API JWT 검증 켜기.** Phase 1에서 만든 훅을 활성화.
- [ ] **(권장) API를 SPA와 같은 주소 아래로.** 작은 Cloudflare Worker가 `도메인/api/*`를 터널로 넘긴다. 같은 출처가 되어 CORS 설정이 필요 없고 프론트의 상대 경로를 그대로 쓴다.
- [ ] **산출물 업로드.** 포트폴리오 생성이 끝나면 HTML/MD/JSON을 R2에 올리고 Supabase `portfolios`에 행을 추가한다. View AI의 `frames.bin`도 R2로. 이후 포트폴리오 열람은 GPU 호스트 없이 된다.
- [ ] **동시 실행 잠금.** 컨테이너가 하나이므로 한 번에 한 세션만. 사용 중이면 "다른 사용자가 사용 중" 안내.

**완료 기준:** 상협이 자기 노트북에서 로그인 → Start AI → Web IDE에서 학습 → 본인 Gemini 키로 포트폴리오 생성까지 완료하고, 그 뒤 준형의 PC를 꺼도 포트폴리오가 열린다.

### Phase 4 — 멀티유저 워크스페이스

여기서부터 리눅스 GPU 호스트(NVIDIA Container Toolkit)가 필요하다. 시간제 GPU 임대(RunPod, Vast 등) 또는 학교 서버. 실제 학생을 받기 전에 반드시 끝낸다.

- [ ] **사용자별 컨테이너 + 볼륨.** 컨테이너를 절대 공유하지 않는다.
- [ ] **리버스 프록시.** Supabase JWT를 확인해 **그 사용자의 컨테이너로만** 라우팅.
- [ ] **컨테이너 강화.** non-root, `--cap-drop ALL`, `--security-opt no-new-privileges`, 읽기 전용 rootfs(`/workspace`, `/tmp`만 쓰기), `--pids-limit`, 메모리·GPU 제한, 도커 소켓 미마운트. 가능하면 gVisor.
- [ ] **네트워크 이그레스 허용 목록.** Hugging Face Hub, PyPI, 허용할 LLM API만. 나머지 차단.
- [ ] **유휴 종료와 사용량 한도.** 비용과 공격 표면을 같이 줄인다.
- [ ] **텔레메트리 수집 API.** SDK가 파일이 아니라 호스트 API로 전송. 토큰은 해당 `run_id`에만 유효한 단명 토큰.
- [ ] **서버 서명.** 호스트가 잡은 실제 학습 로그와 SDK 보고를 대조한 뒤 서버 개인키(Ed25519)로 서명. 지금의 SHA-256은 변조 감지일 뿐 진위 증명이 아니다.

**완료 기준:** 두 계정이 동시에 학습을 돌리고, 한쪽 IDE에서 다른 쪽 파일·프로세스·네트워크에 닿을 수 없음을 6장의 점검표로 확인한다.

### Phase 5 — 파일럿 운영 준비

- [ ] **이용약관·개인정보 처리방침.** Gemini 무료 키를 쓰면 입력 데이터가 Google의 학습에 쓰일 수 있다는 고지를 키 입력 화면과 약관에 넣는다.
- [ ] **백업.** Supabase 무료 등급은 시점 복구가 없다. `pg_dump`를 주기적으로 R2에 올린다.
- [ ] **가동 확인 핑.** 외부 모니터가 주기적으로 Supabase를 호출하게 해 7일 일시정지도 같이 막는다.
- [ ] **장애 대응 문서.** 키 유출 시 교체 절차, 컨테이너 탈출 의심 시 절차.
- [ ] **지출 상한.** R2, GPU 임대에 알림과 상한.

---

## 4. 역할 분담 (제안)

경계선은 "GPU 호스트 층"과 "엣지 층"이다. 두 층은 5장의 인터페이스만 맞추면 독립적으로 진행된다. 누가 어느 쪽을 맡을지는 두 사람이 정하되, **GPU 호스트 층은 한 사람이 Phase 1·3·4를 끝까지** 맡는다.

| | GPU 호스트 층 | 엣지 층 |
|---|---|---|
| 담당 단계 | Phase 1, 3, 4 | Phase 2, 5 |
| 다루는 것 | Python API 서버, Docker, 텔레메트리 SDK, Tunnel/Access, 보안 강화 | Supabase 스키마·RLS·Auth, SPA 수정, Pages 배포, 약관·문서 |
| 필요한 장비 | NVIDIA GPU PC | 없음 |

같이 하는 것: Phase 0 전체, 5장 인터페이스 확정, Phase 3 완료 기준 시연, Phase 4 보안 점검.

협업 규칙:
- `main`에 직접 푸시하지 않는다. 브랜치 → PR → 상대방 확인 → 머지. 무료 조직의 비공개 저장소는 브랜치 보호를 강제하지 못하므로 합의로 지킨다.
- 구 저장소 `origin`(`plaiground_portfolio_demo`)에는 푸시하지 않는다.
- 비밀은 Bitwarden에만. 저장소에는 `.env.example`만 올린다.

---

## 5. 두 층 사이의 인터페이스 (초안)

Phase 1과 2를 동시에 시작하려면 이것부터 확정해야 한다. 아래는 출발점이며 첫 회의에서 고친다.

### Supabase 테이블

| 테이블 | 주요 컬럼 | 쓰기 권한 |
|---|---|---|
| `profiles` | `id`(= auth.uid), `display_name`, `role`(`student`/`faculty`/`admin`) | 본인. `role`은 서비스 키만 |
| `posts` | `id`, `category`, `title`, `summary`, `body`, `tags`, `practice_code`, `source_url` | 관리자(시드) |
| `comments` | `id`, `post_id`, `user_id`, `body`, `created_at` | 로그인 사용자, 수정·삭제는 본인 |
| `post_interactions` | `post_id`, `user_id`, `kind`(`like`/`bookmark`/`view`) | 본인 행만 |
| `runs` | `run_id`, `user_id`, `model_id`, `started_at`, `error_count`, `status` | GPU 호스트(서비스 키) |
| `portfolios` | `run_id`, `user_id`, `r2_key_html`, `r2_key_md`, `signature`, `created_at` | GPU 호스트(서비스 키) |

읽기: `posts`와 `comments`는 전체 공개, `runs`와 `portfolios`는 본인과 `faculty`만.

### 현재 API 17개의 이동 경로

| 현재 엔드포인트 | 배포 후 |
|---|---|
| `/api/community/posts`, `comments`, `interact`, `comment` | **Supabase 직접 호출로 교체** (Phase 2) |
| `/api/community/practice` | GPU 호스트 유지. 실습 코드를 IDE 워크스페이스에 넣는 동작이라서 |
| `/api/status`, `/api/models`, `/api/setup`, `/api/ide/status` | GPU 호스트 유지 |
| `/api/portfolio/run` | GPU 호스트 유지 + 요청 헤더로 Gemini 키 수신 |
| `/api/portfolio/runs`, `data`, `telemetry`, `output`, `export.md` | Phase 3부터 Supabase + R2에서 읽기. GPU 호스트가 꺼져도 열람 가능하게 |
| `/api/viz/runs`, `schema`, `rows`, `frame` | Phase 3부터 R2에서 읽기 |

GPU 호스트로 가는 모든 요청에는 `Authorization: Bearer <Supabase JWT>`를 붙인다.

### 비밀 목록

| 이름 | 어디에 두나 | 비고 |
|---|---|---|
| Supabase `anon key` | SPA 빌드 환경변수 | 공개 키. RLS가 전제 |
| Supabase `service_role key` | GPU 호스트 환경변수만 | **SPA·저장소·컨테이너에 절대 넣지 않는다.** RLS를 우회한다 |
| Supabase DB 비밀번호 | Bitwarden | 마이그레이션 실행 시에만 사용 |
| Google OAuth 클라이언트 시크릿 | Supabase 대시보드 | |
| Cloudflare API 토큰 | GitHub Actions 시크릿 | Pages 자동 배포를 Actions로 할 경우만 |
| Tunnel 토큰, R2 액세스 키 | GPU 호스트 환경변수 | |
| 서명용 Ed25519 개인키 | GPU 호스트만 | Phase 4 |
| 사용자 Gemini 키 | **어디에도 저장하지 않는다** | 요청 단위로 메모리에서만 사용 |

---

## 6. 보안 점검표 (Phase 4 완료 기준)

테스트 계정으로 Web IDE에 들어가 직접 시도한다. 전부 실패해야 통과다.

- [ ] `ls /workspace`에 자기 파일 외의 것이 보인다
- [ ] `grep -ri "key\|secret\|token" / 2>/dev/null`에서 플랫폼 비밀이 나온다
- [ ] `env`에 플랫폼 비밀이 있다
- [ ] 다른 사용자의 컨테이너 IP나 호스트의 API 포트에 접속된다
- [ ] 허용 목록 밖의 외부 주소로 `curl`이 된다
- [ ] `docker` 소켓이나 호스트 파일시스템에 닿는다
- [ ] 로그아웃 상태 또는 다른 계정의 JWT로 남의 IDE URL이 열린다
- [ ] 텔레메트리 파일을 고쳐서 성능 수치가 바뀐 포트폴리오에 유효한 서명이 붙는다
- [ ] 에러 메시지에 지시문을 심어 Gemini가 스키마 밖의 내용을 포트폴리오에 쓰게 만든다

---

## 7. 첫 회의에서 정할 것

1. 도메인 이름
2. 저장소를 조직으로 이전할지, 비공개로 둘지
3. GPU 호스트 층 담당자
4. 5장의 테이블·엔드포인트 초안 확정
5. Phase 3 시연 목표 날짜
