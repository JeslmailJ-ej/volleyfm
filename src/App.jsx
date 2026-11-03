import { useEffect, useState } from 'react'
import { supabase } from './api/supabaseClient'

function App() {
  const [message, setMessage] = useState('연결 확인 중...')

  useEffect(() => {
    async function checkConnection() {
      const { data, error } = await supabase.from('matches').select('*')
      if (error) {
        setMessage('연결 실패: ' + error.message)
      } else {
        setMessage(`연결 성공! 볼 수 있는 경기 ${data.length}개`)
      }
    }
    checkConnection()
  }, [])

  return (
    <main>
      <h1>VolleyFM</h1>
      <p>{message}</p>
    </main>
  )
}

export default App