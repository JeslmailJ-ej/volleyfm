-- =====================================================================
-- VolleyFM 채팅 — 009
-- 기준: FR-13 매칭 후 채팅
-- 실행 위치: Supabase > SQL Editor > New query > Run
-- 저장 위치: 프로젝트 db/009_chat.sql
-- 먼저 실행되어 있어야 하는 것: 001, 002 (002의 private.can_access_chat을 쓴다)
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. 채팅방 참여자 (양 팀 승인된 팀원의 닉네임·팀 이름)
--    상대 팀 팀원 목록은 RLS로 볼 수 없다 → 관리자 권한으로 읽되,
--    채팅방에 들어갈 수 있는 사람(can_access_chat)에게만, 닉네임·팀 이름만 돌려준다
-- ---------------------------------------------------------------------
create or replace function public.get_chat_members(p_application_id uuid)
returns table (user_id uuid, nickname text, team_id uuid, team_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nickname, t.id, t.name
  from public.match_applications a
  join public.matches m       on m.id = a.match_id
  join public.team_members tm on tm.team_id in (a.team_id, m.host_team_id)  -- 신청 팀 + 등록 팀
                             and tm.status = '승인'
  join public.profiles p      on p.id = tm.user_id
  join public.teams t         on t.id = tm.team_id
  where a.id = p_application_id
    and private.can_access_chat(p_application_id);   -- 이 채팅방 사람이 아니면 0줄
$$;

revoke execute on function public.get_chat_members(uuid) from public, anon;
grant  execute on function public.get_chat_members(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. 공백만 있는 메시지 막기 (001은 1~500자만 검사 → "   "도 통과했다)
-- ---------------------------------------------------------------------
alter table public.chat_messages
  add constraint chat_messages_content_not_blank check (char_length(trim(content)) > 0);

-- ---------------------------------------------------------------------
-- 3. 실시간 켜기: chat_messages를 Realtime 발행 목록(publication)에 추가
--    이미 들어 있으면 오류가 나므로, 없을 때만 추가한다
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;

commit;