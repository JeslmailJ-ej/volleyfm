import { useState } from 'react'
import { createMatch, MATCH_FORMATS } from '../api/matches'
import { GENDER_TYPES } from '../api/teams'
import { todayString } from '../utils/date'
import TimeSelect from '../components/TimeSelect'

// ⚠️ 임시 좌표 (대전시청). 다음 단계에서 카카오 지도 장소 검색으로 바꾼다
const TEMP_LAT = 36.3504
const TEMP_LNG = 127.3845

// S-05 연습경기 등록 (FR-06)
// props: userId, teams = 내 팀 목록, mainTeamId = 대표 팀 id
export default function CreateMatch({ userId, teams, mainTeamId }) {
  const firstTeamId = mainTeamId ?? teams[0].team.id // 대표 팀이 기본, 없으면 첫 팀
  const [hostTeamId, setHostTeamId] = useState(firstTeamId)
  const [matchDate, setMatchDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [placeName, setPlaceName] = useState('')
  const [placeAddress, setPlaceAddress] = useState('')
  const [matchFormat, setMatchFormat] = useState('')
  const [genderType, setGenderType] = useState(findTeam(firstTeamId)?.gender_type ?? '')
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [doneMessage, setDoneMessage] = useState('')
  const [saving, setSaving] = useState(false)

  // 팀 id로 내 팀 목록에서 팀 정보 찾기
  function findTeam(teamId) {
    return teams.find(({ team }) => team.id === teamId)?.team
  }

  // 팀을 바꾸면 성별도 그 팀의 성별로 바꿔 준다 (직접 다시 고를 수 있음)
  function handleTeamChange(e) {
    setHostTeamId(e.target.value)
    setGenderType(findTeam(e.target.value)?.gender_type ?? '')
  }

  function validate() {
    if (!matchDate) return '날짜를 선택해 주세요'
    if (matchDate < todayString()) return '지난 날짜는 선택할 수 없어요'
    if (!startTime || !endTime) return '시작·종료 시간을 입력해 주세요'
    if (endTime <= startTime) return '종료 시간은 시작 시간보다 늦어야 해요'
    if (!placeName.trim() || !placeAddress.trim()) return '장소 이름과 주소를 입력해 주세요'
    if (!matchFormat) return '경기 방식을 선택해 주세요'
    if (!genderType) return '성별을 선택해 주세요'
    return ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const msg = validate()
    setErrorMessage(msg)
    setDoneMessage('')
    if (msg) return

    setSaving(true)
    try {
      await createMatch({
        userId, hostTeamId, matchDate, startTime, endTime,
        placeName, placeAddress, lat: TEMP_LAT, lng: TEMP_LNG,
        matchFormat, genderType, message,
      })
      setDoneMessage('연습경기를 등록했어요!')
      setMatchDate('')
      setStartTime('')
      setEndTime('')
    } catch (err) {
      console.error(err)
      setErrorMessage(err.message ?? '등록하지 못했어요')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>연습경기 등록</h2>

      <p>등록 팀</p>
      <select value={hostTeamId} onChange={handleTeamChange}>
        {teams.map(({ team }) => (
          <option key={team.id} value={team.id}>{team.name}</option>
        ))}
      </select>

      <p>날짜·시간</p>
      <input type="date" value={matchDate} min={todayString()} onChange={(e) => setMatchDate(e.target.value)} />
      <TimeSelect value={startTime} onChange={setStartTime} />
      ~
      <TimeSelect value={endTime} onChange={setEndTime} />

      <p>장소 (지도 검색은 다음 단계)</p>
      <input value={placeName} onChange={(e) => setPlaceName(e.target.value)} placeholder="장소 이름" maxLength={100} />
      <input value={placeAddress} onChange={(e) => setPlaceAddress(e.target.value)} placeholder="주소" maxLength={200} />

      <p>경기 방식</p>
      {MATCH_FORMATS.map((f) => (
        <label key={f}>
          <input type="radio" name="matchFormat" value={f} checked={matchFormat === f} onChange={(e) => setMatchFormat(e.target.value)} />
          {f}
        </label>
      ))}

      <p>성별</p>
      {GENDER_TYPES.map((g) => (
        <label key={g}>
          <input type="radio" name="matchGender" value={g} checked={genderType === g} onChange={(e) => setGenderType(e.target.value)} />
          {g}
        </label>
      ))}

      <label>
        한마디 (선택, {message.length}/200)
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={200} />
      </label>

      {errorMessage && <p style={{ color: 'crimson' }}>{errorMessage}</p>}
      {doneMessage && <p style={{ color: 'green' }}>{doneMessage}</p>}

      <button type="submit" disabled={saving}>{saving ? '등록 중...' : '등록하기'}</button>
    </form>
  )
}