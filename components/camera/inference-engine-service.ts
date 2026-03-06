import { appendDetectionHistory, createStoredDetectionRecord } from "@/lib/admin-storage"
import { toFiniteNumber } from "@/lib/common-utils"
import {
  extractApiErrorInfo,
  parseInferenceResponse,
  type DetectionReport
} from "@/lib/roboflow-client"
import { createTrainingAnnotationsFromDetections } from "@/lib/training-annotations"
import { normalizePredictionsToDetections } from "@/lib/roboflow-utils"
import {
  CAPTURE_JPEG_QUALITY,
  DEFAULT_CONFIDENCE,
  DEFAULT_OVERLAP
} from "@/components/camera/constants"
import type { CapturedFrame, DetectionPrediction, GpsLocation } from "@/components/camera/types"

export interface InferenceSuccessPayload {
  predictions: DetectionPrediction[]
  frameWidth: number
  frameHeight: number
  report: DetectionReport | null
  message: string
  durationMs: number | null
  imageToSend: string
}

export class CameraInferenceError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = "CameraInferenceError"
    this.code = code
  }
}

function buildLocationPayload(gpsLocation: GpsLocation | null) {
  if (!gpsLocation) {
    return null
  }

  return {
    latitude: gpsLocation.latitude,
    longitude: gpsLocation.longitude,
    accuracy: gpsLocation.accuracy,
    altitude: gpsLocation.altitude,
    heading: gpsLocation.heading,
    speed: gpsLocation.speed,
    timestamp: gpsLocation.timestamp,
    source: gpsLocation.source
  }
}

export async function requestCameraInference(params: {
  frame: CapturedFrame
  modelId: string
  modelVersion: string
  gpsLocation: GpsLocation | null
  sourceWidth: number
  sourceHeight: number
}): Promise<InferenceSuccessPayload> {
  const { frame, modelId, modelVersion, gpsLocation, sourceWidth, sourceHeight } = params
  const imageToSend = typeof frame.dataUrl === "string" ? frame.dataUrl.trim() : frame.dataUrl

  const response = await fetch("/api/roboflow", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      image: imageToSend,
      modelId,
      modelVersion,
      confidence: DEFAULT_CONFIDENCE,
      overlap: DEFAULT_OVERLAP,
      frameWidth: frame.width,
      frameHeight: frame.height,
      detectedAt: new Date().toISOString(),
      location: buildLocationPayload(gpsLocation),
      evidence: {
        mime: "image/jpeg",
        quality: CAPTURE_JPEG_QUALITY,
        captureWidth: frame.width,
        captureHeight: frame.height,
        sourceWidth,
        sourceHeight
      }
    })
  })

  const responseText = await response.text()
  let payload: unknown = { raw: responseText }

  try {
    payload = JSON.parse(responseText)
  } catch {
    payload = { raw: responseText }
  }

  const parsedError = extractApiErrorInfo(payload)
  if (!response.ok || parsedError) {
    const fallbackMessage = `Request API gagal (HTTP ${response.status}).`
    throw new CameraInferenceError(
      parsedError?.message ?? fallbackMessage,
      parsedError?.code ?? `HTTP_${response.status}`
    )
  }

  const successPayload = parseInferenceResponse(payload)
  const inferenceData = successPayload.data

  return {
    predictions: normalizePredictionsToDetections(inferenceData.predictions),
    frameWidth: toFiniteNumber(inferenceData.image?.width) ?? frame.width,
    frameHeight: toFiniteNumber(inferenceData.image?.height) ?? frame.height,
    report: successPayload.report,
    message: successPayload.message,
    durationMs: successPayload.durationMs,
    imageToSend
  }
}

export function persistInferenceHistory(params: {
  report: DetectionReport
  modelId: string
  modelVersion: string
  message: string
  durationMs: number | null
  imageToSend: string
  frameWidth: number
  frameHeight: number
  predictions: DetectionPrediction[]
}) {
  const { report, modelId, modelVersion, message, durationMs, imageToSend, frameWidth, frameHeight, predictions } = params

  const historyRecord = createStoredDetectionRecord({
    report,
    modelId,
    modelVersion,
    apiMessage: message,
    apiDurationMs: durationMs,
    trainingCandidate: {
      imageDataUrl: imageToSend,
      imageWidth: frameWidth,
      imageHeight: frameHeight,
      annotations: createTrainingAnnotationsFromDetections(predictions)
    }
  })

  return appendDetectionHistory(historyRecord)
}
