import { supabase } from './supabaseClient'

// 메시지에서 화면에 필요한 칸
const MESSAGE_COLUMNS = 'id, content, created_at, sender_id'

// 확정 경기의 채팅방(= 수락된 신청) id — 없으면 null (FR-13 진입)
export async function getAcceptedApplicationId(matchId) {
  const { data, error } = await supabase
    .from('match_applications')
    .select('id')
    .eq('match_id', matchId)
    .eq('status', '수락')
    .maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

// 채팅방 정보: 신청(상태·신청 팀) + 경기 요약 + 등록 팀
// 볼 권한이 없으면 RLS 때문에 0줄 → null
export async function getChatRoom(applicationId) {
  const { data, error } = await supabase
    .from('match_applications')
    .select(`
      id, status,
      team:teams (id, name),
      match:matches (
        id, match_date, start_time, end_time, place_name,
        host_team:teams!matches_host_team_id_fkey (id, name)
      )
    `)
    .eq('id', applicationId)
    .maybeSingle()
  if (error?.code === '22P02') return null // 주소가 uuid 모양이 아님 → "없음"으로
  if (error) throw error
  return data
}

// 채팅방 참여자 (009 DB 함수) — [{ user_id, nickname, team_id, team_name }, …]
export async function getChatMembers(applicationId) {
  const { data, error } = await supabase.rpc('get_chat_members', {
    p_application_id: applicationId,
  })
  if (error) throw error
  return data
}

// 최근 메시지 (기본 50개) — 최신 50개를 가져와서 화면용으로 옛날 → 최신 순서로 뒤집는다
export async function getRecentMessages(applicationId, limit = 50) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select(MESSAGE_COLUMNS)
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data.reverse()
}

// 메시지 보내기 — 002 RLS: 보낸 사람 = 나, 채팅방 사람, 신청이 '수락'일 때만
export async function sendMessage(applicationId, senderId, content) {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ application_id: applicationId, sender_id: senderId, content })
    .select(MESSAGE_COLUMNS)
    .single()
  if (error) throw error
  return data
}

// 새 메시지 실시간 구독 (Supabase Realtime · Postgres Changes)
// onInsert: 새 메시지(줄)가 올 때마다 부를 함수 / 돌려받는 값: 구독 끊기 함수 (클린업용)
export function subscribeMessages(applicationId, onInsert) {
  const channel = supabase
    // 채널 이름 끝에 무작위 값: 개발 모드에서 구독이 두 번 일어나도 이름이 겹치지 않게
    .channel(`chat:${applicationId}:${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',                              // 새 줄이 생길 때만
        schema: 'public',
        table: 'chat_messages',
        filter: `application_id=eq.${applicationId}`, // 이 채팅방 메시지만
      },
      (payload) => onInsert(payload.new),             // payload.new = 새로 생긴 줄
    )
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}