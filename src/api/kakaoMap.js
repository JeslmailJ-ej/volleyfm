// 카카오 지도 SDK (장소 검색) — 외부 서비스 호출도 src/api에 모은다
const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY

// 대전시청 좌표: 검색할 때 대전 주변 결과가 먼저 나오게 하는 기준점
const DAEJEON = { lat: 36.3504, lng: 127.3845 }

let loadPromise = null // SDK는 한 번만 불러온다 (두 번째부터는 같은 약속을 돌려줌)

// 카카오 지도 SDK 불러오기: <script> 태그를 페이지에 붙이고, 다 읽히면 kakao 객체를 돌려준다
function loadKakaoMap() {
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&libraries=services&autoload=false`
    script.onload = () => window.kakao.maps.load(() => resolve(window.kakao))
    script.onerror = () => {
      loadPromise = null // 실패하면 다음에 다시 시도할 수 있게
      reject(new Error('카카오 지도를 불러오지 못했어요'))
    }
    document.head.appendChild(script)
  })
  return loadPromise
}

// 키워드로 장소 검색 (예: '한밭체육관')
// 돌려받는 값: [{ id, name, address, lat, lng }, ...]  (결과 없으면 [])
export async function searchPlaces(keyword) {
  const kakao = await loadKakaoMap()
  const places = new kakao.maps.services.Places()

  // 카카오 검색은 콜백 방식이라, await로 쓸 수 있게 Promise로 감싼다
  return new Promise((resolve, reject) => {
    places.keywordSearch(
      keyword,
      (data, status) => {
        if (status === kakao.maps.services.Status.OK) {
          resolve(data.map((p) => ({
            id: p.id,
            name: p.place_name,
            address: p.road_address_name || p.address_name, // 도로명 주소가 없으면 지번 주소
            lat: Number(p.y), // 카카오는 y = 위도, x = 경도 (글자로 옴 → 숫자로)
            lng: Number(p.x),
          })))
        } else if (status === kakao.maps.services.Status.ZERO_RESULT) {
          resolve([])
        } else {
          reject(new Error('장소 검색에 실패했어요'))
        }
      },
      { location: new kakao.maps.LatLng(DAEJEON.lat, DAEJEON.lng), radius: 20000 }, // 대전시청 반경 20km
    )
  })
}

// 카카오맵 길찾기 주소 (휴대폰은 카카오맵 앱, PC는 웹으로 열린다)
export function kakaoDirectionsUrl({ name, lat, lng }) {
  return `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`
}

// container(div)에 지도를 그리고 장소에 핀 1개 (FR-08). 핀을 누르면 길찾기
// shouldStop: SDK를 기다리는 사이 화면이 바뀌었으면 true → 그리지 않는다
export async function drawMapWithPin(container, { name, lat, lng }, shouldStop) {
  const kakao = await loadKakaoMap()
  if(shouldStop()) return

  const position = new kakao.maps.LatLng(lat, lng)
  const map = new kakao.maps.Map(container, { center: position, level: 4 }) // level: 작을수록 확대
  const marker = new kakao.maps.Marker({ map, position })
  kakao.maps.event.addListener(marker, 'click', () => {
    window.open(kakaoDirectionsUrl({ name, lat, lng }), '_blank')
  })
}