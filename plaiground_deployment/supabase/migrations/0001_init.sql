-- 0001_init.sql — Supabase 초기 스키마 (B2-2)
-- 근거: plaiground_deployment/assignment_edge_sanghyup.md 3장 (B0 회의 확정)
-- 실행: Supabase 대시보드(plaiground-dev) → SQL Editor에 전체 붙여넣기 → Run
-- 원칙: 모든 테이블 RLS 활성화. anon 키는 브라우저에 노출되므로 RLS가 유일한 방어선.
--       runs·portfolios에 쓰기 정책이 없는 것은 의도 — service_role(호스트)은 RLS를 우회한다.

-- ─── profiles ─────────────────────────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  role text not null default 'student' check (role in ('student','faculty','admin')),
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;
create policy "profiles read all" on profiles for select using (true);
-- 본인 행만 수정 가능. with check의 서브쿼리는 갱신 전 스냅샷을 보므로
-- role을 기존 값과 다르게 바꾸는 UPDATE는 거부된다(본인의 role 상승 차단).
create policy "profiles update own" on profiles for update using (auth.uid() = id)
  with check (auth.uid() = id and role = (select p.role from profiles p where p.id = auth.uid()));

-- 가입 시 profiles 행 자동 생성. security definer이므로 search_path를 고정한다.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ─── posts ────────────────────────────────────────────────────────────────────
create table posts (
  id text primary key, category text not null, title text not null, summary text, content text,
  tags text[] default '{}', author text, source_name text, source_url text,
  practice_filename text, practice_code text, created_at timestamptz
);
alter table posts enable row level security;
create policy "posts read all" on posts for select using (true);
-- 쓰기 정책 없음: 시드는 service_role로만.

-- ─── comments ─────────────────────────────────────────────────────────────────
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
create index comments_post_id_idx on comments (post_id);

-- ─── post_interactions ────────────────────────────────────────────────────────
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
-- 집계 뷰 — 소유자(postgres) 권한으로 실행되어 RLS를 우회하므로 전체 카운트가 보인다.
-- 개별 행(누가 눌렀는지)은 RLS로 본인 것만 보인다.
create view post_counts as
  select post_id,
         count(*) filter (where kind = 'like')     as likes,
         count(*) filter (where kind = 'bookmark') as bookmarks,
         count(*) filter (where kind = 'view')     as views
  from post_interactions group by post_id;

-- ─── runs (Stage C에서 호스트가 service_role로 씀) ────────────────────────────
create table runs (
  run_id text primary key, user_id uuid not null references profiles, model_id text,
  started_at timestamptz, error_count int default 0, status text
);
alter table runs enable row level security;
create policy "runs read own or faculty" on runs for select
  using (auth.uid() = user_id or exists (select 1 from profiles where id = auth.uid() and role in ('faculty','admin')));

-- ─── portfolios (Stage C에서 호스트가 service_role로 씀) ──────────────────────
create table portfolios (
  run_id text primary key references runs on delete cascade, user_id uuid not null references profiles,
  data jsonb not null, signature text, created_at timestamptz not null default now()
);
alter table portfolios enable row level security;
create policy "portfolios read own or faculty" on portfolios for select
  using (auth.uid() = user_id or exists (select 1 from profiles where id = auth.uid() and role in ('faculty','admin')));
