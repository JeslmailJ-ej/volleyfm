// 시간 고르기 부품: [오후 7시 ▼] [00분 ▼]
// value / onChange는 'HH:MM' 글자 하나로 주고받는다 (input type="time"과 같은 모양)
// → 쓰는 쪽(CreateMatch)은 바꿀 게 거의 없다

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6) // 6 ~ 23시
const MINUTES = ['00', '10', '20', '30', '40', '50']      // 10분 단위

// 19 → '오후 7시', 12 → '오후 12시', 9 → '오전 9시'
function hourLabel(h) {
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${ampm} ${h12}시`
}

export default function TimeSelect({ value, onChange }) {
  const [hour, minute] = value ? value.split(':') : ['', ''] // '19:30' → ['19', '30']

  function handleHour(e) {
    const h = e.target.value
    onChange(h ? `${h}:${minute || '00'}` : '') // 시를 처음 고르면 분은 00으로
  }

  function handleMinute(e) {
    onChange(`${hour}:${e.target.value}`)
  }

  return (
    <span>
      <select value={hour} onChange={handleHour}>
        <option value="">시</option>
        {HOURS.map((h) => {
          const hh = String(h).padStart(2, '0') // 7 → '07'
          return <option key={hh} value={hh}>{hourLabel(h)}</option>
        })}
      </select>
      <select value={minute || '00'} onChange={handleMinute} disabled={!hour}>
        {MINUTES.map((m) => (
          <option key={m} value={m}>{m}분</option>
        ))}
      </select>
    </span>
  )
}