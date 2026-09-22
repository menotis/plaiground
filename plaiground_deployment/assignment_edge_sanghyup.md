# 분담 업무 계획서 — 엣지 층 (한상협)

갱신: 2026-09-22 (3판 — 스키마 확정, 협업 규칙은 [../CONTRIBUTING.md](../CONTRIBUTING.md)) · 기준: [MASTER_PLAN.md](MASTER_PLAN.md) Stage B~C · 짝 문서: [assignment_host_junhyung.md](assignment_host_junhyung.md)

## 0. 현재 위치

| 항목 | 상태 |
|---|---|
| B2-1 `api.js` 도입, SSE를 fetch 스트리밍으로 | **완료, `main` 병합** |
| 헤더 자리 (`Authorization`, `X-Gemini-Key`), 400/401 본문 전달 | **완료, `main` 병합** |
| 준형 쪽 B1(호스트 리팩터) | **완료, `main` 병합.** 서버는 `python -m plaiground_host.server`. 인증·CORS·BYOK 헤더 수신 준비됨 |
| Google OAuth 클라이언트 | **준형이 만들어 Supabase `plaiground-dev`에 넣어 둠.** B2-4에서 바로 쓸 수 있음 |
| 컨테이너 이미지 | `docker pull ghcr.io/menotis/plaiground-base:dev` (공개, 로그인 불필요) |
| 남은 것 | **B2-2 → B2-3 → 키 입력 칸 → B2-4 → B2-5 → B2-6 → B2-7** (4장) |

**목표 한 줄:** 처음 보는 사람이 `https://<이름>.pages.dev`에 들어와 Google로 가입하고, 커뮤니티 글을 읽고 댓글을 쓰고, 다른 계정으로는 그 댓글을 고칠 수 없다. 준형 PC가 꺼져 있어도 이것은 동작한다.

**소유 폴더:** `apps/web/`, `plaiground_deployment/supabase/`, `plaiground_deployment/cloudflare/`, `docs/`. 서버(`apps/host`)를 바꿔야 하면 [../docs/interface.md](../docs/interface.md)에 요청을 적고 준형에게 말한다.

## 1. 환경 (노트북 포함)

절차는 [laptop_and_tailscale.md](laptop_and_tailscale.md) A장. 요약:

```bash
git clone git@github.com:menotis/plaiground.git && cd plaiground
pip install -e packages/telemetry -e apps/host
cd apps/web && npm install && cd ../..
docker pull ghcr.io/menotis/plaiground-base:dev     # Start AI 실습에만 필요. B2 작업에는 불필요
python scripts/check.py                              # 전부 통과 확인
python -m plaiground_host.server                     # 터미널 1, http://127.0.0.1:8770
cd apps/web && npm run dev                           # 터미널 2, http://127.0.0.1:5173
```

B2 작업은 GPU도 Docker도 필요 없다. 커뮤니티·로그인·Pages는 노트북에서 전부 된다.

### 프론트 코드 지도

| 파일 | 역할 | 이번 작업 |
|---|---|---|
| `src/api.js` | 모든 API 호출. `api()`, `apiStream()`, `setAccessTokenGetter()`, `GEMINI_KEY_STORAGE` | B2-4에서 토큰 공급자 연결 |
| `src/App.jsx` | 해시 라우팅, 상단 바, `LoginMenu`. `role` 상태(`null`/`'student'`/`'admin'`)는 클라이언트 변수 | B2-4에서 Supabase 세션으로 교체 |
| `src/Community.jsx` | 글 목록·글 페이지·댓글·실습해보기 | B2-5에서 Supabase 직접 호출로 |
| `src/PortfolioView.jsx` | 실행 선택, 생성(SSE), 리포트 | 키 입력 칸 추가 |
| `src/Lms.jsx` | 교수용 화면 | `role === 'faculty'`만 |
| `src/StartAI.jsx`, `IdeView.jsx`, `ViewAI.jsx` | 호스트 기능 | B2-7 오프라인 안내만 |

커뮤니티 원본 데이터: `apps/host/plaiground_host/community/posts.py`의 `POSTS` (40건). 한 건의 필드는 `id, category, title, summary, content, tags, author, created_at, likes, views, bookmarks, source{name,url}, practice{filename,code}`.

## 2. 규칙

- 협업 규칙 전체는 [../CONTRIBUTING.md](../CONTRIBUTING.md). 요약: 브랜치 `feat/b2-2-schema` 식, PR 하나에 작업 하나, 상대 리뷰 후 작성자가 Squash merge, `gh` CLI 사용.
- 새 npm 의존성은 `@supabase/supabase-js` 하나만.
- 프론트에는 Supabase **`anon` 키만**. `service_role` 키는 어디에도 넣지 않는다.
- `.env`, `.env.local`, `.dev.vars`는 커밋하지 않는다. `.env.example`에 변수 이름만.
- 디자인은 `apps/web/DESIGN.md`를 따른다. 새 화면(키 입력, 로그인 상태, 오프라인 안내)도 기존 톤.
- 작업 끝에 `python scripts/check.py`. 프론트 빌드가 포함되어 있다.

## 3. Supabase 테이블 (B0 회의에서 확정)

| 테이블 | 컬럼 | RLS |
|---|---|---|
| `profiles` | `id uuid PK` (= `auth.users.id`), `display_name text`, `role text not null default 'student'` (`student`/`faculty`/`admin`), `created_at timestamptz default now()` | 읽기: 전체. 수정: 본인, 단 `role`은 본인이 못 바꿈 |
| `posts` | `id text PK`, `category`, `title`, `summary`, `content`, `tags text[]`, `author`, `source_name`, `source_url`, `practice_filename`, `practice_code`, `created_at` | 읽기: 전체. 쓰기: `service_role`만(시드) |
| `comments` | `id bigserial PK`, `post_id → posts`, `user_id → profiles`, `body`, `created_at` | 읽기: 전체. 삽입: `auth.uid() = user_id`. 수정·삭제: 본인 |
| `post_interactions` | `post_id`, `user_id`, `kind` (`like`/`bookmark`/`view`), `created_at`, PK(`post_id`,`user_id`,`kind`) | 본인 행만. 집계는 뷰 `post_counts` |
| `runs` | `run_id text PK`, `user_id`, `model_id`, `started_at`, `error_count`, `status` | 읽기: 본인 + `faculty`/`admin`. 쓰기: `service_role`(호스트) |
| `portfolios` | `run_id PK → runs`, `user_id`, `data jsonb`, `signature`, `created_at` | 읽기: 본인 + `faculty`/`admin`. 쓰기: `service_role`(호스트) |

`runs`와 `portfolios`는 Stage C에서 준형의 서버가 쓴다. 지금은 테이블만 만든다. `portfolios.data`의 내용은 `/api/portfolio/data`가 돌려주는 JSON 그대로다.

## 4. 작업 순서와 상세

### B2-2 — 스키마와 RLS (1시간, SQL은 준비됨)

**SQL 파일이 이미 있다:** `plaiground_deployment/supabase/migrations/0001_init.sql`, `0002_roles.sql`. 적용 절차는 [supabase/README.md](supabase/README.md). 아래 초안은 참고용이며 파일이 원본이다.

1. ~~SQL 작성~~ → 파일을 SQL Editor에 붙여 실행. 초안:

```sql
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  role text not null default 'student' check (role in ('student','faculty','admin')),
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;
create policy "profiles read all" on profiles for select using (true);
create policy "profiles update own" on profiles for update using (auth.uid() = id)
  with check (auth.uid() = id and role = (select p.role from profiles p where p.id = auth.uid()));

create or replace function handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

create table posts (
  id text primary key, category text not null, title text not null, summary text, content text,
  tags text[] default '{}', author text, source_name text, source_url text,
  practice_filename text, practice_code text, created_at timestamptz
);
alter table posts enable row level security;
create policy "posts read all" on posts for select using (true);

create table comments (
  id bigserial primary key,
  post_id text not null references posts on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table comments enable row level security;
create policy "comments read all" on comments for select using (true);
create policy "comments insert own" on comments for insert with check (auth.uid() = user_id);
create policy "comments update own" on comments for update using (auth.uid() = user_id);
create policy "comments delete own" on comments for delete using (auth.uid() = user_id);

create table post_interactions (
  post_id text not null references posts on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  kind text not null check (kind in ('like','bookmark','view')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, kind)
);
alter table post_interactions enable row level security;
create policy "interactions own" on post_interactions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create view post_counts as
  select post_id,
         count(*) filter (where kind = 'like')     as likes,
         count(*) filter (where kind = 'bookmark') as bookmarks,
         count(*) filter (where kind = 'view')     as views
  from post_interactions group by post_id;

create table runs (
  run_id text primary key, user_id uuid not null references profiles, model_id text,
  started_at timestamptz, error_count int default 0, status text
);
alter table runs enable row level security;
create policy "runs read own or faculty" on runs for select
  using (auth.uid() = user_id or exists (select 1 from profiles where id = auth.uid() and role in ('faculty','admin')));

create table portfolios (
  run_id text primary key references runs on delete cascade, user_id uuid not null references profiles,
  data jsonb not null, signature text, created_at timestamptz not null default now()
);
alter table portfolios enable row level security;
create policy "portfolios read own or faculty" on portfolios for select
  using (auth.uid() = user_id or exists (select 1 from profiles where id = auth.uid() and role in ('faculty','admin')));
```

2. Supabase 대시보드 → SQL Editor에 붙여 실행. 오류가 나면 문장 단위로 나눠 실행한다.
3. **확인:** Table Editor에서 6개 테이블 모두 RLS가 켜져 있다. `runs`·`portfolios`에 insert 정책이 없는 것은 의도다(`service_role`은 RLS를 우회).
4. 커밋 대상은 SQL 파일만. 대시보드 URL이나 키는 적지 않는다.

기존 시드 댓글(`service.py`의 `_SEED_COMMENTS`)은 작성자가 가상 인물이라 옮기지 않는다.

### B2-3 — 글 40건 시드 (2시간)

1. `plaiground_deployment/supabase/seed_posts.py`: `from plaiground_host.community.posts import POSTS`로 읽어 `insert into posts (...) values (...)` SQL을 출력한다. `'`는 `''`로, `tags`는 `array['a','b']`. `likes/views/bookmarks`는 가상 숫자라 옮기지 않는다.
2. `python plaiground_deployment/supabase/seed_posts.py > plaiground_deployment/supabase/migrations/0003_seed_posts.sql`
3. SQL Editor에서 실행. `select category, count(*) from posts group by 1` → 4개 카테고리 각 10.
4. 스크립트와 생성된 SQL 둘 다 커밋.

### 키 입력 칸 — Gemini BYOK 프론트 (2시간)

`api.js`는 이미 `sessionStorage`의 `plaiground.gemini_key`를 읽어 `/api/portfolio/run`에 붙인다. 저장하는 UI만 없다.

1. `PortfolioView.jsx`의 "포트폴리오 생성 실행" 버튼 근처에 입력 칸. `type="password"`, placeholder "Gemini API 키 (AI Studio)". 값이 바뀌면 `sessionStorage.setItem(GEMINI_KEY_STORAGE, value)`, 비우면 `removeItem`.
2. 한 줄 고지: "키는 이 브라우저 탭에만 저장되고 서버에 남지 않습니다. 무료 키를 쓰면 입력 데이터가 Google의 모델 개선에 쓰일 수 있습니다." 발급 링크 `https://aistudio.google.com/apikey`.
3. "이 브라우저에 기억" 체크박스는 선택. 체크하면 `localStorage`에도 저장.
4. 키가 없을 때 버튼을 막지는 않는다. 로컬 서버는 자기 `.env` 키로 폴백한다.
5. **확인:** 잘못된 키를 넣으면 로그 창에 "API key not valid"가 뜬다. 서버 로그에 키 값은 없다.

### B2-4 — Google 로그인 (하루)

OAuth 클라이언트는 준형이 Supabase에 넣어 두었다. 테스트 사용자로 등록된 Google 계정(두 사람)만 로그인된다.

1. `cd apps/web && npm install @supabase/supabase-js`
2. `src/supabase.js`:
   ```js
   import { createClient } from '@supabase/supabase-js';
   export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
   ```
   `apps/web/.env.example`에 두 변수 이름 추가. 실제 값은 `.env.local`(gitignore)에. `anon` 키는 Supabase → Project Settings → API.
3. `App.jsx`: `role` 상태를 세션 기반으로.
   - 마운트 시 `supabase.auth.getSession()`, `supabase.auth.onAuthStateChange`로 갱신.
   - 세션이 생기면 `profiles`에서 `select role, display_name`.
   - 세션이 바뀔 때마다 `setAccessTokenGetter(() => session?.access_token ?? null)`. 이걸로 모든 `/api/*`에 `Authorization`이 붙는다.
   - `LoginMenu`의 "학생/관리자" 버튼을 "Google로 로그인" 하나로. `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })`. 로그아웃은 `supabase.auth.signOut()`.
   - Faculty LMS 탭과 `effectiveView`의 `admin` 비교를 `profile.role in ('faculty','admin')`로.
4. 첫 `faculty`는 Supabase Table Editor에서 `profiles.role`을 손으로 바꿔 지정한다.
5. **확인:** Google로 로그인 → 새로고침해도 유지 → `profiles`에 행 생성 → 로그아웃 동작.

### B2-5 — 커뮤니티를 Supabase로 (하루)

`Community.jsx`의 호출 4개를 `supabase-js`로. 실습해보기(`/api/community/practice`)는 그대로 호스트.

| 지금 | 바꿀 것 |
|---|---|
| `api('/api/community/posts')` | `supabase.from('posts').select('*')` + `supabase.from('post_counts').select('*')`를 합침 |
| `api('/api/community/comments?post_id=')` | `supabase.from('comments').select('*, profiles(display_name)').eq('post_id', id).order('created_at')` |
| `api('/api/community/comment', POST)` | `supabase.from('comments').insert({ post_id, user_id: session.user.id, body })`. 비로그인은 "로그인 후 댓글" 안내 |
| `api('/api/community/interact', POST)` | like/bookmark는 `post_interactions`에 `upsert`/`delete`. view는 로그인 사용자만 기록 |

댓글 삭제 버튼은 `comment.user_id === session.user.id`일 때만 보인다. RLS가 최종 방어선이지만 UI에서도 숨긴다.

**확인:** 호스트 서버를 끄고 커뮤니티가 동작한다. 다른 계정으로 남의 댓글 삭제를 시도하면 0행.

### B2-6 — Cloudflare Pages (2시간)

1. Cloudflare → Workers & Pages → Create → Pages → Connect to Git → 조직 `menotis` → `plaiground`.
2. Production branch `main`, **Root directory `apps/web`**, Build command `npm run build`, Output `dist`.
3. 환경변수(Production·Preview): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE`(지금은 빈 값).
4. 프로젝트 이름은 B0에서 정한 것. 공개 주소 `<이름>.pages.dev`.
5. Supabase → Authentication → URL Configuration → Site URL과 Redirect URLs에 Pages 주소 추가. 없으면 로그인 후 `localhost`로 튕긴다.
6. `plaiground_deployment/cloudflare/README.md`에 설정값 기록(키 값 제외).

**확인:** `main` 푸시 → 자동 배포. PR → 미리보기 URL.

### B2-7 — 호스트 오프라인 안내 (반나절)

`api.js`에서 네트워크 실패를 한 종류의 오류로 감싸고, `StartAI`·`IdeView`·`ViewAI`·`PortfolioView`(생성 버튼)가 그 오류를 받으면 "워크스페이스 서버가 꺼져 있습니다. GPU 호스트가 켜지면 다시 시도하세요."를 띄운다.

**확인:** 호스트를 끄고 공개 URL을 열어도 깨진 화면이 없다.

## 5. Stage B 완료 기준

처음 보는 사람이 `https://<이름>.pages.dev`에 들어와 Google로 가입하고, 커뮤니티 글을 읽고 댓글을 쓰고, 다른 계정으로는 그 댓글을 고칠 수 없다. 준형 PC는 꺼져 있어도 된다.

## 6. 준형과의 접점

| 항목 | 값 |
|---|---|
| 인증 헤더 | `Authorization: Bearer <session.access_token>` — `api.js`가 이미 붙임 |
| Gemini 키 | `X-Gemini-Key` — `api.js`가 이미 붙임. 입력 칸만 추가 |
| 호스트 주소 | `VITE_API_BASE`. 로컬 빈 값, Stage C에서 준형이 알려 주는 `https://<pc>.<tailnet>.ts.net` |
| 서버가 쓸 테이블 | `runs`, `portfolios`. 3장 확정 후 준형이 구현 |
| 서버 변경 요청 | [../docs/interface.md](../docs/interface.md)에 적기 |

## 7. 일정 (파트타임)

| 주 | 할 것 |
|---|---|
| 이번 주 | B0 회의, B2-2, B2-3, 키 입력 칸 |
| 다음 주 | B2-4, B2-5 |
| 그다음 주 | B2-6, B2-7, Stage C 합류 |

막히면 30분 안에 준형에게 알린다.
