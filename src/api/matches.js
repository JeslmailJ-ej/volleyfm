import { supabase } from './supabaseClient'

export const MATCH_FORMATS = ['9인제', '6인제', '4인제']

// 연습경기 등록 (FR-06)
// 검사는 세 곳에서: 화면(빠른 안내) → RLS(팀원인가?) → 트리거(하루 1경기, 지난 시간)
export async function createMatch({
  userId, hostTeamId, matchDate, startTime, endTime,
  placeName, placeAddress, lat, lng, matchFormat, genderType, message,
}) {
  const { data, error } = await supabase
    .from('matches')
    .insert({
      host_team_id: hostTeamId,
      created_by: userId,
      match_date: matchDate,      // 'YYYY-MM-DD'
      start_time: startTime,      // 'HH:MM'
      end_time: endTime,
      place_name: placeName.trim(),
      place_address: placeAddress.trim(),
      lat,
      lng,
      match_format: matchFormat,
      gender_type: genderType,
      message: message.trim() || null, // 빈 글자면 null로 저장
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

// 목록 화면에 필요한 칸만 + 연결된 팀 정보
// matches에서 teams로 가는 길(외래키)이 두 개(등록 팀, 상대 팀)라서 어느 길인지 이름으로 알려준다
const MATCH_LIST_COLUMNS = `
  id, match_date, start_time, end_time, place_name, match_format, gender_type, status,
  host_team:teams!matches_host_team_id_fkey (id, name, district),
  opponent_team:teams!matches_opponent_team_id_fkey (id, name)
`

// 기간 안의 경기 목록 (FR-04 이번 주 경기) — 로그인 안 해도 볼 수 있다
// from, to: 'YYYY-MM-DD' (둘 다 포함)
export async function getMatchesBetween(from, to) {
  const { data, error } = await supabase
    .from('matches')
    .select(MATCH_LIST_COLUMNS)
    .gte('match_date', from)  // match_date >= from
    .lte('match_date', to)    // match_date <= to
    .neq('status', '취소')    // 취소된 경기는 빼고
    .order('match_date')
    .order('start_time')
  if (error) throw error
  return data
}