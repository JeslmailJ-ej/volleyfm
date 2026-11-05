import { useEffect, useState } from 'react'
import { signInWithKakao, signOut, getCurrentUser, onAuthChange } from './api/auth'

function App() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    getCurrentUser().then(setUser)          // 처음 열 때 로그인 상태 확인
    const unsubscribe = onAuthChange(setUser) // 로그인·로그아웃하면 화면 바로 바꾸기
    return unsubscribe
  }, [])

  const nickname =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.user_metadata?.nickname ??
    '이름 없음'

  return (
    <main>
      <h1>VolleyFM</h1>
      {user ? (
        <>
          <p>로그인됨: {nickname}</p>
          <button onClick={signOut}>로그아웃</button>
        </>
      ) : (
        <button onClick={signInWithKakao}>카카오로 시작하기</button>
      )}
    </main>
  )
}

export default App