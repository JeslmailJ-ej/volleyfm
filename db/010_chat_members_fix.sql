-- =====================================================================
-- VolleyFM 채팅 참여자 수정 — 010
-- 문제: 양 팀에 모두 속한 사람이 2줄로 나와서 화면에서 한 팀만 보였다
-- 해결: 사람마다 1줄, 소속 팀 이름을 'A팀 / B팀'처럼 합쳐서 돌려준다
-- 먼저 실행되어 있어야 하는 것: 009
-- =====================================================================

begin;

-- 돌려주는 칸이 바뀌면(team_id 칸이 빠짐) create or replace로는 안 되고, 지우고 다시 만들어야 한다
drop function if exists public.get_chat_members(uuid);

create function public.get_chat_members(p_application_id uuid)
returns table (user_id uuid, nickname text, team_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id,
         p.nickname,
         -- 같은 사람의 팀 이름을 하나로 합치기 (등록 팀이 앞에)
         string_agg(t.name, ' / ' order by (t.id = m.host_team_id) desc)
  from public.match_applications a
  join public.matches m       on m.id = a.match_id
  join public.team_members tm on tm.team_id in (a.team_id, m.host_team_id)
                             and tm.status = '승인'
  join public.profiles p      on p.id = tm.user_id
  join public.teams t         on t.id = tm.team_id
  where a.id = p_application_id
    and private.can_access_chat(p_application_id)
  group by p.id, p.nickname;   -- 사람마다 한 줄로 묶기
$$;

revoke execute on function public.get_chat_members(uuid) from public, anon;
grant  execute on function public.get_chat_members(uuid) to authenticated;

commit;