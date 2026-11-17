import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getReceivedApplications, acceptApplication } from '../api/applications'
import { getTeamStats } from '../api/teams'
import { formatDayLabel, formatCareer, isUpcoming, todayString } from '../utils/date'

// S-06 신청 관리 > 받은 신청 (FR-10) — 주소: /manage
// 내가 운영진인 팀이 올린 모집중 경기와, 그 경기에 들어온 대기 신청
// props: user = 로그인한 사람(없으면 null), teams = 내가 속한 팀 [{ role, team }]
export default function ManageApplications({ user, teams }) {
  // 내가 운영진인 팀 id를 글자로 (의존성 배열용 — ApplyArea와 같은 이유)
  const adminTeamIds = teams
    .filter(({ role }) => role === '운영진')
    .map(({ team }) => team.id)
    .join(',')

  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)             // 수락 후 다시 불러오기 신호
  const [acceptingId, setAcceptingId] = useState(null)  // 수락 중인 신청 id (그동안 버튼 잠금)
  const [doneMatchId, setDoneMatchId] = useState(null)  // 방금 확정한 경기 id
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!adminTeamIds) {
      setLoading(false)
      return
    }
    let ignore = false
    setLoading(true)
    getReceivedApplications(adminTeamIds.split(','), todayString())
      .then((data) => { if (!ignore) setMatches(data.filter(isUpcoming)) }) // 오늘 이미 시작한 경기는 빼고
      .catch((err) => {
        console.error(err)
        if (!ignore) setErrorMessage('신청 목록을 불러오지 못했어요')
      })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [adminTeamIds, version])

  // '11/24(월) 19:00'
  function whenLabel(match) {
    return `${formatDayLabel(new Date(`${match.match_date}T00:00:00`))} ${match.start_time.slice(0, 5)}`
  }

  async function handleAccept(match, application) {
    const others = match.match_applications.length - 1 // 자동으로 거절될 팀 수
    let text = `${application.team.name}와(과) ${whenLabel(match)} 경기를 확정할까요?`
    if (others > 0) text += ` 나머지 ${others}팀의 신청은 자동으로 거절돼요.`
    if (!window.confirm(text)) return

    setAcceptingId(application.id)
    setDoneMatchId(null)
    setErrorMessage('')
    try {
      await acceptApplication(application.id)
      setDoneMatchId(match.id)
    } catch (err) {
      console.error(err)
      setErrorMessage(err.message ?? '잠시 후 다시 시도해 주세요') // 007의 raise exception 문구
    } finally {
      setAcceptingId(null)
      setVersion((v) => v + 1) // 성공이든 실패든 목록을 새로 (상대 팀이 그사이 취소했을 수도 있으니까)
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

  return (
    <div>
      <Link to="/">← 홈으로</Link>
      <h2>신청 관리 · 받은 신청</h2>

      {doneMatchId && (
        <p>
          확정됐어요! 상대 팀과 채팅을 시작해 보세요{' '}
          <Link to={`/matches/${doneMatchId}`}>경기 보기</Link>
        </p>
      )}
      {errorMessage && <p style={{ color: 'crimson' }}>{errorMessage}</p>}

      {/* 운영진 팀 없음 → 불러오는 중 → 경기 없음 → 경기별 신청 목록 */}
      {!adminTeamIds ? (
        <p>받은 신청은 팀 운영진만 볼 수 있어요</p>
      ) : loading ? (
        <p>불러오는 중...</p>
      ) : matches.length === 0 ? (
        <p>모집 중인 경기가 없어요</p>
      ) : (
        matches.map((m) => (
          <section key={m.id}>
            <h3>
              <Link to={`/matches/${m.id}`}>{whenLabel(m)} · {m.place_name}</Link>{' '}
              <small>({m.host_team.name})</small>
            </h3>
            {m.match_applications.length === 0 ? (
              <p>아직 들어온 신청이 없어요</p>
            ) : (
              <ul>
                {m.match_applications.map((a) => (
                  <li key={a.id}>
                    <b>{a.team.name}</b> ({a.team.district} · {a.team.gender_type})
                    <TeamCareer teamId={a.team.id} />{' '}
                    <button onClick={() => handleAccept(m, a)} disabled={acceptingId !== null}>
                      {acceptingId === a.id ? '확정 중...' : '수락'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}
    </div>
  )
}

// 신청 팀의 평균 경력 한 줄 (005 get_team_stats) — 팀마다 따로 불러오려고 작은 컴포넌트로
function TeamCareer({ teamId }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let ignore = false
    getTeamStats(teamId)
      .then((data) => { if (!ignore) setStats(data) })
      .catch(console.error)
    return () => { ignore = true }
  }, [teamId])

  if (!stats || stats.member_count === 0) return null
  return <span> · 평균 경력 {formatCareer(stats.avg_career_months)} ({stats.member_count}명)</span>
}