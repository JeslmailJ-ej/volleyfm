import { useState } from 'react'
import { createProfile } from '../api/profiles'

// S-01 첫 가입 정보 입력 (FR-01, FR-19)
// props: user = 로그인한 사용자, onDone = 저장이 끝나면 부를 함수
export default function ProfileSetup({ user, onDone }) {
  const kakaoName =
    user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.user_metadata?.nickname ?? ''

  const now = new Date()
  const thisYear = now.getFullYear()
  const thisMonth = now.getMonth() + 1 // getMonth()는 0~11이라 +1

  // 입력값을 state로 들고 있다 (입력할 때마다 화면이 다시 그려진다)
  const [nickname, setNickname] = useState(kakaoName)
  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [saving, setSaving] = useState(false)

  // 연도 선택지: 올해부터 50년 전까지
  const years = Array.from({ length: 50 }, (_, i) => thisYear - i)
  // 올해를 고르면 이번 달까지만 (미래 달은 고를 수 없게)
  const maxMonth = Number(year) === thisYear ? thisMonth : 12
  const months = Array.from({ length: maxMonth }, (_, i) => i + 1)

  // 입력 검사: 문제가 있으면 안내 문구, 없으면 빈 문자열
  function validate() {
    const trimmed = nickname.trim()
    if (trimmed.length < 2 || trimmed.length > 30) return '닉네임은 2~30자로 입력해 주세요'
    if (!year || !month) return '배구를 시작한 연도와 월을 선택해 주세요'
    if (Number(year) === thisYear && Number(month) > thisMonth) return '미래 날짜는 선택할 수 없어요'
    return ''
  }

  async function handleSubmit(e) {
    e.preventDefault() // form의 기본 동작(페이지 새로고침) 막기
    const message = validate()
    setErrorMessage(message)
    if (message) return

    setSaving(true)
    try {
      const mm = String(month).padStart(2, '0') // 3 → '03'
      const profile = await createProfile({
        userId: user.id,
        nickname,
        volleyballSince: `${year}-${mm}`,
      })
      onDone(profile)
    } catch (err) {
      console.error(err)
      setErrorMessage('저장하지 못했어요. 잠시 후 다시 시도해 주세요')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>처음 오셨네요! 정보를 알려주세요</h2>

      <label>
        닉네임
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={30}
        />
      </label>

      <p>배구를 시작한 시기</p>
      <select value={year} onChange={(e) => { setYear(e.target.value); setMonth('') }}>
        <option value="">연도</option>
        {years.map((y) => (
          <option key={y} value={y}>{y}년</option>
        ))}
      </select>
      <select value={month} onChange={(e) => setMonth(e.target.value)} disabled={!year}>
        <option value="">월</option>
        {months.map((m) => (
          <option key={m} value={m}>{m}월</option>
        ))}
      </select>

      {errorMessage && <p style={{ color: 'crimson' }}>{errorMessage}</p>}

      <button type="submit" disabled={saving}>
        {saving ? '저장 중...' : '시작하기'}
      </button>
    </form>
  )
}