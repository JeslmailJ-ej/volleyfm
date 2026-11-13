import { useEffect, useState } from 'react'
import { getMatchesBetween } from '../api/matches'
import { startOfWeek, addDays, toDateString, formatDayLabel } from '../utils/date'

// 홈: 한 주(월~일) 경기 목록 (FR-04)
// props: refreshKey = 이 값이 바뀌면 목록을 다시 불러온다 (경기를 새로 등록했을 때)
export default function WeekMatchList({ refreshKey }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  // 이번에 보여줄 7일 (월 ~ 일)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const from = toDateString(days[0])
  const to = toDateString(days[6])
  const isThisWeek = from === toDateString(startOfWeek(new Date()))

  useEffect(() => {
    let ignore = false // 주를 빠르게 넘길 때, 늦게 도착한 옛날 응답은 무시하기
    setLoading(true)
    setErrorMessage('')
    getMatchesBetween(from, to)
      .then((data) => { if (!ignore) setMatches(data) })
      .catch((err) => {
        console.error(err)
        if (!ignore) setErrorMessage('경기 목록을 불러오지 못했어요')
      })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true } // 클린업: 다음 실행 전에 이전 요청 결과를 버린다
  }, [from, to, refreshKey])

  return (
    <section>
      <h2>{isThisWeek ? '이번 주 경기' : '경기 일정'} ({formatDayLabel(days[0])} ~ {formatDayLabel(days[6])})</h2>
      <button onClick={() => setWeekStart(addDays(weekStart, -7))}>◀ 지난 주</button>
      <button onClick={() => setWeekStart(startOfWeek(new Date()))} disabled={isThisWeek}>이번 주</button>
      <button onClick={() => setWeekStart(addDays(weekStart, 7))}>다음 주 ▶</button>

      {loading && <p>불러오는 중...</p>}
      {errorMessage && <p style={{ color: 'crimson' }}>{errorMessage}</p>}

      {!loading && !errorMessage && days.map((day) => {
        const dateString = toDateString(day)
        const dayMatches = matches.filter((m) => m.match_date === dateString) // 그날 경기만
        return (
          <div key={dateString}>
            <h3>{formatDayLabel(day)}</h3>
            {dayMatches.length === 0 ? (
              <p>경기 없음</p>
            ) : (
              <ul>
                {dayMatches.map((m) => (
                  <li key={m.id}>
                    {m.start_time.slice(0, 5)}~{m.end_time.slice(0, 5)}{' '}
                    <b>{m.host_team.name}</b>({m.host_team.district}){' '}
                    {m.opponent_team && <>vs <b>{m.opponent_team.name}</b>{' '}</>}
                    · {m.match_format} · {m.gender_type} · {m.place_name}{' '}
                    [{m.status}]
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </section>
  )
}