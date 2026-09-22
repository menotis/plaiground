-- 0001_init.sql — plAI-ground 스키마 (확정 2026-09-22)
-- 실행: Supabase 대시보드 → SQL Editor → 전체 붙여 Run. 순서대로 0001 → 0002.
-- 원칙: 모든 테이블 RLS on. anon 키는 브라우저에 노출되므로 RLS가 유일한 방어선.
--       runs / portfolios 는 GPU 호스트가 service_role 로만 쓴다 (insert 정책 없음 = 의도).

-- ── profiles: auth.users 1:1. 가입 시 트리거로 생성 ─────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text,
  role         text not null default 'student' check (role in ('student','faculty','admin')),
  created_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles: read all"   on public.profiles for select using (true);
create policy "profiles: update own" on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- role 은 본인이 못 바꾼다 — update 정책이 아니라 트리거로 막는다 (with check 안의 self-select 는 재귀 위험)
create or replace function public.protect_role() returns trigger language plpgsql as $$
begin
  if new.role <> old.role and coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'role 은 관리자만 바꿀 수 있습니다';
  end if;
  return new;
end $$;

create or replace function public.is_admin() returns boolean language sql stable security definer as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;
create or replace function public.is_staff() returns boolean language sql stable security definer as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('faculty','admin'))
$$;

create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_role();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── posts: 커뮤니티 글. 시드는 service_role 로 ──────────────────────────────
create table public.posts (
  id                text primary key,
  category          text not null,
  title             text not null,
  summary           text,
  content           text,
  tags              text[] not null default '{}',
  author            text,
  source_name       text,
  source_url        text,
  practice_filename text,
  practice_code     text,
  created_at        timestamptz
);
alter table public.posts enable row level security;
create policy "posts: read all" on public.posts for select using (true);
create index posts_category_idx on public.posts (category);

-- ── comments ────────────────────────────────────────────────────────────────
create table public.comments (
  id         bigserial primary key,
  post_id    text not null references public.posts on delete cascade,
  user_id    uuid not null references public.profiles on delete cascade,
  body       text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.comments enable row level security;
create policy "comments: read all"   on public.comments for select using (true);
create policy "comments: insert own" on public.comments for insert with check (auth.uid() = user_id);
create policy "comments: update own" on public.comments for update using (auth.uid() = user_id);
create policy "comments: delete own or staff" on public.comments for delete using (auth.uid() = user_id or public.is_staff());
create index comments_post_idx on public.comments (post_id, created_at);

-- ── post_interactions: 좋아요·즐겨찾기·조회. 본인 행만. 집계는 뷰 ────────────
create table public.post_interactions (
  post_id    text not null references public.posts on delete cascade,
  user_id    uuid not null references public.profiles on delete cascade,
  kind       text not null check (kind in ('like','bookmark','view')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, kind)
);
alter table public.post_interactions enable row level security;
create policy "interactions: own" on public.post_interactions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create view public.post_counts with (security_invoker = false) as
  select post_id,
         count(*) filter (where kind = 'like')     as likes,
         count(*) filter (where kind = 'bookmark') as bookmarks,
         count(*) filter (where kind = 'view')     as views
  from public.post_interactions group by post_id;
grant select on public.post_counts to anon, authenticated;

-- ── runs: 학습 실행 요약. GPU 호스트가 service_role 로 upsert ─────────────────
create table public.runs (
  run_id       text primary key,                    -- <script stem>_<YYYYmmdd-HHMMSS> (FORMAT.md)
  user_id      uuid not null references public.profiles on delete cascade,
  model_id     text not null,                       -- catalog.py 의 model_id
  script       text,
  project_name text,
  base_model   text,
  status       text not null default 'done' check (status in ('running','done','failed')),
  error_count  int  not null default 0,
  saved_at     timestamptz,                         -- tracker.save_run 의 saved_at
  created_at   timestamptz not null default now()
);
alter table public.runs enable row level security;
create policy "runs: read own or staff" on public.runs for select using (auth.uid() = user_id or public.is_staff());
create index runs_user_idx on public.runs (user_id, saved_at desc);

-- ── portfolios: 생성된 포트폴리오 본문. data = /api/portfolio/data 의 JSON 그대로 ──
create table public.portfolios (
  run_id         text primary key references public.runs on delete cascade,
  user_id        uuid not null references public.profiles on delete cascade,
  data           jsonb not null,
  integrity_hash text,                              -- data.verification.integrity_hash 복사 (조회용)
  signature      text,                              -- Stage D: 호스트 Ed25519 서명
  created_at     timestamptz not null default now()
);
alter table public.portfolios enable row level security;
create policy "portfolios: read own or staff" on public.portfolios for select using (auth.uid() = user_id or public.is_staff());
create index portfolios_user_idx on public.portfolios (user_id, created_at desc);
