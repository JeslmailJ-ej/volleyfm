import { useState } from 'react'
import { searchPlaces } from '../api/kakaoMap'

// 장소 검색 부품
// props: value = 고른 장소({ name, address, lat, lng }) 또는 null, onSelect = 장소를 고르거나 지울 때
export default function PlaceSearch({ value, onSelect }) {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState([])
  const [message, setMessage] = useState('')
  const [searching, setSearching] = useState(false)

  async function search() {
    if (!keyword.trim()) return
    setSearching(true)
    setMessage('')
    try {
      const list = await searchPlaces(keyword.trim())
      setResults(list)
      if (list.length === 0) setMessage('검색 결과가 없어요. 다른 이름으로 검색해 보세요')
    } catch (err) {
      console.error(err)
      setMessage(err.message)
    } finally {
      setSearching(false)
    }
  }

  // 입력칸에서 Enter: 바깥 form이 제출되지 않게 막고, 검색만 한다
  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      search()
    }
  }

  function choose(place) {
    onSelect(place)
    setResults([])
    setKeyword('')
  }

  // 이미 골랐으면: 고른 장소 + [다시 검색]
  if (value) {
    return (
      <div>
        <p>📍 <b>{value.name}</b> ({value.address})</p>
        <button type="button" onClick={() => onSelect(null)}>다시 검색</button>
      </div>
    )
  }

  return (
    <div>
      <input
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="초등학교 이름으로 검색 (예: 대전초등학교)"
      />
      {/* type="button": form 안의 버튼은 기본이 제출(submit)이라 꼭 적어야 한다 */}
      <button type="button" onClick={search} disabled={searching}>
        {searching ? '검색 중...' : '검색'}
      </button>

      {message && <p>{message}</p>}

      <ul>
        {results.map((place) => (
          <li key={place.id}>
            <button type="button" onClick={() => choose(place)}>
              <b>{place.name}</b> {place.address}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}