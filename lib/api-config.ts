export const API_CONFIG = {
  // Use relative URLs for production (Next.js will proxy to backend)
  // For development, this will use the rewrite rules in next.config.mjs
  BASE_URL: "", // Empty string to use relative URLs

  // API 엔드포인트들
  ENDPOINTS: {
    IMAGES: "/api/images",
    UPLOAD_IMAGE: "/api/upload-image",
    UPLOAD: "/api/upload",
    GENERATE_POLYGONS: "/api/generate-polygons",
    GENERATE_POLYGONS_WITH_POINTS: "/api/generate-polygons-with-points",
    GEMINI_ASSIST: "/api/gemini-assist",
    CONVERT_TO_COCO: "/api/convert-to-coco",
    ANNOTATIONS: "/api/annotations",
    // Training endpoints
    TRAIN_START: "/api/train-model",
    TRAINING_STATUS: "/api/training/status",
    TRAINING_JOBS: "/api/training/jobs",
  },
}

// API 호출을 위한 헬퍼 함수
export const apiCall = (endpoint: string, options?: RequestInit) => {
  const url = `${API_CONFIG.BASE_URL}${endpoint}`
  return fetch(url, options)
}
