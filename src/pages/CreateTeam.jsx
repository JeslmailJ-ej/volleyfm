import { useState } from 'react'
import { createTeam, getInviteCode, DISTRICTS, GENDER_TYPES } from '../api/teams'

// S-10 팀 만들기 (FR-02)
// props: onCreated = 팀을 만든 뒤 부를 함수 (팀 목록 새로고침용)
export default function CreateTeam({ onCreated }) {
  const [name, setName] = useState('')
  const [district, setDistrict] = useState('')
  const [genderType, setGenderType] = useState('')
  const [intro, setIntro] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [inviteCode, setInviteCode] = useState('') // 만들고 나면 보여줄 초대 코드

  function validate() {
    const trimmed = name.trim()
    if (trimmed.length < 2 || trimmed.length > 30) return '팀 이름은 2~30자로 입력해 주세요'
    if (!district) return '활동하는 구를 선택해 주세요'
    if (!genderType) return '팀 성별을 선택해 주세요'
    if (intro.length > 300) return '팀 소개는 300자까지 쓸 수 있어요'
    return ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const message = validate()
    setErrorMessage(message)
    if (message) return

    setSaving(true)
    try {
      const teamId = await createTeam({ name, district, genderType, intro })
      const code = await getInviteCode(teamId) // 방금 만든 팀이라 나는 운영진
      setInviteCode(code)
      onCreated()
    } catch (err) {
      console.error(err)
      // DB 함수에서 raise exception으로 보낸 문구가 err.message에 들어 있다
      setErrorMessage(err.message ?? '팀을 만들지 못했어요')
    } finally {
      setSaving(false)
    }
  }

  // 팀을 만든 뒤에는 초대 코드 화면
  if (inviteCode) {
    return ( 
      <div> 
        <h2>팀이 만들어졌어요!</h2>
        <p>팀원에게 이 초대 코드를 알려주세요</p>
        <p style={{ fontSize: 28, fontWeight: 'bold', letterSpacing: 4 }}>{inviteCode}</p>
        <button onClick={() => navigator.clipboard.writeText(inviteCode)}>코드 복사</button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>팀 만들기</h2>

      <label>
        팀 이름
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
      </label>

      <p>활동 지역: 대전</p>
      <select value={district} onChange={(e) => setDistrict(e.target.value)}>
        <option value="">구 선택</option>
        {DISTRICTS.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>

      <p>팀 성별</p>
      {GENDER_TYPES.map((g) => (
        <label key={g}>
          <input
            type="radio"
            name="genderType"
            value={g}
            checked={genderType === g}
            onChange={(e) => setGenderType(e.target.value)}
          />
          {g}
        </label>
      ))}

      <label>
        팀 소개 (선택, {intro.length}/300)
        <textarea value={intro} onChange={(e) => setIntro(e.target.value)} maxLength={300} />
      </label>

      {errorMessage && <p style={{ color: 'crimson' }}>{errorMessage}</p>}

      <button type="submit" disabled={saving}>
        {saving ? '만드는 중...' : '팀 만들기'}
      </button>
    </form>
  )
}