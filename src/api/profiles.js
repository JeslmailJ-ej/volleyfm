import { supabase } from './supabaseClient'

// 프로필에서 화면에 필요한 칸만 적는다 (나중에 칸이 늘어나도 필요한 것만 받기)
const PROFILE_COLUMNS = 'id, nickname, volleyball_since, main_team_id, deleted_at'

// 내 프로필 가져오기 (FR-01)
// 아직 프로필을 만들지 않았으면 null을 돌려준다 → 첫 가입 화면으로 보낸다
export async function getMyProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId) 
    .maybeSingle() // 0줄이면 null, 1줄이면 그 줄 (2줄 이상이면 오류) 
  if (error) throw error
  return data
}

// 첫 가입 프로필 만들기 (FR-01, FR-19)
// volleyballSince: 'YYYY-MM' 형태 (예: '2019-03') → DB에는 그 달 1일로 저장
export async function createProfile({ userId, nickname, volleyballSince }) {
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      nickname: nickname.trim(),
      volleyball_since: `${volleyballSince}-01`,
    })
    .select(PROFILE_COLUMNS)
    .single() // 방금 넣은 1줄을 돌려받는다
  if (error) throw error
  return data
}