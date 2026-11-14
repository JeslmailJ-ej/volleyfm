-- =====================================================================
-- VolleyFM DB 함수 ④ 연습경기 신청 — 006
-- 기준: FR-09 신청 (6번 검증 표), FR-07 날짜 중복 방지
-- 실행 위치: Supabase > SQL Editor > New query > Run
-- 저장 위치: 프로젝트 db/006_apply_functions.sql
-- 먼저 실행되어 있어야 하는 것: 001, 002, 004
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. 직접 insert하는 길 막기
--    002에서 "운영진이 신청" insert 정책을 열어 뒀는데, 그대로 두면 아래 함수를 거치지 않고
--    바로 insert해서 FR-07 검사(그날 우리 팀 경기)를 피해 갈 수 있다. → 신청은 함수로만
-- ---------------------------------------------------------------------
drop policy if exists "신청: 운영진이 모집중 경기에 신청 (FR-09)" on public.match_applications;

-- ---------------------------------------------------------------------
-- 1. 이 팀이 이 날짜에 경기가 있나? (FR-07 규칙 정의 그대로)
--    우리 팀이 등록한 경기(모집중·확정) 또는 상대로 확정된 경기. 대기 신청은 세지 않는다 (A안)
--    나중에 수락(FR-10)에서도 같이 쓴다
-- ---------------------------------------------------------------------
create or replace function private.team_has_match_on(p_team_id uuid, p_date date)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.matches m
    where m.match_date = p_date
      and m.status in ('모집중', '확정')
      and (m.host_team_id = p_team_id or m.opponent_team_id = p_team_id)
  );
$$;

-- ---------------------------------------------------------------------
-- 2. 연습경기 신청 (FR-09) — 검증 7가지를 명세 순서대로
--    돌려받는 값: 신청 id
-- ---------------------------------------------------------------------
create or replace function public.apply_to_match(p_match_id uuid, p_team_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_now_kst timestamp := (now() at time zone 'Asia/Seoul');  -- 서버 시간 → 한국 시간
  v_match   public.matches%rowtype;             -- 경기 한 줄을 담을 변수
  v_app     public.match_applications%rowtype;  -- 기존 신청 한 줄 (없으면 비어 있음)
  v_app_id  uuid;
begin
  -- ① 로그인
  if v_uid is null then
    raise exception '로그인이 필요해요';
  end if;

  -- ② 신청 팀의 운영진인가 (002의 도우미 함수)
  if not private.is_team_admin(p_team_id) then
    raise exception '운영진만 신청할 수 있어요';
  end if;

  -- 경기 꺼내기 + 이 줄 잠그기 (신청하는 동안 다른 요청이 이 경기를 바꾸지 못하게)
  select * into v_match
  from public.matches m
  where m.id = p_match_id
  for update;
  if not found then
    raise exception '경기를 찾을 수 없어요';
  end if;

  -- ③ 우리 팀이 등록한 경기가 아닌가
  if v_match.host_team_id = p_team_id then
    raise exception '우리 팀이 올린 경기에는 신청할 수 없어요';
  end if;

  -- ④ 아직 모집중인가
  if v_match.status <> '모집중' then
    raise exception '이미 마감된 경기예요';
  end if;

  -- ⑤ 시작 시각이 지나지 않았나 (서버 시간 기준)
  if (v_match.match_date + v_match.start_time) <= v_now_kst then
    raise exception '이미 지난 경기예요';
  end if;

  -- 같은 팀·같은 날짜 요청을 한 줄로 세운다 (004 등록과 같은 이름표)
  perform pg_advisory_xact_lock(hashtext(p_team_id::text || v_match.match_date::text));

  -- ⑥ 이미 신청했나
  select * into v_app
  from public.match_applications a
  where a.match_id = p_match_id and a.team_id = p_team_id;

  if v_app.id is not null and v_app.status in ('대기', '수락') then
    raise exception '이미 신청한 경기예요';
  end if;
  if v_app.id is not null and v_app.status = '거절' then
    raise exception '상대 팀이 거절한 신청이라 다시 신청할 수 없어요';
  end if;

  -- ⑦ FR-07 그날 우리 팀 경기가 있나
  if private.team_has_match_on(p_team_id, v_match.match_date) then
    raise exception '이 날짜에 우리 팀 경기가 이미 있어요';
  end if;

  -- 통과! 취소했던 신청이 있으면 그 줄을 되살리고 (unique 때문에 새 줄 불가)
  if v_app.id is not null then
    update public.match_applications
       set status = '대기', applied_by = v_uid, created_at = now(),
           cancelled_at = null, cancelled_by = null
     where id = v_app.id;
    return v_app.id;
  end if;

  -- 처음이면 새로 저장
  insert into public.match_applications (match_id, team_id, applied_by)
  values (p_match_id, p_team_id, v_uid)
  returning id into v_app_id;
  return v_app_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. 권한
-- ---------------------------------------------------------------------
revoke execute on function private.team_has_match_on(uuid, date) from public, anon, authenticated;
revoke execute on function public.apply_to_match(uuid, uuid)      from public, anon;
grant  execute on function public.apply_to_match(uuid, uuid)      to authenticated;

commit;