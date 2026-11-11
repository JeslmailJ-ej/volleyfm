import { useState } from 'react'
import { findTeamByCode, joinTeamByCode, INVITE_CODE_PATTERN } from '../api/teams'

// S-09 초대 코드로 팀 가입 (FR-03)
// 1단계: 코드 입력 → [확인]  2단계: 팀 정보 확인 → [가입하기]
// props: onJoined = 가입한 뒤 부를 함수 (프로필·팀 목록 새로고침용)
export default function JoinTeam({ onJoined }) {
  const [code, setCode] = useState('')
  const [preview, setPreview] = useState(null) // 미리 본 팀 정보 (없으면 1단계)
  const [errorMessage, setErrorMessage] = useState('')
  const [doneMessage, setDoneMessage] = useState('')
  const [working, setWorking] = useState(false)

  // 입력할 때: 공백 빼고 대문자로 바꿔서 저장 (abc 123 → ABC123)
  function handleChange(e) {
    setCode(e.target.value.replace(/\s/g, '').toUpperCase())
    setPreview(null) // 코드를 고치면 미리 보기는 다시
    setErrorMessage('')
    setDoneMessage('')
  }

  // 1단계: 팀 미리 보기
  async function handleFind(e) {
    e.preventDefault()
    if (!INVITE_CODE_PATTERN.test(code)) {
      setErrorMessage('초대 코드는 영문·숫자 6자리예요')
      return
    }
    setWorking(true)
    try {
      setPreview(await findTeamByCode(code))
    } catch (err) {
      setErrorMessage(err.message ?? '팀을 찾지 못했어요')
    } finally {
      setWorking(false)
    }
  }

  // 2단계: 가입하기
  async function handleJoin() {
    setWorking(true)
    try {
      await joinTeamByCode(code)
      setDoneMessage(`${preview.name}에 가입했어요!`)
      setPreview(null)
      setCode('')
      onJoined()
    } catch (err) {
      setErrorMessage(err.message ?? '가입하지 못했어요')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div>
      <h2>초대 코드로 가입</h2>

      <form onSubmit={handleFind}>
        <input
          value={code}
          onChange={handleChange}
          placeholder="예: AB12CD"
          maxLength={6}
        />
        <button type="submit" disabled={working}>확인</button>
      </form>

      {preview && (
        <div>
          <p>
            <b>{preview.name}</b> ({preview.district} · {preview.gender_type} · {preview.member_count}명)
          </p>
          <p>이 팀에 가입할까요?</p>
          <button onClick={handleJoin} disabled={working}>가입하기</button>
          <button onClick={() => setPreview(null)} disabled={working}>취소</button>
        </div>
      )}

      {errorMessage && <p style={{ color: 'crimson' }}>{errorMessage}</p>}
      {doneMessage && <p style={{ color: 'green' }}>{doneMessage}</p>}
    </div>
  )
}