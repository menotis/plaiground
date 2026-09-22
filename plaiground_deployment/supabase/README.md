# Supabase

프로젝트: 조직 `menotis` → `plaiground-dev` (Seoul). `plaiground-prod`는 Stage C 직전에 만든다.

## 마이그레이션 적용 (손으로, 순서대로)

Supabase CLI 없이 대시보드 SQL Editor에서 한다. 파일 하나를 통째로 붙여 Run.

| 순서 | 파일 | 언제 |
|---|---|---|
| 1 | `migrations/0001_init.sql` | B2-2. 테이블 6개, RLS, 트리거, 뷰 |
| 2 | `migrations/0002_roles.sql` | B2-2. `set_role` 함수. 마지막 `update`는 준형이 첫 로그인을 한 뒤 이메일을 바꿔 실행 |
| 3 | `migrations/0003_seed_posts.sql` | B2-3. `seed_posts.py`가 생성 |

한 번 실행한 파일은 고치지 않는다. 바꿀 것이 있으면 `0004_...sql`을 새로 만든다. 이렇게 하면 dev에서 실행한 순서를 prod에서 그대로 재현할 수 있다.

## 실행 후 확인

- Table Editor에서 `profiles, posts, comments, post_interactions, runs, portfolios` 6개에 RLS 표시가 있다.
- `select count(*) from posts` → 40 (0003 이후).
- 브라우저에서 Google 로그인 → `profiles`에 행이 자동으로 생긴다 (트리거).
- 다른 계정으로 남의 댓글 `update`를 시도 → 0 rows.

## 키

| 키 | 어디에 | 비고 |
|---|---|---|
| `anon` | 프론트 `VITE_SUPABASE_ANON_KEY`, Pages 환경변수 | 공개 키. RLS가 전제 |
| `service_role` | GPU 호스트 환경변수 `SUPABASE_SERVICE_ROLE_KEY` (Stage C) | **프론트·저장소·컨테이너·채팅 금지.** RLS를 우회한다 |
| DB 비밀번호 | Bitwarden | 대시보드 밖에서 psql 붙일 때만 |

## 역할

`student`(기본) / `faculty` / `admin`. 첫 admin은 준형(0002 마지막 문장). faculty 지정은 admin이 `rpc('set_role', {target, new_role})`. 본인은 자기 역할을 못 바꾼다(트리거).
