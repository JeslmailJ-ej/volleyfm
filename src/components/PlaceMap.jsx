import { useEffect, useRef, useState } from 'react'
import { drawMapWithPin, kakaoDirectionsUrl } from '../api/kakaoMap'

// 장소 지도 + 핀 (FR-08 상세 맨 위). 핀이나 아래 링크를 누르면 카카오맵 길찾기
export default function PlaceMap({ name, lat, lng }) {
  const containerRef = useRef(null) // 지도를 그릴 <div>를 가리키는 손잡이
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let ignore = false
    // DB의 좌표가 글자로 올 수도 있어서 Number()로 숫자로 바꾼다
    drawMapWithPin(containerRef.current, { name, lat: Number(lat), lng: Number(lng) }, () => ignore)
      .catch((err) => {
        console.error(err)
        if (!ignore) setFailed(true)
      })
    return () => { ignore = true }
  }, [name, lat, lng])

  return (
    <div>
      {failed
        ? <p>지도를 불러오지 못했어요</p>
        : <div ref={containerRef} style={{ width: '100%', height: 220 }} />}
      <a href={kakaoDirectionsUrl({ name, lat, lng })} target="_blank" rel="noreferrer">
        카카오맵에서 길찾기 ↗
      </a>
    </div>
  )
}