import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { getMatchById } from '../api/matches'
import { getTeamStats } from '../api/teams'
import { formatDayLabel, formatCareer } from '../utils/date'
import PlaceMap from '../components/PlaceMap'
import MatchBottomArea from '../components/MatchBottomArea'

// S-04 연습경기 상세 (FR-08) — 로그인 안 해도 볼 수 있다
// 주소: /matches/경기ID
// props: user = 로그인한 사람(없으면 null), teams = 내가 속한 팀 [{ role, team }], mainTeamId = 대표 팀 
export default function MatchDetail({ user, teams, mainTeamId }) {
  const { matchId } = useParams() // 주소의 :matchId 자리에 있는 값을 꺼낸다
  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [stats, setStats] = useState(null)
  const [shareMessage, setShareMessage] = useState('')

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

  const hostTeamId = match?.host_team.id // 아직 경기가 없으면(null) 오류 대신 undefined
  useEffect(() => {
    if(!hostTeamId) return
    let ignore = false
    setStats(null)
    getTeamStats(hostTeamId)
      .then((data) => { if(!ignore) setStats(data) })
      .catch(console.error) // 평균 경력을 못 불러와도 나머지 상세 정보는 그대로 보여준다
    return () => { ignore = true }
  }, [hostTeamId])

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

  // ---- [공유] 버튼: 공유 창이 있으면 열고, 없으면 링크 복사
  async function share() {
    const url = window.location.href // 지금 주소 = 이 경기 링크
    const title = `${host.name} 연습경기 · ${formatDayLabel(date)} ${match.start_time.slice(0, 5)}`
    setShareMessage('')
    try{
      if(navigator.share) {
        await navigator.share({ title, text: title, url })
      } else {
        await navigator.clipboard.writeText(url)
        setShareMessage('링크를 복사했어요')
      }
    } catch(err) {
      if (err.name === 'AbortError') return // 공유 창을 그냥 닫은 것 → 실패 아님
      console.error(err)
      setShareMessage('공유하지 못했어요')
    }
  }

  return (
    <div>
      <Link to="/">← 홈으로</Link> {' '}
      <button onClick={share}>공유</button>
      {shareMessage && <span> {shareMessage}</span>}

      <PlaceMap name={match.place_name} lat={match.lat} lng={match.lng} />

      <h2>{host.name} [{match.status}]</h2>
      <p>{host.district} · {host.gender_type} 팀 · {match.match_format}</p>
      {stats && stats.member_count > 0 && (
        <p>
          평균 경력 <b>{formatCareer(stats.avg_career_months)}</b> ({stats.member_count}명)
          <br />
          <small>ⓘ 평균 경력 = VolleyFM에 가입한 팀원 {stats.member_count}명의 배구 경력 평균</small>
        </p>
      )}
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
      <MatchBottomArea match={match} user={user} teams={teams} mainTeamId={mainTeamId} />
    </div>
  )
}