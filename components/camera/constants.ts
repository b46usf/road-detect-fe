import {
  getClientRoboflowModelId,
  getClientRoboflowModelVersion
} from "@/lib/env/client"

export const SNAPSHOT_INTERVAL_MS = 1000
export const INFERENCE_THROTTLE_MS = 2500
export const MAX_CAPTURE_WIDTH = 640
export const MAX_CAPTURE_HEIGHT = 640
export const CAPTURE_JPEG_QUALITY = 0.72

export const DEFAULT_MODEL_ID = getClientRoboflowModelId()
export const DEFAULT_MODEL_VERSION = getClientRoboflowModelVersion()
export const DEFAULT_CONFIDENCE = 0.2
export const DEFAULT_OVERLAP = 0.3
