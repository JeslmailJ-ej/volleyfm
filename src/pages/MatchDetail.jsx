import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { getMatchById } from '../api/matches'
import { formatDayLabel, isUpcoming } from '../utils/date'

// S-04 연습경기 상세 (FR-08) — 로그인 안 해도 볼 수 있다
// 주소: /matches/경기ID
export default function MatchDetail() {
  const { matchId } = useParams() // 주소의 :matchId 자리에 있는 값을 꺼낸다
  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let ignore = false // WeekMatchList와 같은 이유: 늦게 온 옛날 응답 무시
    setLoading(true)
    setErrorMessage('')
    getMatchById(matchId)
      .then((data) => { if (!ignore) setMatch(data) })
      .catch((err) => {
        console.error(err)
        if (!ignore) setErrorMessage('경기 정보를 불러오지 못했어요')
      })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [matchId]) // 주소의 경기 ID가 바뀌면 다시 불러온다

  if (loading) return <p>불러오는 중...</p>
  if (errorMessage) return <p style={{ color: 'crimson' }}>{errorMessage}</p>
  if (!match) {
    return (
      <div>
        <p>경기를 찾을 수 없어요</p>
        <Link to="/">홈으로</Link>
      </div>
    )
  }

  const host = match.host_team
  const opponent = match.opponent_team
  const date = new Date(`${match.match_date}T00:00:00`) // 'YYYY-MM-DD'를 내 컴퓨터 시간 0시로

  return (
    <div>
      <Link to="/">← 홈으로</Link>

      <h2>{host.name} [{match.status}]</h2>
      <p>{host.district} · {host.gender_type} 팀 · {match.match_format}</p>
      {opponent && <p>vs <b>{opponent.name}</b> ({opponent.district})</p>}

      <h3>경기 정보</h3>
      <ul>
        <li>날짜: {formatDayLabel(date)}</li>
        <li>시간: {match.start_time.slice(0, 5)} ~ {match.end_time.slice(0, 5)}</li>
        <li>장소: {match.place_name}</li>
        <li>주소: {match.place_address}</li>
        <li>경기 방식: {match.match_format} · {match.gender_type}</li>
      </ul>

      {host.intro && (
        <>
          <h3>팀 소개</h3>
          <p>{host.intro}</p>
        </>
      )}
      {match.message && (
        <>
          <h3>하고 싶은 말</h3>
          <p>{match.message}</p>
        </>
      )}

      <hr />
      <BottomArea match={match} />
    </div>
  )
}

// 하단 영역 (FR-08 3번 표)
// 18-①에서는 경기 상태로만 나눈다. "보는 사람이 누구냐"에 따른 구분은 18-③에서
function BottomArea({ match }) {
  if (match.status === '취소') return <p>취소된 경기예요</p>
  if (!isUpcoming(match)) return <p>지난 경기예요</p>
  if (match.status === '확정') return <p>모집이 마감된 경기예요</p>
  return <p>신청 기능은 준비 중이에요</p> // 18-③에서 신청 영역으로 바꾼다
}