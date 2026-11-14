import { useEffect, useState } from 'react'
import { signInWithKakao, signOut, getCurrentUser, onAuthChange } from './api/auth'
import { getMyProfile } from './api/profiles'
import { getMyTeams } from './api/teams'
import ProfileSetup from './pages/ProfileSetup'
import CreateTeam from './pages/CreateTeam'
import JoinTeam from './pages/JoinTeam'
import CreateMatch from './pages/CreateMatch'
import WeekMatchList from './components/WeekMatchList'
import { Routes, Route, Link } from 'react-router'
import MatchDetail from './pages/MatchDetail'
import DevLogin from './components/DevLogin'

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [matchVersion, setMatchVersion] = useState(0)

  // 1) 로그인 상태 지켜보기 (전 단계와 같음)
  useEffect(() => {
    getCurrentUser().then(setUser)
    const unsubscribe = onAuthChange(setUser)
    return unsubscribe
  }, [])

  // 2) 로그인한 사람이 바뀌면 → 프로필 확인
  useEffect(() => {
    if (!user) {
      setProfile(null)
      setTeams([])
      setLoading(false)
      return
    }
    setLoading(true)
    getMyProfile(user.id)
      .then(setProfile)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user?.id]) // 사용자 id가 바뀔 때만 다시 실행

  // 3) 프로필이 있으면 → 내 팀 목록 불러오기
  useEffect(() => {
    if (profile) loadTeams()
  }, [profile?.id])

  function loadTeams() {
    getMyTeams(user.id).then(setTeams).catch(console.error)
  }

  // 팀을 만들거나 가입하면 DB에서 대표 팀(main_team_id)이 바뀔 수 있으니 프로필도 다시 불러온다
  function handleTeamChanged() {
    getMyProfile(user.id).then(setProfile).catch(console.error)
    loadTeams()
  }

  // ---------- 화면 고르기 (조건부 렌더링) ----------
  function renderHome() {
    if (loading) return <p>불러오는 중...</p>

    if (!user) {
      return (
      <div>
        <WeekMatchList refreshKey={matchVersion} />
        <button onClick={signInWithKakao}>카카오로 시작하기</button> 
        {import.meta.env.DEV && <DevLogin />}
      </div>
      )
    }

    if (!profile) {
      return <ProfileSetup user={user} onDone={setProfile} />
    }

    return (
      <div>
        <p>
          {profile.nickname}님 안녕하세요 <button onClick={signOut}>로그아웃</button>
        </p>

        <WeekMatchList refreshKey={matchVersion} />

        <h2>내 팀</h2>
        {teams.length === 0 ? (
          <p>아직 소속된 팀이 없어요</p>
        ) : (
          <ul>
            {teams.map(({ role, team }) => (
              <li key={team.id}>
                {team.name} ({team.district} · {team.gender_type}) — {role}
                {team.id === profile.main_team_id && ' ⭐대표 팀'}
              </li>
            ))}
          </ul>
        )}

        {teams.length > 0 && (
          <CreateMatch 
            userId={user.id} 
            teams={teams} 
            mainTeamId={profile.main_team_id}
            onCreated={() => setMatchVersion((v) => v + 1)} 
          />
        )}

        <JoinTeam onJoined={handleTeamChanged} />
        <CreateTeam onCreated={handleTeamChanged} />
      </div>
    )
  }

  //---- 주소에 따라 화면 고르기 ----
  return (
    <Routes>
      <Route path="/" element={renderHome()} />
      <Route 
        path="/matches/:matchId" 
        element={<MatchDetail user={user} teams={teams} mainTeamId={profile?.main_team_id} />} 
      />
      <Route path="*" element={<div><p>페이지를 찾을 수 없어요</p><Link to="/">홈으로</Link></div>} />
    </Routes>
  )
}