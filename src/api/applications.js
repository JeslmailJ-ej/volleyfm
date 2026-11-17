import { supabase } from './supabaseClient'

// 연습경기 신청 (FR-09) — 006의 DB 함수. 검증 7가지는 DB가 한다
// 돌려받는 값: 신청 id
export async function applyToMatch(matchId, teamId) {
  const { data, error } = await supabase.rpc('apply_to_match', {
    p_match_id: matchId,
    p_team_id: teamId,
  })
  if (error) throw error
  return data
}

// 이 경기에 대한 우리 팀들의 신청 (FR-09 "신청 완료" 표시용)
// 돌려받는 값: [{ id, team_id, status }, ...]
export async function getMyApplications(matchId, teamIds) {
  if (teamIds.length === 0) return []
  const { data, error } = await supabase
    .from('match_applications')
    .select('id, team_id, status')
    .eq('match_id', matchId)
    .in('team_id', teamIds) // 내 운영진 팀들 중 하나
  if (error) throw error
  return data
}

// 대기 신청 취소 (FR-11) — 002의 RLS: 신청 팀 운영진이 '대기'를 '취소'로만 바꿀 수 있다
export async function cancelApplication(applicationId, userId) {
  const { data, error } = await supabase
    .from('match_applications')
    .update({ status: '취소', cancelled_at: new Date().toISOString(), cancelled_by: userId })
    .eq('id', applicationId)
    .eq('status', '대기')
    .select('id') // 바꾼 줄을 돌려받는다
  if (error) throw error
  // RLS에 막히거나 이미 처리된 신청이면 오류 없이 0줄 → 직접 알려준다
  if (data.length === 0) throw new Error('이미 처리된 신청이라 취소할 수 없어요')
}

// 받은 대기 신청 수 (FR-08 "신청 N팀") — 등록 팀 팀원만 볼 수 있다 (002 RLS)
export async function countPendingApplications(matchId) {
  const { count, error } = await supabase
    .from('match_applications')
    .select('id', { count: 'exact', head: true })
    .eq('match_id', matchId)
    .eq('status', '대기')
  if (error) throw error
  return count
}

// 신청 수락 (FR-10) — 007의 DB 함수
// 한 번에: 수락 + 같은 경기 나머지 거절 + 경기 확정 + 상대 팀의 같은 날 다른 대기 신청 자동 취소
// 돌려받는 값: 확정된 경기 id
export async function acceptApplication(applicationId) {
  const  { data, error } = await supabase.rpc('accept_application', {
    p_application_id: applicationId,
  })
  if (error) throw error
  return data
}

// 받은 신청 (FR-10 S-06) — 내 운영진 팀이 올린 모집중 경기 + 그 경기의 대기 신청
// 돌려받는 값: [{ id, match_date, …, host_team, match_applications: [{ id, team: {…} }, …] }, …]
export async function getReceivedApplications(teamIds, fromDate) {
  if (teamIds.length === 0) return []
  const { data, error } = await supabase
    .from('matches')
    .select(`
      id, match_date, start_time, end_time, place_name,
      host_team:teams!matches_host_team_id_fkey (id, name),
      match_applications (id, status, created_at, team:teams (id, name, district, gender_type))
    `)
    .in('host_team_id', teamIds) // 내 운영진 팀이 올린 경기
    .eq('status', '모집중')
    .gte('match_date', fromDate) // 오늘 이후
    .eq('match_applications.status', '대기') // 하위 표: 대기 신청만
    .order('match_date')
    .order('start_time')
    .order('created_at', { referencedTable: 'match_applications' }) // 하위 표: 먼저 신청한 팀이 위
  if (error) throw error
  return data
}