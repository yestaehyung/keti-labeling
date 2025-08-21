export const API_CONFIG = {
  // 여기에 백엔드 서버 주소를 입력하세요
  BASE_URL: "http://114.110.129.109:8000", // 예: 'http://your-backend-server.com:8000'

  // API 엔드포인트들
  ENDPOINTS: {
    IMAGES: "/api/images",
    UPLOAD_IMAGE: "/api/upload-image",
    UPLOAD: "/api/upload",
    GENERATE_POLYGONS: "/api/generate-polygons",
    GENERATE_POLYGONS_WITH_POINTS: "/api/generate-polygons-with-points",
    GEMINI_ASSIST: "/api/gemini-assist",
    CONVERT_TO_COCO: "/api/convert-to-coco",
  },
}

// API 호출을 위한 헬퍼 함수
export const apiCall = (endpoint: string, options?: RequestInit) => {
  const url = `${API_CONFIG.BASE_URL}${endpoint}`
  return fetch(url, options)
}
