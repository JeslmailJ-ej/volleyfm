import { useEffect, useState } from 'react'
import { applyToMatch, getMyApplications, cancelApplication } from '../api/applications'
import { hasTeamMatchOn } from '../api/matches'
import { formatDayLabel } from '../utils/date'

// 신청 영역 (FR-09 3번 표) — 내가 운영진인 팀이 있을 때만 쓴다
// props: match, userId, adminTeams = 내가 운영진인 팀 [{ id, name, ... }], mainTeamId = 대표 팀 id
export default function ApplyArea({ match, userId, adminTeams, mainTeamId }) {
  // 대표 팀이 운영진 팀 중에 있으면 대표 팀, 아니면 첫 번째 팀을 기본 선택
  const [teamId, setTeamId] = useState(() =>
    adminTeams.some((t) => t.id === mainTeamId) ? mainTeamId : adminTeams[0].id,
  )
  const [applications, setApplications] = useState([]) // 이 경기에 대한 우리 팀들의 신청
  const [busyDay, setBusyDay] = useState(null)         // 그날 고른 팀 경기가 있나 (null = 확인 중)
  const [version, setVersion] = useState(0)            // 신청·취소 후 다시 불러오기 신호
  const [submitting, setSubmitting] = useState(false)
  const [doneMessage, setDoneMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  // 배열은 그릴 때마다 새로 만들어져서 의존성에 넣으면 매번 "바뀜"이 된다 → 글자로 바꿔서 넣는다
  const adminTeamIds = adminTeams.map((t) => t.id).join(',')

  // ① 우리 팀들의 이 경기 신청 불러오기
  useEffect(() => {
    let ignore = false
    getMyApplications(match.id, adminTeamIds.split(','))
      .then((data) => { if (!ignore) setApplications(data) })
      .catch(console.error)
    return () => { ignore = true }
  }, [match.id, adminTeamIds, version])

  // ② FR-07 미리 확인: 고른 팀이 그날 경기가 있나
  useEffect(() => {
    let ignore = false
    setBusyDay(null)
    hasTeamMatchOn(teamId, match.match_date)
      .then((busy) => { if (!ignore) setBusyDay(busy) })
      .catch(console.error)
    return () => { ignore = true }
  }, [teamId, match.match_date, version])

  const selectedTeam = adminTeams.find((t) => t.id === teamId)
  const myApplication = applications.find((a) => a.team_id === teamId) // 고른 팀의 신청 (없으면 undefined)

  function changeTeam(e) {
    setTeamId(e.target.value)
    setDoneMessage('')
    setErrorMessage('')
  }

  async function handleApply() {
    const when = `${formatDayLabel(new Date(`${match.match_date}T00:00:00`))} ${match.start_time.slice(0, 5)}`
    if (!window.confirm(`${selectedTeam.name}(으)로 ${when} 연습경기에 신청할까요?`)) return

    setSubmitting(true)
    setDoneMessage('')
    setErrorMessage('')
    try {
      await applyToMatch(match.id, teamId)
      setDoneMessage('신청했어요. 상대 팀이 수락하면 우리 팀 일정에 표시돼요.')
      setVersion((v) => v + 1) // ①② 다시 불러오기
    } catch (err) {
      console.error(err)
      setErrorMessage(err.message ?? '잠시 후 다시 시도해 주세요') // DB 함수의 raise exception 문구
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel() {
    if (!window.confirm('신청을 취소할까요?')) return

    setSubmitting(true)
    setDoneMessage('')
    setErrorMessage('')
    try {
      await cancelApplication(myApplication.id, userId)
      setDoneMessage('신청을 취소했어요')
      setVersion((v) => v + 1)
    } catch (err) {
      console.error(err)
      setErrorMessage(err.message ?? '잠시 후 다시 시도해 주세요')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {/* 운영진 팀이 여러 개면 고르기, 하나면 이름만 */}
      {adminTeams.length > 1 ? (
        <label>
          신청 팀{' '}
          <select value={teamId} onChange={changeTeam}>
            {adminTeams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
      ) : (
        <p>신청 팀: <b>{selectedTeam.name}</b></p>
      )}

      {myApplication?.status === '대기' ? (
        <p>
          신청 완료 · 수락 대기 중{' '}
          <button onClick={handleCancel} disabled={submitting}>신청 취소</button>
        </p>
      ) : myApplication?.status === '거절' ? (
        <p>상대 팀이 거절한 신청이에요</p>
      ) : (
        <>
          {busyDay === true && <p>이 날짜에 우리 팀 경기가 이미 있어요</p>}
          {busyDay === false && <p>✓ 우리 팀은 이날 다른 경기가 없어요</p>}
          {/* 확인 중(null)이거나 그날 경기가 있으면(true) 버튼을 끈다 */}
          <button onClick={handleApply} disabled={submitting || busyDay !== false}>
            {submitting ? '신청 중...' : '연습경기 신청하기'}
          </button>
        </>
      )}

      {doneMessage && <p>{doneMessage}</p>}
      {errorMessage && <p style={{ color: 'crimson' }}>{errorMessage}</p>}
    </div>
  )
}