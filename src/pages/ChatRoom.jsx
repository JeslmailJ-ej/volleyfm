import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  getChatRoom, getChatMembers, getRecentMessages, sendMessage, subscribeMessages,
} from '../api/chat'
import { formatDayLabel } from '../utils/date'

// S-07 채팅방 (FR-13) — 주소: /chats/신청ID
// props: user = 로그인한 사람, teams = 내가 속한 팀 [{ role, team }] (상대 팀이 누구인지 알려고)
export default function ChatRoom({ user, teams }) {
  const { applicationId } = useParams()
  const [room, setRoom] = useState(null)         // 채팅방 정보 (권한 없으면 null)
  const [members, setMembers] = useState({})     // { user_id: { nickname, team_name } }
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [text, setText] = useState('')           // 입력 중인 메시지
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const bottomRef = useRef(null)                 // 메시지 목록 맨 아래 (자동 스크롤용)

  const userId = user?.id
  const roomId = room?.id // 객체 대신 id(글자)를 의존성에 쓰려고

  // ① 채팅방 정보 → (들어갈 수 있으면) 참여자 + 최근 메시지
  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    let ignore = false
    setLoading(true)
    setErrorMessage('')

    async function load() {
      const roomData = await getChatRoom(applicationId)
      if (!roomData) return { roomData: null, memberList: [], messageList: [] } // 권한 없음 → 나머지는 안 부름
      const [memberList, messageList] = await Promise.all([ // 두 요청을 동시에
        getChatMembers(applicationId),
        getRecentMessages(applicationId),
      ])
      return { roomData, memberList, messageList }
    }

    load()
      .then(({ roomData, memberList, messageList }) => {
        if (ignore) return
        setRoom(roomData)
        setMembers(Object.fromEntries(memberList.map((m) => [m.user_id, m]))) // 배열 → { id: 사람 }
        setMessages(messageList)
      })
      .catch((err) => {
        console.error(err)
        if (!ignore) setErrorMessage('채팅방을 불러오지 못했어요')
      })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [applicationId, userId])

  // ② 실시간 구독: 새 메시지가 오면 목록 끝에 붙인다 (이미 있는 id면 무시 = 중복 제거)
  useEffect(() => {
    if (!roomId) return
    const unsubscribe = subscribeMessages(roomId, (message) => {
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]))
    })
    return unsubscribe // 화면을 떠나면 구독 끊기
  }, [roomId])

  // ③ 메시지가 늘어나면 맨 아래로 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    const content = text.trim()
    if (!content) return

    setSending(true)
    setSendError('')
    try {
      const message = await sendMessage(roomId, userId, content)
      // 내 메시지는 저장 결과 + 실시간, 두 길로 온다 → 먼저 온 쪽만 붙이고 나중 것은 무시
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]))
      setText('')
    } catch (err) {
      console.error(err)
      setSendError('보내지 못했어요. [다시 보내기]를 눌러 주세요') // 입력한 글은 그대로 둔다
    } finally {
      setSending(false)
    }
  }

  if (!user) {
    return (
      <div>
        <p>로그인이 필요해요</p>
        <Link to="/">홈으로</Link>
      </div>
    )
  }
  if (loading) return <p>불러오는 중...</p>
  if (errorMessage) return <p style={{ color: 'crimson' }}>{errorMessage}</p>
  if (!room) {
    return (
      <div>
        <p>채팅방에 들어갈 수 없어요</p>
        <Link to="/">홈으로</Link>
      </div>
    )
  }

  const match = room.match
  const myTeamIds = teams.map(({ team }) => team.id)
  // 내가 등록 팀이면 상대 = 신청 팀, 아니면 상대 = 등록 팀
  const otherTeam = myTeamIds.includes(match.host_team.id) ? room.team : match.host_team
  const isReadOnly = room.status !== '수락' // 신청이 취소되면(FR-21) 읽기만

  return (
    <div>
      <Link to={`/matches/${match.id}`}>← 경기로</Link>
      <h2>vs {otherTeam.name}</h2>
      <p>
        {formatDayLabel(new Date(`${match.match_date}T00:00:00`))}{' '}
        {match.start_time.slice(0, 5)}~{match.end_time.slice(0, 5)} · {match.place_name}
      </p>

      {/* 메시지 목록: 높이를 정하고 넘치면 안에서 스크롤 */}
      <div style={{ border: '1px solid gray', padding: 8, height: 400, overflowY: 'auto' }}>
        <p style={{ textAlign: 'center', color: 'gray' }}>
          연습경기가 확정되었어요. 자유롭게 대화를 나눠보세요!
        </p>
        {messages.map((m) => {
          const isMine = m.sender_id === userId
          const sender = members[m.sender_id]
          return (
            <div key={m.id} style={{ textAlign: isMine ? 'right' : 'left', margin: '8px 0' }}>
              {/* 한 팀에 여러 명이 대화하니까 남의 메시지에는 "닉네임 · 팀" */}
              {!isMine && (
                <small>{sender ? `${sender.nickname} · ${sender.team_name}` : '알 수 없는 회원'}</small>
              )}
              <div>
                <span style={{ display: 'inline-block', padding: '4px 8px', border: '1px solid gray', borderRadius: 8 }}>
                  {m.content}
                </span>{' '}
                <small>{new Date(m.created_at).toTimeString().slice(0, 5)}</small>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {isReadOnly ? (
        <p>취소된 경기의 채팅방이에요</p>
      ) : (
        <form onSubmit={handleSend}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            placeholder="메시지 입력"
          />
          {/* 공백만 있거나 보내는 중이면 버튼을 끈다 (DB 제약과 두 곳에서 막기) */}
          <button type="submit" disabled={sending || !text.trim()}>
            {sending ? '보내는 중...' : sendError ? '다시 보내기' : '전송'}
          </button>
          <small> {text.length}/500</small>
          {sendError && <p style={{ color: 'crimson' }}>{sendError}</p>}
        </form>
      )}
    </div>
  )
}