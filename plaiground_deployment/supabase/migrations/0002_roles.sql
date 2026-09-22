-- 0002_roles.sql — 역할 부여 (확정 2026-09-22)
--
-- 결정:
--   1) 첫 관리자(admin)는 준형의 개인 Google 계정. 이 파일의 이메일을 바꿔 SQL Editor 에서 1회 실행.
--      (대시보드 = service_role 이라 profiles_protect_role 트리거를 통과한다)
--   2) 그 뒤 교수(faculty) 지정은 관리자가 앱 안에서 rpc('set_role') 로 한다. 대시보드에 들어갈 필요 없음.
--      Faculty LMS 화면에 관리자용 "역할 변경" 이 붙기 전까지는 SQL Editor 에서 같은 함수를 호출한다:
--        select public.set_role('<대상 uuid>', 'faculty');
--   3) 역할은 3개로 고정 (student / faculty / admin). 세분화가 필요해지면 그때 컬럼 추가.

create or replace function public.set_role(target uuid, new_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception '관리자만 역할을 바꿀 수 있습니다';
  end if;
  if new_role not in ('student','faculty','admin') then
    raise exception '알 수 없는 역할: %', new_role;
  end if;
  update public.profiles set role = new_role where id = target;
  if not found then
    raise exception '해당 사용자가 없습니다: %', target;
  end if;
end $$;
revoke all on function public.set_role(uuid, text) from public;
grant execute on function public.set_role(uuid, text) to authenticated;

-- 첫 관리자 부트스트랩. 로그인을 한 번 해서 profiles 행이 생긴 뒤 실행한다.
-- >>> 아래 이메일을 준형의 개인 Google 계정으로 바꾼다 <<<
update public.profiles p set role = 'admin'
from auth.users u
where u.id = p.id and u.email = 'CHANGE_ME@gmail.com';
