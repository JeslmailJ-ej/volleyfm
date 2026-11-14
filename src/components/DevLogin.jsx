import { useState } from 'react'
import { signInWithPasswordForDev } from '../api/auth'

// 🧪 개발용 테스트 로그인 — App에서 import.meta.env.DEV일 때만 보여준다
// 로그인에 성공하면 auth.js의 onAuthChange가 App에 알려 주므로, 여기서 따로 할 일은 없다
export default function DevLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(e) {
    e.preventDefault() // form 제출로 페이지가 새로고침되지 않게
    setSubmitting(true)
    setErrorMessage('')
    try {
      await signInWithPasswordForDev(email.trim(), password)
    } catch (err) {
      console.error(err)
      setErrorMessage('이메일 또는 비밀번호를 확인해 주세요')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 24, padding: 12, border: '1px dashed gray' }}>
      <p>🧪 개발용 테스트 로그인 (내 컴퓨터에서만 보여요)</p>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="테스트 계정 이메일" />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" />
      <button type="submit" disabled={submitting}>{submitting ? '로그인 중...' : '테스트 계정으로 로그인'}</button>
      {errorMessage && <p style={{ color: 'crimson' }}>{errorMessage}</p>}
    </form>
  )
}