-- =====================================================================
-- VolleyFM DB 함수 ① 팀 관련 — 003
-- 기준: FR-02 팀 생성, FR-03 팀 가입(초대 코드)
-- 실행 위치: Supabase > SQL Editor > New query > 전체 붙여넣기 > Run
-- 저장 위치: 프로젝트 db/003_team_functions.sql
-- 먼저 실행되어 있어야 하는 것: 001, 002
--
-- 앱(React)에서 부르는 법:  supabase.rpc('함수이름', { 매개변수: 값 })
--
--   create_team               팀 만들기 (+ 초대 코드 생성 + 운영진 등록 + 대표 팀 설정)
--   find_team_by_code         초대 코드로 팀 미리 보기 (가입 전 확인 창용)
--   join_team_by_code         초대 코드로 가입
--   get_invite_code           운영진만 초대 코드 보기
--   regenerate_invite_code    운영진만 초대 코드 새로 만들기
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. 초대 코드 만들기 (private: 앱에서 직접 부를 수 없음)
--    헷갈리는 0·O·1·I를 뺀 32글자 중 6자리를 무작위로 고른다 (FR-02).
--    이미 있는 코드면 다시 만든다. (teams.invite_code의 unique 제약이 최종 방어선)
-- ---------------------------------------------------------------------
create or replace function private.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- 32글자
  rand  bytea;
  code  text;
begin
  loop
    rand := uuid_send(gen_random_uuid());     -- 무작위 16바이트
    code := '';
    for i in 0..5 loop
      code := code || substr(chars, (get_byte(rand, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.teams t where t.invite_code = code);
  end loop;
  return code;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. 팀 만들기 (FR-02)
--    한 번에: ① 팀 저장 ② 만든 사람을 운영진·승인으로 등록 ③ 대표 팀이 없으면 대표 팀으로
-- ---------------------------------------------------------------------
create or replace function public.create_team(
  p_name        text,
  p_district    text,
  p_gender_type text,
  p_intro       text default null
)
returns uuid                                   -- 새 팀의 id를 돌려준다
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_team_id uuid;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid and p.deleted_at is null) then
    raise exception '프로필을 먼저 만들어 주세요';
  end if;

  if p_district not in ('동구', '중구', '서구', '유성구', '대덕구') then
    raise exception '구를 다시 선택해 주세요';
  end if;

  insert into public.teams (name, district, gender_type, intro, invite_code, created_by)
  values (trim(p_name), p_district, p_gender_type, nullif(trim(p_intro), ''),
          private.generate_invite_code(), v_uid)
  returning id into v_team_id;

  insert into public.team_members (team_id, user_id, role, status)
  values (v_team_id, v_uid, '운영진', '승인');

  update public.profiles
  set main_team_id = v_team_id
  where id = v_uid and main_team_id is null;

  return v_team_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. 초대 코드로 팀 미리 보기 (FR-03 가입 전 확인 창)
--    가입하지 않고 팀 이름·구·성별·인원만 보여준다.
-- ---------------------------------------------------------------------
create or replace function public.find_team_by_code(p_code text)
returns table (team_id uuid, name text, district text, gender_type text, member_count bigint)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요해요';
  end if;

  return query
  select t.id, t.name, t.district, t.gender_type,
         (select count(*) from public.team_members tm
          where tm.team_id = t.id and tm.status = '승인')
  from public.teams t
  where t.invite_code = upper(trim(p_code))
    and t.deleted_at is null;

  if not found then
    raise exception '초대 코드를 다시 확인해 주세요';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. 초대 코드로 가입 (FR-03)
--    코드가 맞으면 승인 없이 바로 팀원. 가입 신청(승인대기) 중이었다면 바로 승인으로.
-- ---------------------------------------------------------------------
create or replace function public.join_team_by_code(p_code text)
returns uuid                                   -- 가입한 팀의 id
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_team_id uuid;
  v_status  text;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요';
  end if;

  select t.id into v_team_id
  from public.teams t
  where t.invite_code = upper(trim(p_code))    -- 소문자로 입력해도 대문자로 바꿔 확인
    and t.deleted_at is null;

  if v_team_id is null then
    raise exception '초대 코드를 다시 확인해 주세요';
  end if;

  select tm.status into v_status
  from public.team_members tm
  where tm.team_id = v_team_id and tm.user_id = v_uid;

  if v_status = '승인' then
    raise exception '이미 가입한 팀이에요';
  elsif v_status = '승인대기' then
    update public.team_members
    set status = '승인'
    where team_id = v_team_id and user_id = v_uid;
  else
    insert into public.team_members (team_id, user_id, role, status)
    values (v_team_id, v_uid, '팀원', '승인');
  end if;

  update public.profiles
  set main_team_id = v_team_id
  where id = v_uid and main_team_id is null;

  return v_team_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. 운영진만 초대 코드 보기 (FR-03 S-11 팀 관리)
-- ---------------------------------------------------------------------
create or replace function public.get_invite_code(p_team_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not private.is_team_admin(p_team_id) then
    raise exception '운영진만 초대 코드를 볼 수 있어요';
  end if;

  select t.invite_code into v_code from public.teams t where t.id = p_team_id;
  return v_code;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. 운영진만 초대 코드 새로 만들기 (FR-03) — 이전 코드는 더 이상 쓸 수 없다
-- ---------------------------------------------------------------------
create or replace function public.regenerate_invite_code(p_team_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not private.is_team_admin(p_team_id) then
    raise exception '운영진만 초대 코드를 바꿀 수 있어요';
  end if;

  v_code := private.generate_invite_code();
  update public.teams set invite_code = v_code where id = p_team_id;
  return v_code;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. 누가 부를 수 있나: 로그인한 사람만 (로그인 안 한 사람은 막기)
--    함수는 기본적으로 모두(public)에게 열려 있어서, 먼저 거두고 다시 준다.
-- ---------------------------------------------------------------------
revoke execute on function private.generate_invite_code() from public, anon, authenticated;

revoke execute on function public.create_team(text, text, text, text) from public, anon;
revoke execute on function public.find_team_by_code(text)             from public, anon;
revoke execute on function public.join_team_by_code(text)             from public, anon;
revoke execute on function public.get_invite_code(uuid)               from public, anon;
revoke execute on function public.regenerate_invite_code(uuid)        from public, anon;

grant execute on function public.create_team(text, text, text, text) to authenticated;
grant execute on function public.find_team_by_code(text)             to authenticated;
grant execute on function public.join_team_by_code(text)             to authenticated;
grant execute on function public.get_invite_code(uuid)               to authenticated;
grant execute on function public.regenerate_invite_code(uuid)        to authenticated;

commit;