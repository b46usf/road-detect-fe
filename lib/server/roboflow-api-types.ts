import type { parseLocation } from "@/lib/common-utils"
import type { ResolvedRoboflowEndpoint } from "@/lib/server/roboflow-endpoint"
import type { TrainingPipelineState } from "@/lib/server/training-pipeline-state"

export interface InferRequestBody {
  image?: unknown
  modelId?: unknown
  modelVersion?: unknown
  confidence?: unknown
  overlap?: unknown
  frameWidth?: unknown
  frameHeight?: unknown
  detectedAt?: unknown
  location?: unknown
  evidence?: unknown
}

export interface ParsedRoboflowInferenceRequest {
  imageInput: string
  cleanedBase64: string
  modelId: string
  requestedModelVersion: string
  confidence: string | null
  overlap: string | null
  detectedAt: string
  requestLocation: ReturnType<typeof parseLocation>
  requestFrameWidth: number | null
  requestFrameHeight: number | null
  evidence: unknown
}

export interface ExecutedRoboflowInference {
  pipelineState: TrainingPipelineState
  resolvedEndpoint: ResolvedRoboflowEndpoint
  modelId: string
  modelVersion: string
  upstreamData: Record<string, unknown>
}

export class RoboflowRouteError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = "RoboflowRouteError"
    this.status = status
    this.code = code
    this.details = details
  }
}

export function isRoboflowRouteError(error: unknown): error is RoboflowRouteError {
  return error instanceof RoboflowRouteError
}
