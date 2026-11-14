-- =====================================================================
-- VolleyFM DB 함수 ③ 팀 통계 — 005
-- 기준: FR-08 상세 "평균 경력 (N명)", FR-19 배구 경력
-- 실행 위치: Supabase > SQL Editor > New query > Run
-- 저장 위치: 프로젝트 db/005_team_stats.sql
-- 먼저 실행되어 있어야 하는 것: 001, 002
-- =====================================================================

begin;

-- 팀 인원과 평균 배구 경력(개월) — 로그인 안 해도 볼 수 있다
-- 뷰 대신 함수인 이유: profiles·team_members는 RLS로 막혀 있다 (비로그인은 못 읽음)
--   → 관리자 권한(security definer)으로 읽되, 밖으로는 "숫자 두 개"만 돌려준다
create or replace function public.get_team_stats(p_team_id uuid)
returns table (member_count integer, avg_career_months integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*)::integer,                                          -- 인원
    round(avg(
        extract(year  from age(k.today, p.volleyball_since)) * 12  -- 년 → 개월
      + extract(month from age(k.today, p.volleyball_since))       -- + 남은 개월
    ))::integer                                                 -- 평균 개월 (반올림)
  from public.team_members tm
  join public.profiles p on p.id = tm.user_id
  cross join (select (now() at time zone 'Asia/Seoul')::date as today) k  -- 한국 날짜로 오늘
  where tm.team_id = p_team_id
    and tm.status = '승인'               -- 승인대기는 빼고
    and p.deleted_at is null             -- 탈퇴한 회원은 빼고
    and p.volleyball_since is not null;
$$;

revoke execute on function public.get_team_stats(uuid) from public;
grant  execute on function public.get_team_stats(uuid) to anon, authenticated;  -- 로그인 안 해도 부를 수 있게

commit;