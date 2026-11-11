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