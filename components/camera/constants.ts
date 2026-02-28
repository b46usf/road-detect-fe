export const SNAPSHOT_INTERVAL_MS = 1000
export const INFERENCE_THROTTLE_MS = 2500
export const MAX_CAPTURE_WIDTH = 640
export const MAX_CAPTURE_HEIGHT = 640
export const CAPTURE_JPEG_QUALITY = 0.72

export const DEFAULT_MODEL_ID = process.env.NEXT_PUBLIC_ROBOFLOW_MODEL_ID ?? "road-damage-ai"
export const DEFAULT_MODEL_VERSION = process.env.NEXT_PUBLIC_ROBOFLOW_MODEL_VERSION ?? "8"
export const DEFAULT_CONFIDENCE = 0.4
export const DEFAULT_OVERLAP = 0.3
