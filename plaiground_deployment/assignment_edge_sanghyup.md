# 분담 업무 계획서 — 엣지 층 (한상협)

작성일: 2026-09-22 · 기준: [MASTER_PLAN.md](MASTER_PLAN.md) Stage A~C · 짝 문서: [assignment_host_junhyung.md](assignment_host_junhyung.md)

이 문서는 코드베이스를 처음 보는 사람을 기준으로 썼다. 0장과 1장을 먼저 읽고, 저장소 루트의 [README.md](../README.md)와 [CLAUDE.md](../CLAUDE.md)를 그다음에 읽으면 된다.

## 0. 맡는 것

GPU 호스트가 꺼져 있어도 인터넷에서 항상 열려 있어야 하는 것. React 프론트엔드(`apps/web`), Supabase(로그인·DB), Cloudflare Pages(호스팅), 그리고 약관·백업 같은 운영 준비.

**목표 한 줄:** 처음 보는 사람이 `https://<이름>.pages.dev`에 들어와 Google로 가입하고, 커뮤니티 글을 읽고 댓글을 쓰고, 다른 계정으로는 그 댓글을 고칠 수 없다. (Stage B 완료 기준)

**소유 폴더:** `apps/web/`, `plaiground_deployment/supabase/`, `plaiground_deployment/cloudflare/`, `docs/`. `apps/host/`와 `packages/telemetry/`는 준형 소유이므로 서버 변경이 필요하면 `docs/interface.md`에 적고 준형에게 요청한다.

전부 무료 등급이고 카드 등록은 없다. 필요한 장비는 노트북뿐이다(GPU 불필요).

## 1. 첫날 — 환경 준비 (약 1시간)

1. 준형에게 받은 초대 수락: Bitwarden 조직, Cloudflare, GitHub 조직 `menotis`, Supabase 조직 `menotis`, Tailscale. 개인 이메일과 GitHub 아이디를 준형에게 미리 알려 준다.
2. Bitwarden에서 루트 Gmail·Cloudflare·Supabase 항목의 "설정 키"를 내 휴대폰 인증 앱(Google Authenticator 등)에 등록한다. 이걸 해야 준형 없이도 로그인할 수 있다.
3. 저장소 클론 (조직 이전 후 주소는 회의에서 확인). 옛 구조를 클론한 적이 있으면 지우고 새로 받는다.
4. 설치와 점검:
   ```bash
   pip install -e packages/telemetry -e apps/host   # Python 3.10+
   cd apps/web && npm install && cd ../..           # Node 20+
   python scripts/check.py                          # 전부 통과해야 정상
   ```
5. 실행해 보기:
   ```bash
   python -m plaiground_host.api_server   # 터미널 1 → http://127.0.0.1:8770
   cd apps/web && npm run dev             # 터미널 2 → http://127.0.0.1:5173
   ```
   Docker가 없어도 커뮤니티·포트폴리오 화면은 열린다. Start AI는 "Docker 데몬 STOPPED"로 보이는 게 정상이다.
6. 읽을 것: `README.md`, `CLAUDE.md`, `apps/web/DESIGN.md`(디자인 규칙), 이 폴더의 `DEPLOYMENT_PLAN.md` 3장 Phase 2와 5장.

### 프론트 코드 지도

`apps/web/src/`는 파일 11개짜리 평면 구조다.

| 파일 | 역할 | 이번 작업과의 관계 |
|---|---|---|
| `App.jsx` | 해시 라우팅, 상단 바, 랜딩, `LoginMenu`(역할 상태 `role`은 클라이언트 변수) | 로그인을 Supabase 세션으로 교체 |
| `Community.jsx` | 글 목록·글 페이지·댓글. `fetch` 5곳 | 호출 4개를 Supabase 직접 호출로 |
| `PortfolioView.jsx` | 실행 선택, 생성(SSE), 리포트 렌더. `fetch` 3곳 + `EventSource` 1곳 | `api.js` 경유로, SSE를 `fetch` 스트리밍으로 |
| `StartAI.jsx` | 환경 세팅 위저드. `fetch` 2곳 + `EventSource` 1곳 | 같음 |
| `ViewAI.jsx`, `Network3D.jsx`, `netLayout.js` | 학습 시각화. `fetch` 4곳 | `api.js` 경유로만 |
| `IdeView.jsx` | code-server iframe. `fetch` 1곳 | 같음 + 호스트 오프라인 안내 |
| `Lms.jsx` | 교수용 화면, 샘플 데이터 | `role === 'faculty'`만 접근 |

백엔드 쪽에서 알아야 할 것은 하나다. 커뮤니티 데이터의 원본은 `apps/host/plaiground_host/community/posts.py`(글 40건, 파이썬 리스트)와 `service.py`(추천·조회·댓글·실습 스테이징)다. 글 한 건의 필드: `id, category, title, summary, content, tags, author, created_at, likes, views, bookmarks, source{name,url}, practice{filename,code}`.

## 2. Stage B — 엣지 층 배포 (약 2주)

순서가 중요하다. **B2-1을 가장 먼저 머지해야** 준형의 서버 작업과 같은 줄에서 충돌하지 않는다. PR은 항목 단위로 하나씩, 준형이 확인한 뒤 머지.

| # | 작업 | 손댈 곳 | 완료 기준 |
|---|---|---|---|
| B2-1 | **`api.js` 도입** — `apps/web/src/api.js`에 `api(path, options)` 하나와 `apiStream(path, onEvent)` 하나. 주소는 `import.meta.env.VITE_API_BASE`(로컬은 빈 값), 헤더는 여기서만 붙인다. 컴포넌트의 `fetch` 15곳과 `EventSource` 2곳을 전부 이것으로 교체. SSE는 `fetch` 응답의 `body.getReader()`로 읽어 `event:`/`data:` 줄을 해석(EventSource는 헤더를 못 붙여서 쓸 수 없다) | `src/api.js`(신규), 컴포넌트 7개 | 동작 변화 없음. `grep -rn "fetch(\|EventSource" src/`가 `api.js`에서만 나온다 |
| B2-2 | **Supabase 스키마** — 테이블은 이 문서 3장. SQL을 `plaiground_deployment/supabase/migrations/0001_init.sql`로 저장하고 `plaiground-dev`의 SQL Editor에서 실행. **모든 테이블에 RLS를 켠다.** `anon key`는 브라우저에 그대로 노출되는 공개 키라 RLS가 유일한 방어선이다 | `supabase/migrations/` | 정책 없는 테이블이 없다. 다른 계정의 댓글을 `UPDATE`하면 0행 |
| B2-3 | **글 40건 시드** — `posts.py`의 `POSTS`를 읽어 `INSERT` SQL을 출력하는 파이썬 스크립트 하나(`supabase/seed_posts.py`). 출력물을 `0002_seed_posts.sql`로 저장해 실행 | `supabase/seed_posts.py`, `0002_seed_posts.sql` | `posts` 40행, 카테고리별 10행 |
| B2-4 | **로그인** — Supabase Auth. 제공자는 Google(테스트 상태, 등록 테스터만). GitHub은 선택. 프론트에 `@supabase/supabase-js` 추가(이 작업에서 유일한 새 의존성). `App.jsx`의 `role` 상태를 세션 + `profiles.role`로 교체. 가입 시 `profiles` 행을 만드는 트리거는 SQL로 | `App.jsx`, `src/supabase.js`(신규), `package.json`, `0003_profiles_trigger.sql` | Google로 가입되고 새로고침해도 로그인이 유지된다. Faculty LMS는 `role='faculty'`일 때만 탭에 보인다 |
| B2-5 | **커뮤니티를 Supabase로** — `posts`, `comments`, `interact`, `comment` 호출 4개를 `supabase-js`로. 실습해보기(`/api/community/practice`)만 호스트 API에 남긴다(IDE 워크스페이스에 파일을 넣는 동작이라서) | `Community.jsx` | 호스트 서버를 꺼도 커뮤니티가 동작한다. 댓글은 본인만 삭제 가능 |
| B2-6 | **Cloudflare Pages** — GitHub 조직 저장소 연결. Root directory `apps/web`, Build command `npm run build`, Output `dist`. 환경변수 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE`. `main` 푸시 시 자동 배포, PR마다 미리보기 URL | Pages 대시보드, `cloudflare/README.md`에 설정값 기록 | 공개 URL에서 로그인·커뮤니티가 된다 |
| B2-7 | **호스트 오프라인 안내** — `api.js`가 연결 실패를 한 종류의 오류로 던지고, Start AI·Web IDE·View AI·Portfolio 생성 버튼이 "워크스페이스 서버가 꺼져 있습니다" 안내를 띄운다. 포트폴리오 **열람**은 Stage C부터 Supabase에서 읽으므로 이 안내와 무관 | `api.js`, 화면 4개 | 호스트를 끄고 공개 URL을 열어도 깨진 화면이 없다 |

디자인 규칙은 `apps/web/DESIGN.md`를 따른다. 새 화면(로그인 상태, 오프라인 안내)도 기존 톤을 유지한다.

## 3. Supabase 테이블 (초안 — 회의에서 확정)

| 테이블 | 컬럼 | RLS |
|---|---|---|
| `profiles` | `id uuid` (= `auth.users.id`), `display_name`, `role text default 'student'` (`student`/`faculty`/`admin`), `created_at` | 읽기: 전체. 수정: 본인, 단 `role`은 `service_role`만 |
| `posts` | `id text`, `category`, `title`, `summary`, `content`, `tags text[]`, `author`, `source_name`, `source_url`, `practice_filename`, `practice_code`, `created_at` | 읽기: 전체. 쓰기: `service_role`만(시드) |
| `comments` | `id bigserial`, `post_id`, `user_id uuid`, `body`, `created_at` | 읽기: 전체. 삽입: 로그인 사용자(`user_id = auth.uid()`). 수정·삭제: 본인 |
| `post_interactions` | `post_id`, `user_id`, `kind` (`like`/`bookmark`/`view`), `created_at`, PK(`post_id`,`user_id`,`kind`) | 본인 행만. 집계(좋아요 수)는 뷰 또는 `count` 쿼리로 |
| `runs` | `run_id text`, `user_id`, `model_id`, `started_at`, `error_count`, `status` | 읽기: 본인 + `faculty`. 쓰기: `service_role`(호스트) |
| `portfolios` | `run_id`, `user_id`, `data jsonb`, `signature`, `created_at` | 읽기: 본인 + `faculty`. 쓰기: `service_role`(호스트) |

`runs`와 `portfolios`는 Stage C에서 준형의 서버가 쓴다. B2-2에서 테이블만 만들어 두면 된다. 기존 시드 댓글(`service.py`의 `_SEED_COMMENTS`)은 작성자가 가상 인물이라 옮기지 않는다.

## 4. 준형과의 접점

이것이 `docs/interface.md`에 적혀 있어야 두 사람이 서로 기다리지 않는다. 회의에서 확정한다.

| 항목 | 제안 값 | 프론트에서 할 일 |
|---|---|---|
| 인증 헤더 | `Authorization: Bearer <session.access_token>` | `api.js`가 모든 `/api/*`에 붙인다 |
| Gemini 키 | `X-Gemini-Key` 헤더 | 포트폴리오 화면에 키 입력 칸. `sessionStorage`에만 보관, "이 브라우저에 기억"은 선택제. 입력 칸 옆에 "무료 키를 쓰면 입력 데이터가 Google 학습에 쓰일 수 있습니다" 한 줄 |
| 호스트 주소 | `VITE_API_BASE` | 로컬 빈 값, Pages에는 준형이 알려 주는 `ts.net` 주소 |
| 엔드포인트 경로 | 변경 없음 | — |
| 호스트 → Supabase 쓰기 | `runs`, `portfolios`에 `service_role`로 | 테이블 정의를 준형에게 공유 |

## 5. Stage C에서 할 것 (준형의 B1과 합류, 약 1주)

- [ ] Pages 환경변수 `VITE_API_BASE`를 Tailscale 주소로
- [ ] 포트폴리오 열람을 Supabase `portfolios`에서 읽도록 (`PortfolioView.jsx`). MD 내보내기는 프론트가 `data`에서 생성
- [ ] 첫날 확인: 공개 사이트에서 `ts.net` 호출이 브라우저에 막히는지. 결과를 준형에게
- [ ] 완료 기준 시연: 내 노트북에서 로그인 → Start AI → 학습 → 포트폴리오 생성

## 6. Stage D — 운영 준비 (Stage C 이후)

이용약관·개인정보 처리방침(Gemini 무료 키 고지 포함), `pg_dump` 백업을 두 PC에 보관, Supabase 7일 일시정지를 막는 외부 핑, 장애 대응 문서. 상세는 `DEPLOYMENT_PLAN.md` Phase 5.

## 7. 규칙

- `main` 직접 푸시 금지. 브랜치 → PR → 준형 확인 → 머지.
- 비밀은 Bitwarden에만. `service_role` 키는 프론트 코드·환경변수에 **절대** 넣지 않는다(RLS를 우회하는 관리자 키). 프론트에는 `anon` 키만.
- `.env`, `.dev.vars` 파일은 커밋하지 않는다. `.env.example`에 변수 이름만.
- `apps/host/`, `packages/telemetry/`는 고치지 않는다. 필요하면 `docs/interface.md`에 요청을 적는다.
- AI 코딩 도구를 쓸 때는 저장소 루트의 `CLAUDE.md`가 자동으로 읽힌다. 거기 적힌 금지 사항이 곧 팀 규칙이다.
- 새 npm 의존성은 `supabase-js` 하나만. 그 외에 추가하고 싶으면 PR 설명에 이유를 적는다.

## 8. 일정 (파트타임 기준)

| 주 | 할 것 |
|---|---|
| 1주차 | 환경 준비, 회의, B2-1(가장 먼저 머지), B2-2, B2-3 |
| 2주차 | B2-4 ~ B2-7 |
| 3주차 | Stage C. 준형의 B1과 합류 |

막히면 준형에게 알리는 것이 먼저다. 한쪽이 멈추면 다른 쪽도 Stage C에 못 들어간다.
