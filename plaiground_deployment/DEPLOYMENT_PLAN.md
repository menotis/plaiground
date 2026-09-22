# plAI-ground 배포 전환 계획

작성일: 2026-09-21 · 기준 커밋: `6340c88` · 대상 독자: 박준형, 한상협

> **실행 순서는 [MASTER_PLAN.md](MASTER_PLAN.md)를 따른다.** 이 문서는 각 단계의 상세 체크리스트와 근거다. 폴더 이동([directory_plan.md](directory_plan.md)) 이후에는 이 문서의 경로가 `web_combine_demo/app` → `apps/web`, `ai_set_demo`·`portfolio_demo` → `apps/host`, `portfolio_demo/telemetry` → `packages/telemetry`로 바뀐다.

이 문서 하나로 "지금 무엇이 막혀 있고, 무엇을 먼저 만들어야 하고, 어떤 순서로 배포까지 가는지"를 알 수 있게 썼다. 위에서부터 순서대로 진행하면 된다. 각 단계에는 **완료 기준**이 있고, 그 기준을 통과해야 다음 단계로 간다.

> 무료 등급 한도 수치는 서비스 측에서 수시로 바뀐다. 이 문서의 수치는 계획용이며, 가입 시점에 각 요금 페이지에서 다시 확인한다.

> **비용 원칙 (2026-09-21 수정): 도메인 구매도, 카드 등록도 없이 0원으로 간다.** 처음 계획에 있던 도메인, Cloudflare Tunnel·Access, R2는 뺐다. 돈이 필요해지는 시점과 금액은 8장에 따로 적었다.

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
  Cloudflare Pages   React SPA. 주소는 무료로 주어지는 <프로젝트>.pages.dev
  Supabase           로그인, 커뮤니티 글·댓글, 실행 기록, 포트폴리오 본문(JSON)

[GPU 호스트 층]  켜져 있을 때만 동작
  API 서버           환경 세팅, 학습 실행, 포트폴리오 생성, View AI 데이터
  Docker + code-server  사용자별 워크스페이스
  Tailscale 뒤에만 노출 (공유기 포트를 열지 않는다). 주소는 무료로 주어지는 <PC이름>.<tailnet>.ts.net
```

핵심 설계 원칙 두 가지:
- **GPU 호스트가 꺼져 있어도 커뮤니티와 포트폴리오 열람은 동작해야 한다.** 그래서 생성된 산출물은 엣지 층으로 올려 둔다.
- **컨테이너 안에는 비밀이 하나도 없어야 한다.** 사용자가 IDE에서 Claude나 Codex를 연결해도, 읽을 수 있는 것이 자기 파일뿐이면 빼갈 것이 없다.

---

## 2. Phase 0 — 예비 작업 (약 3시간, 두 사람이 같이)

배포 작업을 시작하기 전에 끝내야 하는 계정·합의 작업이다. **순서가 중요하다.** 뒤 항목이 앞 항목에 의존한다.

사업자등록은 필요 없다. 아래 서비스는 모두 이메일만으로 조직을 만들 수 있다.

### 2.1 먼저 합의할 것 3가지

- [ ] **저장소 이전 여부.** 현재 저장소는 개인 계정 `00PJH/pg_demo`에 있다. 조직으로 이전(Transfer)하면 기존 URL은 자동으로 리다이렉트된다. 권장: 이전한다.
- [ ] **저장소 공개 여부.** 템플릿에 실습용 의도적 버그와 해설이 들어 있으므로 비공개를 권장한다. GitHub 무료 조직도 비공개 저장소는 무제한이다.
- [ ] **GPU 호스트 층 담당자 1명.** 보안 사고가 나는 곳이 이 층이라 한 사람이 끝까지 책임진다. 4장 참고.

### 2.2 계정 만들기 (이 순서대로)

**원칙: 루트 계정 1개 + 개인 계정으로 멤버 참여.** 루트 계정은 조직을 만들 때와 비상시에만 쓴다. 평소 작업은 각자 개인 계정으로 한다. 한 사람이 빠져도 서비스가 멈추지 않는다.

1. - [ ] **Bitwarden 조직 (무료, 2인)** — 가장 먼저. 이후 단계에서 나오는 모든 비밀번호·키가 여기로 간다. 카카오톡, 노션, 이메일에 비밀을 적지 않기로 합의한다. **마스터 비밀번호는 분실하면 복구할 방법이 없다.** 종이에 적어 안전한 곳에 두고, Bitwarden 자체에도 2단계 인증을 켠다. 공유할 항목은 개인 보관함이 아니라 조직의 컬렉션에 넣어야 상대에게 보인다.
2. - [ ] **루트 Gmail** (예: `plaiground.team@gmail.com`). 2단계 인증을 TOTP(인증 앱) 방식으로 켜고, **TOTP 설정 키(QR 아래 "설정 키" 문자열)를 Bitwarden 항목의 숨김 필드에 저장**하고, 두 사람이 각자의 인증 앱에 같은 키를 등록해 둘 다 코드를 만들 수 있게 한다. Bitwarden 안에서 코드를 자동 생성하는 기능은 유료라서 무료 플랜에서는 이 방식으로 한다. 복구 전화번호는 두 사람 중 한 명, 복구 이메일은 다른 한 명으로.
3. - [ ] **Cloudflare 계정** — 루트 Gmail로 가입. 용도는 Pages(SPA 호스팅) 하나다. 카드 등록 없이 된다. 두 사람의 개인 이메일을 Members에 Super Administrator로 초대. 계정 전체에 2단계 인증 강제.
4. - [ ] **GitHub Organization** (무료) — **준형의 개인 GitHub 계정으로 생성**하고 상협의 개인 계정을 두 번째 Owner로 초대. GitHub은 조직에 별도 로그인이 없고, 여러 사람이 함께 쓰는 공용 개인 계정은 약관상 허용되지 않으므로 루트 계정을 만들지 않는다. Owner가 둘이면 한 사람이 빠져도 조직이 유지된다. 조직 설정에서 2단계 인증 필수로. 그 뒤 2.1에서 합의했다면 `pg_demo`를 조직으로 이전하고, 각자 로컬에서 원격 주소를 갱신한다.
5. - [ ] **Supabase Organization** (무료) — 루트 계정으로 생성, 두 사람을 Owner로 초대. 조직은 하나(`menotis`, Type은 Startup)이고 그 안에 프로젝트를 만든다. 지금은 `plaiground-dev` 하나만 만든다. `plaiground-prod`는 실제 배포 직전(Phase 2)에 만든다. 미리 만들면 요청이 없어 일주일 뒤 일시정지된다. 리전은 Northeast Asia (Seoul). DB 비밀번호는 Bitwarden으로. 무료 등급은 활성 프로젝트 2개까지이고, **7일간 요청이 없으면 일시정지**되므로 Phase 5에서 핑을 건다.
6. - [ ] **로그인용 OAuth 앱 2개** — 둘 다 무료이고 도메인이 필요 없다. 클라이언트 ID/시크릿은 Bitwarden에 넣고 Supabase 대시보드 Auth 설정에 입력한다. 리디렉션 주소는 Supabase가 알려 주는 `https://<프로젝트>.supabase.co/auth/v1/callback`을 그대로 쓴다.
   - **GitHub OAuth App**: GitHub 조직 설정에서 만든다. 심사도 사용자 수 제한도 없다. 기본 로그인 수단으로 쓴다.
   - **Google OAuth 클라이언트**: 루트 Gmail로 Google Cloud 프로젝트를 만들어 생성한다. 동의 화면은 "테스트" 상태로 두고 테스터 이메일을 등록한다(최대 100명). 파일럿 규모에는 충분하다. 정식 게시는 도메인이 생긴 뒤에 한다.
7. - [ ] **Tailscale** (무료 Personal 플랜) — 루트 Gmail로 가입해 tailnet을 만들고 두 사람의 개인 계정을 초대한다. GPU 호스트 PC와 각자의 노트북에 설치한다. Phase 3에서 쓴다. **무료 플랜은 비상업적 용도 한정**이라 두 사람의 개발·시연에만 쓰고, 외부 사용자를 받을 때는 8장의 방법으로 바꾼다.

### 2.3 하지 않아도 되는 것

- **플랫폼용 Gemini 키 발급.** 개인 사용자는 본인 키를 넣는 방식(BYOK)으로 가므로 플랫폼 키가 필요 없다. 기관(교수) 패키지용 플랫폼 키는 파일럿 계약이 잡힌 뒤에 만든다.
- **Google Workspace, 유료 플랜.** 전부 무료 등급으로 시작한다.
- **도메인 구매, 카드 등록.** 도메인은 Cloudflare Tunnel·Access·Email Routing을 쓰기 위한 것이었다. 셋 다 뺐으므로 지금은 필요 없다. 알림과 가입 메일은 루트 Gmail이 직접 받는다.
- **Cloudflare R2, Zero Trust.** 무료 등급이지만 활성화에 카드 등록이 필요하다. 포트폴리오 본문은 몇 KB짜리 JSON이라 Supabase 테이블에 넣으면 되고, View AI 프레임은 당분간 GPU 호스트가 직접 서빙한다.

### 완료 기준

두 사람 모두 **자기 개인 계정으로** GitHub 조직, Cloudflare, Supabase 두 프로젝트, Tailscale tailnet에 로그인되고, Bitwarden에서 루트 계정의 비밀번호와 2단계 인증 설정 키를 볼 수 있다. 이 시점까지 쓴 돈은 0원이고 등록한 카드도 없다.

---

## 3. 단계별 로드맵

기간은 두 사람이 파트타임으로 일한다는 가정의 추정치다.

| 단계 | 내용 | 기간 | 끝나면 되는 것 |
|---|---|---|---|
| Phase 0 | 예비 작업 (2장) | 3시간 | 협업 가능한 계정 체계 |
| Phase 1 | 로컬에서 "배포 모양"으로 리팩터 | 1주 | IDE 안에서 플랫폼 소스와 키가 안 보임 |
| Phase 2 | 엣지 층 배포 | 2주 | 공개 URL, 회원가입, 커뮤니티 실사용 |
| Phase 3 | GPU 호스트를 Tailscale로 연결 (두 사람 시연용) | 1주 | 다른 노트북에서 전체 흐름 시연 |
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
- [ ] **로그인.** Supabase Auth + GitHub OAuth(기본) + Google OAuth(테스트 상태, 등록된 테스터만). 이메일 로그인은 무료 등급의 발송 한도가 매우 낮아 기본으로 쓰지 않는다.
- [ ] **SPA 수정.** 커뮤니티 API 4개(`posts`, `comments`, `interact`, `comment`)를 `supabase-js` 직접 호출로 교체. 나머지 `/api/*` 호출은 `src/api.js`의 호출 함수 하나로 모아 주소, 인증 헤더, Gemini 키 헤더를 한 곳에서 붙인다. 지금은 `fetch` 15곳과 `EventSource` 2곳이 컴포넌트에 흩어져 있고 전부 상대 경로다.
- [ ] **SSE를 `fetch` 스트리밍으로 교체.** `EventSource`는 요청 헤더를 설정할 수 없어 인증 토큰과 Gemini 키를 보낼 수 없다. 키를 URL 쿼리에 넣는 것은 로그에 남으므로 금지. 대상은 `/api/setup`, `/api/portfolio/run` 두 곳.
- [ ] **관리자 역할.** 현재 Login 드롭다운의 "관리자" 선택을 `profiles.role`로 교체. Faculty LMS는 `role = 'faculty'`만 접근.
- [ ] **Cloudflare Pages 연결.** GitHub 조직 저장소 연결, 빌드 디렉터리 `apps/web`, `main` 푸시 시 자동 배포, PR마다 미리보기 URL. 공개 주소는 `https://<프로젝트>.pages.dev`이고, 프로젝트 이름은 나중에 바꾸기 번거로우니 `plaiground`처럼 신중히 정한다.
- [ ] **GPU 호스트 오프라인 상태 처리.** Start AI, Web IDE, View AI 화면에서 API가 응답하지 않으면 "워크스페이스 서버가 꺼져 있습니다" 안내를 띄운다.

**완료 기준:** 처음 보는 사람이 `https://<프로젝트>.pages.dev`에 들어와 GitHub으로 가입하고, 커뮤니티 글을 읽고 댓글을 쓰고, 다른 계정으로는 그 댓글을 수정할 수 없다.

### Phase 3 — GPU 호스트를 Tailscale로 연결 (두 사람 시연용)

준형의 PC(Windows + Docker Desktop)를 그대로 쓴다. 동시 사용자 1명, 접속자는 tailnet에 들어온 두 사람뿐이라는 한계를 명시적으로 받아들이는 단계다.

도메인 없이 쓸 수 있는 터널을 비교한 결과다. Cloudflare의 임시 터널(`trycloudflare.com`)은 계정도 도메인도 필요 없지만 **SSE를 지원하지 않는다.** 환경 세팅과 포트폴리오 생성 로그가 SSE라서 쓸 수 없다. Tailscale은 고정된 `ts.net` 주소와 HTTPS 인증서를 무료로 주고 스트리밍에 제약이 없다.

- [ ] **Tailscale Serve (비공개).** 호스트 PC에서 `tailscale serve`로 API(8770)와 IDE(8080)를 tailnet 안에만 HTTPS로 연다. 인터넷에는 전혀 노출되지 않으므로 code-server가 아직 `--auth none`이어도 안전하다. 공유기 포트는 열지 않는다.
- [ ] **허용 오리진 설정.** SPA(`pages.dev`)와 API(`ts.net`)의 주소가 다르므로 Phase 1에서 만든 허용 오리진 설정에 Pages 주소를 넣는다.
- [ ] **API JWT 검증 켜기.** Phase 1에서 만든 훅을 활성화. tailnet 안이라도 켠다. 나중에 공개로 바꿀 때 그대로 쓰인다.
- [ ] **첫날 확인할 것.** 공개 사이트(`pages.dev`)에서 사설 대역 주소(`ts.net`은 100.x로 해석됨)를 호출하면 크롬이 "로컬 네트워크 접근 허용"을 물을 수 있다. 직접 시험해 보지 못했다. 허용해도 막히면 API만 `tailscale funnel`(공개 주소, 포트 443·8443·10000만 가능)로 바꾸고 JWT 검증에 맡긴다. IDE는 Serve로 남긴다.
- [ ] **산출물 올리기.** 포트폴리오 생성이 끝나면 본문 JSON을 Supabase `portfolios` 테이블에 넣는다. 한 건이 몇 KB라 파일 저장소가 필요 없다. SPA는 이미 JSON으로 포트폴리오를 그리므로 HTML은 올리지 않는다. 이후 포트폴리오 열람은 GPU 호스트 없이 된다. View AI 프레임(실행당 약 18MB)은 이 단계에서는 호스트가 직접 서빙하고, 호스트가 꺼져 있으면 View AI만 안내 화면을 띄운다.
- [ ] **동시 실행 잠금.** 컨테이너가 하나이므로 한 번에 한 세션만. 사용 중이면 "다른 사용자가 사용 중" 안내.

**완료 기준:** 상협이 자기 노트북에서 로그인 → Start AI → Web IDE에서 학습 → 본인 Gemini 키로 포트폴리오 생성까지 완료하고, 그 뒤 준형의 PC를 꺼도 포트폴리오가 열린다.

### Phase 4 — 멀티유저 워크스페이스

실제 학생을 받기 전에 반드시 끝낸다. **개발과 검증은 준형의 PC에서 0원으로 한다.** Docker Desktop도 내부는 리눅스라 아래 격리 옵션이 대부분 그대로 동작한다(gVisor 제외). 돈이 드는 것은 여러 명이 동시에 쓰기 시작할 때의 GPU 호스트이고, 그 시점과 무료로 구하는 길은 8장에 있다.

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
- [ ] **백업.** Supabase 무료 등급은 시점 복구가 없다. `pg_dump`를 주기적으로 받아 두 사람의 PC에 각각 보관한다.
- [ ] **가동 확인 핑.** 외부 모니터가 주기적으로 Supabase를 호출하게 해 7일 일시정지도 같이 막는다.
- [ ] **장애 대응 문서.** 키 유출 시 교체 절차, 컨테이너 탈출 의심 시 절차.
- [ ] **유료 전환 점검.** 8장의 세 가지 시점 중 어느 것에 가까워졌는지 확인하고, 유료 항목을 켤 때는 지출 알림과 상한을 같이 건다.

---

## 4. 역할 분담 (제안)

경계선은 "GPU 호스트 층"과 "엣지 층"이다. 두 층은 5장의 인터페이스만 맞추면 독립적으로 진행된다. 누가 어느 쪽을 맡을지는 두 사람이 정하되, **GPU 호스트 층은 한 사람이 Phase 1·3·4를 끝까지** 맡는다.

| | GPU 호스트 층 | 엣지 층 |
|---|---|---|
| 담당 단계 | Phase 1, 3, 4 | Phase 2, 5 |
| 다루는 것 | Python API 서버, Docker, 텔레메트리 SDK, Tailscale, 보안 강화 | Supabase 스키마·RLS·Auth, SPA 수정, Pages 배포, 약관·문서 |
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
| `portfolios` | `run_id`, `user_id`, `data`(jsonb, 포트폴리오 본문), `signature`, `created_at` | GPU 호스트(서비스 키) |

읽기: `posts`와 `comments`는 전체 공개, `runs`와 `portfolios`는 본인과 `faculty`만.

### 현재 API 17개의 이동 경로

| 현재 엔드포인트 | 배포 후 |
|---|---|
| `/api/community/posts`, `comments`, `interact`, `comment` | **Supabase 직접 호출로 교체** (Phase 2) |
| `/api/community/practice` | GPU 호스트 유지. 실습 코드를 IDE 워크스페이스에 넣는 동작이라서 |
| `/api/status`, `/api/models`, `/api/setup`, `/api/ide/status` | GPU 호스트 유지 |
| `/api/portfolio/run` | GPU 호스트 유지 + 요청 헤더로 Gemini 키 수신 |
| `/api/portfolio/runs`, `data`, `telemetry`, `output`, `export.md` | Phase 3부터 Supabase에서 읽기. GPU 호스트가 꺼져도 열람 가능하게. MD 내보내기는 SPA가 JSON에서 만든다 |
| `/api/viz/runs`, `schema`, `rows`, `frame` | GPU 호스트 유지. 파일 저장소로 옮기는 것은 8장의 유료 전환 이후 |

GPU 호스트로 가는 모든 요청에는 `Authorization: Bearer <Supabase JWT>`를 붙인다.

### 비밀 목록

| 이름 | 어디에 두나 | 비고 |
|---|---|---|
| Supabase `anon key` | SPA 빌드 환경변수 | 공개 키. RLS가 전제 |
| Supabase `service_role key` | GPU 호스트 환경변수만 | **SPA·저장소·컨테이너에 절대 넣지 않는다.** RLS를 우회한다 |
| Supabase DB 비밀번호 | Bitwarden | 마이그레이션 실행 시에만 사용 |
| GitHub·Google OAuth 클라이언트 시크릿 | Supabase 대시보드 | |
| Cloudflare API 토큰 | GitHub Actions 시크릿 | Pages 자동 배포를 Actions로 할 경우만 |
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

1. 저장소를 조직으로 이전할지, 비공개로 둘지
2. GPU 호스트 층 담당자
3. 5장의 테이블·엔드포인트 초안 확정
4. Phase 3 시연 목표 날짜
5. Cloudflare Pages 프로젝트 이름 (공개 주소 `<이름>.pages.dev`가 된다)

---

## 8. 돈이 필요해지는 시점

Phase 0부터 Phase 3까지, 그리고 Phase 4의 개발과 검증까지는 0원이다. 아래 세 시점에서만 돈이 든다. 각각 그 시점이 오기 전에는 쓰지 않는다.

| 시점 | 필요한 것 | 비용 | 무료로 버티는 길 |
|---|---|---|---|
| 두 사람 외의 사용자(파일럿 학생, 교수)가 GPU 기능을 쓸 때 | 도메인 1개. Cloudflare Tunnel과 Access를 쓸 수 있게 된다. Tailscale 무료 플랜은 비상업적 용도 한정이라 외부 사용자 대상 서비스에는 맞지 않는다 | 연 1~2만 원대 | 그 전까지는 외부에 엣지 층(커뮤니티, 포트폴리오 열람)만 공개하고, GPU 기능은 대면 시연이나 화면 공유로 보여 준다 |
| 여러 명이 동시에 학습을 돌릴 때 | 리눅스 GPU 호스트 | 시간제 임대 | 학교 연구실 서버, 클라우드 스타트업 크레딧(사업자등록 후 신청 가능한 것이 많다), 창업 지원금. 그 전까지는 준형의 PC에서 한 번에 한 명 |
| 기관(교수) 패키지를 팔 때 | 플랫폼용 Gemini 유료 키 | 사용량 비례 | 개인 사용자는 계속 본인 키(BYOK)라 0원 |

도메인을 나중에 붙여도 고칠 코드는 없다. API 주소와 허용 오리진을 설정값으로 빼 두기 때문이다(Phase 1). 도메인이 생기면 Pages에 연결하고, Tailscale 자리에 Cloudflare Tunnel을 넣고, Google OAuth를 정식 게시하면 된다.
