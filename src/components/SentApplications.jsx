import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getSentApplications, cancelApplication } from '../api/applications'
import { formatDayLabel, todayString } from '../utils/date'

// S-06 신청 관리 > 보낸 신청 (FR-09·10·11) — 우리 운영진 팀이 넣은 신청과 그 결과
// props: userId, adminTeamIds = 내가 운영진인 팀 id를 쉼표로 이은 글자 (ManageApplications에서 받음)
export default function SentApplications({ userId, adminTeamIds }) {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)            // 취소 후 다시 불러오기 신호
  const [cancelingId, setCancelingId] = useState(null) // 취소 중인 신청 id
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!adminTeamIds) {
      setLoading(false)
      return
    }
    let ignore = false
    setLoading(true)
    getSentApplications(adminTeamIds.split(','), todayString())
      .then((data) => { if (!ignore) setApplications(data) })
      .catch((err) => {
        console.error(err)
        if (!ignore) setErrorMessage('보낸 신청을 불러오지 못했어요')
      })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [adminTeamIds, version])

  async function handleCancel(application) {
    if (!window.confirm('신청을 취소할까요?')) return

    setCancelingId(application.id)
    setErrorMessage('')
    try {
      await cancelApplication(application.id, userId) // 20단계에서 만든 함수 그대로
    } catch (err) {
      console.error(err)
      setErrorMessage(err.message ?? '잠시 후 다시 시도해 주세요')
    } finally {
      setCancelingId(null)
      setVersion((v) => v + 1)
    }
  }

  return (
    <section>
      <h2>보낸 신청</h2>
      {errorMessage && <p style={{ color: 'crimson' }}>{errorMessage}</p>}

      {!adminTeamIds ? (
        <p>보낸 신청은 팀 운영진만 볼 수 있어요</p>
      ) : loading ? (
        <p>불러오는 중...</p>
      ) : applications.length === 0 ? (
        <p>보낸 신청이 없어요</p>
      ) : (
        <ul>
          {applications.map((a) => (
            <li key={a.id}>
              <Link to={`/matches/${a.match.id}`}>
                {formatDayLabel(new Date(`${a.match.match_date}T00:00:00`))} {a.match.start_time.slice(0, 5)} · {a.match.host_team.name}
              </Link>{' '}
              ({a.team.name}) · <b>{statusLabel(a)}</b>{' '}
              {a.status === '대기' && (
                <button onClick={() => handleCancel(a)} disabled={cancelingId !== null}>
                  {cancelingId === a.id ? '취소 중...' : '신청 취소'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// 신청 상태 → 화면 문구. 칸을 새로 만들지 않고 여러 칸의 조합으로 "왜 취소됐는지" 구분한다
function statusLabel(a) {
  if (a.status === '대기') return '수락 대기 중'
  if (a.status === '수락') return '확정됐어요 ✅'
  if (a.status === '거절') return '다른 팀으로 확정됐어요'
  // ---- 여기부터 '취소' ----
  if (a.match.status === '취소' && a.cancelled_by === a.match.cancelled_by) return '등록 팀이 경기를 취소했어요' // 008
  if (a.cancelled_by === null) return '다른 경기가 확정되어 자동 취소됐어요' // 007 자동 취소
  return '신청을 취소했어요'
}