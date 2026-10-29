-- =====================================================================
-- VolleyFM DB 테이블 생성 (최종 ERD v1.0, 2026-10-27 기준)
-- 실행 위치: Supabase > SQL Editor > New query > 전체 붙여넣기 > Run
-- 이 파일은 GitHub 저장소의 db/ 폴더에도 저장해 둔다 (DB 변경 기록)
-- =====================================================================

-- begin ~ commit 사이를 하나의 묶음(트랜잭션)으로 실행한다.
-- 중간에 오류가 나면 전부 취소되어, 테이블이 반쯤만 만들어지는 일이 없다.
begin;

-- ---------------------------------------------------------------------
-- 1. profiles (회원)
--    id는 Supabase 로그인 계정(auth.users)의 id와 같은 값을 쓴다.
-- ---------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users (id),
  nickname         text not null check (char_length(nickname) between 2 and 30),
  volleyball_since date,                          -- 탈퇴하면 비움 (FR-22)
  main_team_id     uuid,                          -- 대표 팀 (teams를 만든 뒤 아래에서 연결)
  created_at       timestamptz not null default now(),
  deleted_at       timestamptz                    -- 탈퇴일
);
comment on table public.profiles is '회원';

-- ---------------------------------------------------------------------
-- 2. teams (팀)
-- ---------------------------------------------------------------------
create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 30),
  region      text not null default '대전' check (char_length(region) <= 30),
  district    text not null check (char_length(district) <= 30),
  gender_type text not null check (gender_type in ('남자', '여자', '혼성')),
  intro       text check (char_length(intro) <= 300),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{6}$'),
  created_by  uuid not null references public.profiles (id),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz                         -- 해체일 (FR-24)
);
comment on table public.teams is '팀';

-- profiles와 teams가 서로를 가리키므로, 두 테이블을 다 만든 뒤 대표 팀 외래키를 연결한다.
alter table public.profiles
  add constraint profiles_main_team_id_fkey
  foreign key (main_team_id) references public.teams (id);

-- ---------------------------------------------------------------------
-- 3. team_members (팀원: 회원-팀 N:M 중간 테이블)
-- ---------------------------------------------------------------------
create table public.team_members (
  id        uuid primary key default gen_random_uuid(),
  team_id   uuid not null references public.teams (id),
  user_id   uuid not null references public.profiles (id),
  role      text not null default '팀원' check (role in ('운영진', '팀원')),
  status    text not null default '승인대기' check (status in ('승인대기', '승인')),
  joined_at timestamptz not null default now(),
  unique (team_id, user_id)                       -- 같은 팀에 두 번 가입 불가
);
comment on table public.team_members is '팀원 (회원-팀 N:M)';

-- ---------------------------------------------------------------------
-- 4. matches (연습경기)
-- ---------------------------------------------------------------------
create table public.matches (
  id               uuid primary key default gen_random_uuid(),
  host_team_id     uuid not null references public.teams (id),
  opponent_team_id uuid references public.teams (id),
  created_by       uuid not null references public.profiles (id),
  match_date       date not null,
  start_time       time not null,
  end_time         time not null,
  place_name       text not null check (char_length(place_name) <= 100),
  place_address    text not null check (char_length(place_address) <= 200),
  lat              numeric(10, 7) not null,
  lng              numeric(10, 7) not null,
  match_format     text not null check (match_format in ('9인제', '6인제', '4인제')),
  gender_type      text not null check (gender_type in ('남자', '여자', '혼성')),
  message          text check (char_length(message) <= 200),
  status           text not null default '모집중' check (status in ('모집중', '확정', '취소')),
  cancelled_at     timestamptz,
  cancelled_by     uuid references public.profiles (id),
  created_at       timestamptz not null default now(),
  check (end_time > start_time),                                   -- 끝 시간 > 시작 시간
  check (opponent_team_id is null or opponent_team_id <> host_team_id) -- 자기 팀과 경기 불가
);
comment on table public.matches is '연습경기';

-- ---------------------------------------------------------------------
-- 5. match_applications (신청)
-- ---------------------------------------------------------------------
create table public.match_applications (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null references public.matches (id),
  team_id      uuid not null references public.teams (id),
  applied_by   uuid not null references public.profiles (id),
  status       text not null default '대기' check (status in ('대기', '수락', '거절', '취소')),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id),
  created_at   timestamptz not null default now(),
  unique (match_id, team_id)                      -- 같은 경기에 같은 팀 중복 신청 불가
);
comment on table public.match_applications is '연습경기 신청 (수락되면 채팅방)';

-- ---------------------------------------------------------------------
-- 6. chat_messages (채팅)
-- ---------------------------------------------------------------------
create table public.chat_messages (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.match_applications (id),
  sender_id      uuid not null references public.profiles (id),
  content        text not null check (char_length(content) between 1 and 500),
  created_at     timestamptz not null default now()
);
comment on table public.chat_messages is '채팅 메시지';

-- ---------------------------------------------------------------------
-- 7. 인덱스 (자주 찾는 컬럼을 빨리 찾기 위한 목차)
-- ---------------------------------------------------------------------
create index matches_match_date_idx        on public.matches (match_date);
create index matches_host_team_idx         on public.matches (host_team_id);
create index matches_opponent_team_idx     on public.matches (opponent_team_id);
create index team_members_user_idx         on public.team_members (user_id);
create index match_applications_team_idx   on public.match_applications (team_id);
create index chat_messages_application_idx on public.chat_messages (application_id, created_at);

-- ---------------------------------------------------------------------
-- 8. 보안: RLS 켜기 (automatic RLS를 켰더라도 확실하게 한 번 더)
--    정책(policy)을 만들기 전까지는 앱에서 아무 데이터도 읽고 쓸 수 없다. (정상)
-- ---------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.teams              enable row level security;
alter table public.team_members       enable row level security;
alter table public.matches            enable row level security;
alter table public.match_applications enable row level security;
alter table public.chat_messages      enable row level security;

-- ---------------------------------------------------------------------
-- 9. 권한(GRANT): 테이블의 "공동현관"을 연다. 실제로 어떤 줄을 볼 수 있는지는 RLS 정책이 정한다.
--    anon          = 로그인하지 않은 사용자 → 홈·캘린더·상세 보기용으로 조회만
--    authenticated = 로그인한 사용자
-- ---------------------------------------------------------------------
grant select on public.teams, public.matches to anon;

grant select, insert, update, delete on
  public.profiles,
  public.teams,
  public.team_members,
  public.matches,
  public.match_applications,
  public.chat_messages
to authenticated;

commit;
