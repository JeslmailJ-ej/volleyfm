-- =====================================================================
-- VolleyFM DB 함수 ⑤ 신청 수락 — 007
-- 기준: FR-10 신청 목록·수락 (4번 처리 흐름, 5번 검증), FR-07 A안 자동 취소
-- 실행 위치: Supabase > SQL Editor > New query > Run
-- 저장 위치: 프로젝트 db/007_accept_function.sql
-- 먼저 실행되어 있어야 하는 것: 001, 002, 004, 006 (006의 team_has_match_on을 쓴다)
-- =====================================================================

begin;

-- 신청 수락 (FR-10) — 돌려받는 값: 확정된 경기 id
-- 함수 하나 = 트랜잭션 하나: 중간에 raise exception이 나면 앞에서 바꾼 것까지 전부 되돌린다
create or replace function public.accept_application(p_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_now_kst timestamp := (now() at time zone 'Asia/Seoul');
  v_app     public.match_applications%rowtype;
  v_match   public.matches%rowtype;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요';
  end if;

  -- 신청 꺼내기 (어느 경기인지 알려고)
  select * into v_app
  from public.match_applications a
  where a.id = p_application_id;
  if v_app.id is null then
    raise exception '신청을 찾을 수 없어요';
  end if;

  -- 경기 줄 잠금: 같은 경기를 두 운영진이 동시에 수락하면 한 명씩 차례로
  select * into v_match
  from public.matches m
  where m.id = v_app.match_id
  for update;

  -- ① 등록 팀의 운영진인가
  if not private.is_team_admin(v_match.host_team_id) then
    raise exception '운영진만 수락할 수 있어요';
  end if;

  -- ② 아직 모집중인가 (먼저 수락한 사람이 있으면 여기서 막힌다)
  if v_match.status <> '모집중' then
    raise exception '이미 확정되었거나 취소된 경기예요';
  end if;

  -- 신청 팀 + 날짜 이름표 잠금 (004 등록, 006 신청과 같은 이름표)
  perform pg_advisory_xact_lock(hashtext(v_app.team_id::text || v_match.match_date::text));

  -- ③ 신청이 아직 대기인가 — 잠금을 기다리는 사이 바뀌었을 수 있어서 잠근 뒤 다시 읽는다
  select * into v_app
  from public.match_applications a
  where a.id = p_application_id
  for update;
  if v_app.status <> '대기' then
    raise exception '상대 팀이 신청을 취소했어요';
  end if;

  -- ④ 시작 시각이 지나지 않았나
  if (v_match.match_date + v_match.start_time) <= v_now_kst then
    raise exception '이미 지난 경기예요';
  end if;

  -- ⑤ FR-07 신청 팀이 그날 다른 경기가 없나 (006의 함수)
  if private.team_has_match_on(v_app.team_id, v_match.match_date) then
    raise exception '상대 팀이 이 날짜에 이미 다른 경기가 있어요';
  end if;

  -- ---- 여기부터 한 번에 처리 (FR-10 4-3) ----
  -- 가. 이 신청 → 수락
  update public.match_applications
     set status = '수락'
   where id = v_app.id;

  -- 나. 같은 경기의 다른 대기 신청 → 거절
  update public.match_applications
     set status = '거절'
   where match_id = v_match.id
     and id <> v_app.id
     and status = '대기';

  -- 다. 경기 → 확정 + 상대 팀
  update public.matches
     set status = '확정', opponent_team_id = v_app.team_id
   where id = v_match.id;

  -- 라. 신청 팀이 같은 날 다른 경기에 넣어둔 대기 신청 → 자동 취소 (FR-07 A안)
  --     cancelled_by를 비워 두는 것 = "사람이 아니라 자동으로 취소됨" 표시
  update public.match_applications a
     set status = '취소', cancelled_at = now(), cancelled_by = null
    from public.matches m
   where a.match_id = m.id
     and a.team_id = v_app.team_id
     and a.status = '대기'
     and m.match_date = v_match.match_date
     and a.id <> v_app.id;

  return v_match.id;
end;
$$;

revoke execute on function public.accept_application(uuid) from public, anon;
grant  execute on function public.accept_application(uuid) to authenticated;

commit;