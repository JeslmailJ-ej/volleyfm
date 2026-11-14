import { useEffect, useState } from 'react'
import { isUpcoming } from '../utils/date'
import { signInWithKakao } from '../api/auth'
import { countPendingApplications } from '../api/applications'
import ApplyArea from './ApplyArea'

// 상세 화면 하단 (FR-08 3번 표 + FR-09 3번 표) — 위에서부터 순서대로 확인한다
// props: match, user(로그인 안 했으면 null), teams = 내가 속한 팀 [{ role, team }], mainTeamId
export default function MatchBottomArea({ match, user, teams, mainTeamId }) {
  const myTeamIds = teams.map(({ team }) => team.id)
  const isHostMember = myTeamIds.includes(match.host_team.id) // 등록 팀 팀원인가
  const isOpponentMember = match.opponent_team !== null && myTeamIds.includes(match.opponent_team.id)

  if (match.status === '취소') return <p>취소된 경기예요</p>
  if (!isUpcoming(match)) return <p>지난 경기예요</p>

  if (match.status === '확정') {
    if (isHostMember || isOpponentMember) {
      const otherName = isHostMember ? match.opponent_team.name : match.host_team.name // 우리 쪽에서 본 상대
      return (
        <div>
          <p>확정된 경기예요 · vs {otherName}</p>
          <button disabled>채팅하기 (준비 중)</button>
        </div>
      )
    }
    return <p>모집이 마감된 경기예요</p>
  }

  // ---- 여기부터 모집중 ----
  if (isHostMember) return <HostArea matchId={match.id} />

  if (!user) return <button onClick={() => signInWithKakao()}>로그인하고 신청하기</button>

  // 내가 운영진인 팀만 (등록 팀은 위에서 이미 걸렀다)
  const adminTeams = teams.filter(({ role }) => role === '운영진').map(({ team }) => team)
  if (adminTeams.length === 0) {
    return (
      <div>
        <button disabled>연습경기 신청하기</button>
        <p>운영진만 신청할 수 있어요</p>
      </div>
    )
  }

  return <ApplyArea match={match} userId={user.id} adminTeams={adminTeams} mainTeamId={mainTeamId} />
}

// 등록 팀 팀원이 볼 때: 받은 신청 수 (Hook을 쓰려고 작은 컴포넌트로 뺐다)
function HostArea({ matchId }) {
  const [count, setCount] = useState(null)

  useEffect(() => {
    let ignore = false
    countPendingApplications(matchId)
      .then((n) => { if (!ignore) setCount(n) })
      .catch(console.error)
    return () => { ignore = true }
  }, [matchId])

  return (
    <div>
      <p>우리 팀이 올린 경기예요{count !== null && ` · 신청 ${count}팀`}</p>
      <button disabled>신청 관리 (준비 중)</button>
    </div>
  )
}