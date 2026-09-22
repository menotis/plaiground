-- 0004_fix_protect_role.sql — protect_role 트리거 조건 수정 (2026-09-22)
--
-- 문제: 0001의 protect_role 은 "auth.role() = 'service_role' 이 아니고 admin 도 아니면 차단" 이었다.
--       SQL Editor 는 postgres 역할로 직접 실행되어 auth.role() 이 비어 있으므로, 0002 의 첫 admin
--       부트스트랩 update 가 "role 은 관리자만 바꿀 수 있습니다" 로 막혔다.
-- 수정: 사용자 토큰이 있는 요청(auth.uid() is not null)에서만 검사한다. 토큰이 없는 접근은
--       대시보드 운영자나 service_role 이므로 통과. 브라우저는 항상 토큰으로 오므로 보안은 같다.

create or replace function public.protect_role() returns trigger language plpgsql as $$
begin
  if new.role <> old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'role 은 관리자만 바꿀 수 있습니다';
  end if;
  return new;
end $$;
