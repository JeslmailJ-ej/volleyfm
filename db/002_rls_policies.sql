-- =====================================================================
-- VolleyFM RLS 정책 (보안 규칙) — 002
-- 기준: FR-18 역할별 권한 표, 각 기능 명세의 "사용자/권한" 항목
-- 실행 위치: Supabase > SQL Editor > New query > 전체 붙여넣기 > Run
-- 저장 위치: 프로젝트 db/002_rls_policies.sql
--
-- 이 파일에서 하는 일
--   1. 권한 확인용 도우미 함수 3개 (팀원인가? 운영진인가? 채팅방에 들어갈 수 있나?)
--   2. teams의 초대 코드(invite_code) 칸 숨기기
--   3. 테이블별 정책: 누가 / 무엇을(조회·추가·수정·삭제) / 어떤 조건일 때
--
-- 여기서 다루지 않는 것 (003에서 DB 함수로 만든다)
--   팀 만들기(초대 코드 생성), 초대 코드로 가입, 신청 수락, 확정 경기 취소(6시간 규칙),
--   팀당 하루 1경기 검사(FR-07), 마지막 운영진 규칙, 빈 팀 자동 해체, 팀 평균 경력
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. 도우미 함수
--    private 공간(스키마)에 두어 앱에서 직접 호출할 수 없고, 정책 안에서만 쓴다.
--    security definer: 함수가 "만든 사람(관리자) 권한"으로 실행된다.
--    → team_members 정책 안에서 team_members를 다시 조회할 때 생기는 무한 반복을 막는다.
-- ---------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- 지금 로그인한 사람이 이 팀의 "승인된 팀원"인가?
create or replace function private.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = p_team_id
      and tm.user_id = (select auth.uid())
      and tm.status = '승인'
  );
$$;

-- 지금 로그인한 사람이 이 팀의 "승인된 운영진"인가?
create or replace function private.is_team_admin(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = p_team_id
      and tm.user_id = (select auth.uid())
      and tm.status = '승인'
      and tm.role = '운영진'
  );
$$;

-- 지금 로그인한 사람이 이 채팅방(수락된 신청)의 양 팀 중 한 팀 팀원인가?
create or replace function private.can_access_chat(p_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.match_applications a
    join public.matches m on m.id = a.match_id
    where a.id = p_application_id
      and (private.is_team_member(a.team_id) or private.is_team_member(m.host_team_id))
  );
$$;

grant execute on function private.is_team_member(uuid)  to anon, authenticated;
grant execute on function private.is_team_admin(uuid)   to anon, authenticated;
grant execute on function private.can_access_chat(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. teams: 초대 코드 칸 숨기기 (칸 단위 권한)
--    RLS는 "줄"을 막는 규칙이라 "칸"은 못 막는다. 팀 조회를 누구나 할 수 있게 열면
--    초대 코드도 함께 보여서 아무 팀에나 들어갈 수 있게 된다.
--    → 초대 코드를 뺀 나머지 칸만 조회를 허용하고, 코드는 003의 DB 함수로만 다룬다.
--    ⚠️ 앱에서 teams를 조회할 때 select('*') 대신 필요한 칸 이름을 적어야 한다.
-- ---------------------------------------------------------------------
revoke select, insert, update, delete on public.teams from anon, authenticated;
grant select (id, name, region, district, gender_type, intro, created_by, created_at, deleted_at)
  on public.teams to anon, authenticated;
grant update (name, district, gender_type, intro)            -- FR-23 팀 정보 수정 칸만
  on public.teams to authenticated;

-- ---------------------------------------------------------------------
-- 3. profiles (회원)
-- ---------------------------------------------------------------------
create policy "회원: 로그인한 사람은 조회"
  on public.profiles for select to authenticated
  using (true);

create policy "회원: 본인 프로필만 만들기 (FR-01)"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

create policy "회원: 본인 프로필만 수정 (FR-01, FR-19)"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- 4. teams (팀) — 만들기는 003의 DB 함수로 (초대 코드 생성 + 운영진 등록을 한 번에)
-- ---------------------------------------------------------------------
create policy "팀: 누구나 조회 (초대 코드 제외)"
  on public.teams for select to anon, authenticated
  using (true);

create policy "팀: 운영진만 수정 (FR-23)"
  on public.teams for update to authenticated
  using (private.is_team_admin(id))
  with check (private.is_team_admin(id));

-- ---------------------------------------------------------------------
-- 5. team_members (팀원)
-- ---------------------------------------------------------------------
create policy "팀원: 본인 기록과 같은 팀 팀원 조회"
  on public.team_members for select to authenticated
  using (user_id = (select auth.uid()) or private.is_team_member(team_id));

create policy "팀원: 본인이 가입 신청 (FR-03 검색 후 신청)"
  on public.team_members for insert to authenticated
  with check (user_id = (select auth.uid()) and role = '팀원' and status = '승인대기');

create policy "팀원: 운영진이 승인·역할 변경 (FR-03, FR-18)"
  on public.team_members for update to authenticated
  using (private.is_team_admin(team_id))
  with check (private.is_team_admin(team_id));

create policy "팀원: 본인 나가기, 운영진이 거절·내보내기 (FR-03, FR-24)"
  on public.team_members for delete to authenticated
  using (user_id = (select auth.uid()) or private.is_team_admin(team_id));

-- ---------------------------------------------------------------------
-- 6. matches (연습경기)
-- ---------------------------------------------------------------------
create policy "경기: 누구나 조회 (FR-04, FR-05, FR-08)"
  on public.matches for select to anon, authenticated
  using (true);

create policy "경기: 팀원이 모집 등록 (FR-06)"
  on public.matches for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and private.is_team_member(host_team_id)
    and status = '모집중'
    and opponent_team_id is null
  );

create policy "경기: 모집중 경기를 등록자·운영진이 수정·취소 (FR-06, FR-11)"
  on public.matches for update to authenticated
  using (
    status = '모집중'
    and (created_by = (select auth.uid()) or private.is_team_admin(host_team_id))
  )
  with check (status in ('모집중', '취소') and opponent_team_id is null);

-- ---------------------------------------------------------------------
-- 7. match_applications (신청) — 수락은 003의 DB 함수로 (여러 줄을 한 번에 바꾸므로)
-- ---------------------------------------------------------------------
create policy "신청: 신청 팀·등록 팀 팀원이 조회"
  on public.match_applications for select to authenticated
  using (
    private.is_team_member(team_id)
    or exists (
      select 1 from public.matches m
      where m.id = match_id and private.is_team_member(m.host_team_id)
    )
  );

create policy "신청: 운영진이 모집중 경기에 신청 (FR-09)"
  on public.match_applications for insert to authenticated
  with check (
    applied_by = (select auth.uid())
    and status = '대기'
    and private.is_team_admin(team_id)
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.status = '모집중' and m.host_team_id <> team_id
    )
  );

create policy "신청: 신청 팀 운영진이 대기 신청 취소 (FR-11)"
  on public.match_applications for update to authenticated
  using (status = '대기' and private.is_team_admin(team_id))
  with check (status = '취소' and cancelled_by = (select auth.uid()));

-- ---------------------------------------------------------------------
-- 8. chat_messages (채팅)
-- ---------------------------------------------------------------------
create policy "채팅: 양 팀 팀원이 조회 (FR-13)"
  on public.chat_messages for select to authenticated
  using (private.can_access_chat(application_id));

create policy "채팅: 수락된 경기의 양 팀 팀원이 보내기 (FR-13)"
  on public.chat_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and private.can_access_chat(application_id)
    and exists (
      select 1 from public.match_applications a
      where a.id = application_id and a.status = '수락'
    )
  );

commit;