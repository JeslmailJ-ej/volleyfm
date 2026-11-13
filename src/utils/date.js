// 날짜를 'YYYY-MM-DD' 글자로 바꾸기 (내 컴퓨터 시간 = 한국 시간 기준)
// ⚠️ toISOString()은 UTC 기준이라 한국 오전 0~9시에는 하루 전 날짜가 나온다 → 쓰지 않는다
export function toDateString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 오늘 날짜 'YYYY-MM-DD'
export function todayString() {
  return toDateString(new Date())
}

export function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()) //Fri Nov 13 2026 00:00:00 GMT+0900 (한국 표준시)
  const day = d.getDay() // 5 - 금요일이라
  const diff = day === 0 ? -6 : 1 - day // 월요일 날짜 찾으려고 하는거 diff -4임
  d.setDate(d.getDate() + diff) // getDate -> 13 - 4 = 9 11월 9일이 월요일
  return d // 위에서 set했으니까 11월 9일로 셋팅 되어 있음.
}

export function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export function formatDayLabel(date) {
  return `${date.getMonth() + 1}/${date.getDate()}(${WEEKDAYS[date.getDay()]})`
}

export function isUpcoming(match) {
  const now = new Date() // Fri Nov 13 2026 09:49:12 GMT+0900 (한국 표준시)
  const today = toDateString(now) // 2026-11-13
  const nowTime = now.toTimeString().slice(0, 8) // 09:49:12
  if(match.match_date > today) return true
  if(match.match_date < today) return false
  return match.start_time > nowTime
}