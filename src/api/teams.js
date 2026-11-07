import { supabase } from './supabaseClient'

// ⚠️ teams는 select('*') 금지! (초대 코드 칸은 권한이 없어서 오류가 난다)
const TEAM_COLUMNS = 'id, name, region, district, gender_type, intro'

// 대전 구 목록 (DB의 create_team 함수에서 검사하는 목록과 같아야 한다)
export const DISTRICTS = ['동구', '중구', '서구', '유성구', '대덕구']
export const GENDER_TYPES = ['남자', '여자', '혼성']

// 팀 만들기 (FR-02) — 003의 DB 함수 create_team을 부른다
// 돌려받는 값: 새 팀의 id
export async function createTeam({ name, district, genderType, intro }) {
  const { data, error } = await supabase.rpc('create_team', {
    p_name: name,
    p_district: district,
    p_gender_type: genderType,
    p_intro: intro,
  })
  if (error) throw error
  return data
}

// 내가 속한 팀 목록 (승인된 팀만)
// team_members를 조회하면서, 연결된 teams 정보도 함께 가져온다 (조인)
export async function getMyTeams(userId) {
  const { data, error } = await supabase
    .from('team_members')
    .select(`role, team:teams (${TEAM_COLUMNS})`)
    .eq('user_id', userId)
    .eq('status', '승인')
    .order('joined_at')
  if (error) throw error
  return data // 예: [{ role: '운영진', team: { id, name, ... } }]
}

// 운영진만 초대 코드 보기 (FR-03)
export async function getInviteCode(teamId) {
  const { data, error } = await supabase.rpc('get_invite_code', { p_team_id: teamId })
  if (error) throw error
  return data
}