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