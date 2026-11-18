-- =====================================================================
-- VolleyFM DB 함수 ⑥ 모집중 경기 취소 — 008
-- 기준: FR-11 취소 (B. 경기 취소), 확정 후 취소는 FR-21 (나중에)
-- 실행 위치: Supabase > SQL Editor > New query > Run
-- 저장 위치: 프로젝트 db/008_cancel_match.sql
-- 먼저 실행되어 있어야 하는 것: 001, 002
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. 경기 update 정책 좁히기: 수정만 허용, 취소는 아래 함수로만
--    002 정책은 '취소'로 바꾸는 것도 허용 → 직접 바꾸면 대기 신청이 취소된 경기에 남는다
-- ---------------------------------------------------------------------
drop policy if exists "경기: 모집중 경기를 등록자·운영진이 수정·취소 (FR-06, FR-11)" on public.matches;

create policy "경기: 모집중 경기를 등록자·운영진이 수정 (FR-06)"
  on public.matches for update to authenticated
  using (
    status = '모집중'
    and (created_by = (select auth.uid()) or private.is_team_admin(host_team_id))
  )
  with check (status = '모집중' and opponent_team_id is null);  -- 바꾼 뒤에도 모집중이어야 함

-- ---------------------------------------------------------------------
-- 1. 모집중 경기 취소 (FR-11 B)
--    한 번에: 경기 → 취소 + 이 경기의 대기 신청 → 모두 취소
-- ---------------------------------------------------------------------
create or replace function public.cancel_match(p_match_id uuid)
returns void                                   -- 돌려줄 값 없음
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_match public.matches%rowtype;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요';
  end if;

  -- 경기 줄 잠금: 취소하는 순간 다른 사람이 수락하는 겹침 방지 (007도 같은 줄을 잠근다)
  select * into v_match
  from public.matches m
  where m.id = p_match_id
  for update;
  if v_match.id is null then
    raise exception '경기를 찾을 수 없어요';
  end if;

  -- B-1 등록한 본인 또는 등록 팀 운영진인가
  if v_match.created_by <> v_uid and not private.is_team_admin(v_match.host_team_id) then
    raise exception '등록한 사람이나 운영진만 취소할 수 있어요';
  end if;

  -- B-2 아직 모집중인가
  if v_match.status = '확정' then
    raise exception '이미 확정된 경기예요. 확정 경기 취소 규칙을 따라주세요';
  end if;
  if v_match.status = '취소' then
    raise exception '이미 취소된 경기예요';
  end if;

  -- 경기 → 취소 (누가, 언제)
  update public.matches
     set status = '취소', cancelled_at = now(), cancelled_by = v_uid
   where id = v_match.id;

  -- 이 경기의 대기 신청 → 모두 취소 (취소한 사람 = 경기를 취소한 사람)
  --   → 보낸 신청 화면에서 "등록 팀이 경기를 취소했어요"로 구분하는 근거
  update public.match_applications
     set status = '취소', cancelled_at = now(), cancelled_by = v_uid
   where match_id = v_match.id
     and status = '대기';
end;
$$;

revoke execute on function public.cancel_match(uuid) from public, anon;
grant  execute on function public.cancel_match(uuid) to authenticated;

commit;