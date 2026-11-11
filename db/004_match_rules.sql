-- VolleyFM 경기 규칙 — 004 (FR-06 등록, FR-07 팀당 하루 1경기)
-- 먼저 실행되어 있어야 하는 것: 001, 002, 003

begin;

-- 1. 검사 함수 (트리거가 부른다)
--    new = 지금 저장하려는 줄
create or replace function private.check_match_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_now_kst timestamp := (now() at time zone 'Asia/Seoul');  -- 서버 시간 → 한국 시간
begin
  -- 취소로 바꾸는 경우는 검사하지 않는다
  if new.status = '취소' then
    return new;
  end if;

  -- ① 지난 시간에는 등록·변경 불가 (서버 시간 기준)
  if (new.match_date + new.start_time) <= v_now_kst then
    raise exception '이미 지난 시간에는 경기를 등록할 수 없어요';
  end if;

  -- ② FR-07 팀당 하루 1경기
  --    같은 팀·같은 날짜로 동시에 들어온 요청을 한 줄로 세운다 (잠금)
  perform pg_advisory_xact_lock(hashtext(new.host_team_id::text || new.match_date::text));

  if exists (
    select 1
    from public.matches m
    where m.match_date = new.match_date
      and m.id <> new.id                              -- 수정할 때 자기 자신은 빼고
      and m.status in ('모집중', '확정')                 -- 취소된 경기는 세지 않는다
      and (m.host_team_id = new.host_team_id          -- 그날 우리 팀이 등록한 경기
           or m.opponent_team_id = new.host_team_id)  -- 그날 우리 팀이 상대로 확정된 경기
  ) then
    raise exception '우리 팀은 그날 이미 경기가 있어요';
  end if;

  return new;  -- 통과 → 그대로 저장
end;
$$;

-- 2. 트리거 연결: 추가하거나 날짜·시간·팀을 바꾸기 "직전(before)"에 검사
drop trigger if exists check_match_rules on public.matches;
create trigger check_match_rules
  before insert or update of match_date, start_time, host_team_id
  on public.matches
  for each row
  execute function private.check_match_rules();

commit;