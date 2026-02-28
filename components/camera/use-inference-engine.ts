import { useCallback, useEffect, useRef, useState, type MutableRefObject, type RefObject } from "react"
import { appendDetectionHistory, createStoredDetectionRecord } from "@/lib/admin-storage"
import { toFiniteNumber } from "@/lib/common-utils"
import {
  extractApiErrorInfo,
  parseInferenceResponse,
  type DetectionReport
} from "@/lib/roboflow-client"
import { normalizePredictionsToDetections } from "@/lib/roboflow-utils"
import {
  CAPTURE_JPEG_QUALITY,
  DEFAULT_CONFIDENCE,
  DEFAULT_OVERLAP,
  INFERENCE_THROTTLE_MS,
  SNAPSHOT_INTERVAL_MS
} from "./constants"
import type {
  ApiStatus,
  CameraStatus,
  CapturedFrame,
  DetectionPrediction,
  GpsLocation
} from "./types"

interface UseInferenceEngineOptions {
  status: CameraStatus
  videoRef: RefObject<HTMLVideoElement | null>
  captureFrame: () => CapturedFrame | null
  modelId: string
  modelVersion: string
  gpsLocation: GpsLocation | null
  isMountedRef: MutableRefObject<boolean>
}

export function useInferenceEngine(options: UseInferenceEngineOptions) {
  const { status, videoRef, captureFrame, modelId, modelVersion, gpsLocation, isMountedRef } = options

  const inferencingRef = useRef(false)
  const lastInferenceRequestAtRef = useRef(0)

  const [detections, setDetections] = useState<DetectionPrediction[]>([])
  const [detectionFrameSize, setDetectionFrameSize] = useState<{ width: number; height: number } | null>(
    null
  )
  const [inferenceError, setInferenceError] = useState<string | null>(null)
  const [lastApiStatus, setLastApiStatus] = useState<ApiStatus>("idle")
  const [lastApiMessage, setLastApiMessage] = useState<string | null>(null)
  const [lastApiCode, setLastApiCode] = useState<string | null>(null)
  const [isInferencing, setIsInferencing] = useState(false)
  const [lastInferenceAt, setLastInferenceAt] = useState<Date | null>(null)
  const [lastInferenceDurationMs, setLastInferenceDurationMs] = useState<number | null>(null)
  const [lastDetectionReport, setLastDetectionReport] = useState<DetectionReport | null>(null)
  const [storageMessage, setStorageMessage] = useState<string | null>(null)
  const [lastStoredAt, setLastStoredAt] = useState<Date | null>(null)

  const resetInferenceState = useCallback(() => {
    inferencingRef.current = false
    lastInferenceRequestAtRef.current = 0

    setIsInferencing(false)
    setInferenceError(null)
    setDetections([])
    setDetectionFrameSize(null)
    setLastInferenceAt(null)
    setLastApiStatus("idle")
    setLastApiMessage(null)
    setLastApiCode(null)
    setLastInferenceDurationMs(null)
    setLastDetectionReport(null)
    setStorageMessage(null)
    setLastStoredAt(null)
  }, [])

  const runInference = useCallback(
    async (frame: CapturedFrame) => {
      const normalizedModelId = modelId.trim()
      const normalizedModelVersion = modelVersion.trim()

      if (!normalizedModelId || !normalizedModelVersion) {
        const message = "Isi Model ID dan Version untuk menjalankan deteksi."
        setInferenceError(message)
        setLastApiStatus("error")
        setLastApiMessage(message)
        setLastApiCode("MODEL_REQUIRED")
        setDetections([])
        setDetectionFrameSize({ width: frame.width, height: frame.height })
        setLastInferenceDurationMs(null)
        setLastDetectionReport(null)
        return
      }

      if (inferencingRef.current) {
        return
      }

      inferencingRef.current = true
      setIsInferencing(true)
      setInferenceError(null)

      try {
        const detectedAt = new Date().toISOString()
        const sourceWidth = videoRef.current?.videoWidth ?? frame.width
        const sourceHeight = videoRef.current?.videoHeight ?? frame.height
        const imageToSend = typeof frame.dataUrl === "string" ? frame.dataUrl.trim() : frame.dataUrl

        const response = await fetch("/api/roboflow", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            image: imageToSend,
            modelId: normalizedModelId,
            modelVersion: normalizedModelVersion,
            confidence: DEFAULT_CONFIDENCE,
            overlap: DEFAULT_OVERLAP,
            frameWidth: frame.width,
            frameHeight: frame.height,
            detectedAt,
            location: gpsLocation
              ? {
                  latitude: gpsLocation.latitude,
                  longitude: gpsLocation.longitude,
                  accuracy: gpsLocation.accuracy,
                  altitude: gpsLocation.altitude,
                  heading: gpsLocation.heading,
                  speed: gpsLocation.speed,
                  timestamp: gpsLocation.timestamp,
                  source: gpsLocation.source
                }
              : null,
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
          if (!isMountedRef.current) {
            return
          }

          const fallbackMessage = `Request API gagal (HTTP ${response.status}).`
          const message = parsedError?.message ?? fallbackMessage

          setInferenceError(message)
          setLastApiStatus("error")
          setLastApiMessage(message)
          setLastApiCode(parsedError?.code ?? `HTTP_${response.status}`)
          setLastInferenceDurationMs(null)
          setDetections([])
          setDetectionFrameSize({ width: frame.width, height: frame.height })
          setLastDetectionReport(null)
          return
        }

        const successPayload = parseInferenceResponse(payload)
        const inferenceData = successPayload.data
        const report = successPayload.report

        const parsedPredictions = normalizePredictionsToDetections(inferenceData.predictions)
        const inferenceWidth = toFiniteNumber(inferenceData.image?.width) ?? frame.width
        const inferenceHeight = toFiniteNumber(inferenceData.image?.height) ?? frame.height

        if (!isMountedRef.current) {
          return
        }

        setDetections(parsedPredictions)
        setDetectionFrameSize({ width: inferenceWidth, height: inferenceHeight })
        setInferenceError(null)
        setLastApiStatus("success")
        setLastApiMessage(successPayload.message)
        setLastApiCode(null)
        setLastInferenceDurationMs(successPayload.durationMs)
        setLastDetectionReport(report)
        setLastInferenceAt(report?.waktuDeteksi ? new Date(report.waktuDeteksi) : new Date())

        if (report) {
          const historyRecord = createStoredDetectionRecord({
            report,
            modelId: normalizedModelId,
            modelVersion: normalizedModelVersion,
            apiMessage: successPayload.message,
            apiDurationMs: successPayload.durationMs
          })
          const savedHistory = appendDetectionHistory(historyRecord)

          if (savedHistory.ok) {
            setStorageMessage(`Riwayat admin tersimpan (${savedHistory.total} data).`)
            setLastStoredAt(new Date())
          } else {
            setStorageMessage(savedHistory.message)
            setLastStoredAt(null)
          }
        } else {
          setStorageMessage("Response sukses tanpa report. Riwayat tidak disimpan.")
          setLastStoredAt(null)
        }
      } catch (error) {
        if (!isMountedRef.current) {
          return
        }

        const message =
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : "Gagal memproses deteksi realtime."

        setInferenceError(message)
        setLastApiStatus("error")
        setLastApiMessage(message)
        setLastApiCode("INFERENCE_RUNTIME_ERROR")
        setLastInferenceDurationMs(null)
        setDetections([])
        setLastDetectionReport(null)
      } finally {
        inferencingRef.current = false
        if (isMountedRef.current) {
          setIsInferencing(false)
        }
      }
    },
    [gpsLocation, isMountedRef, modelId, modelVersion, videoRef]
  )

  useEffect(() => {
    if (status !== "active") {
      return
    }

    let canceled = false

    const processFrame = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return
      }

      const frame = captureFrame()
      if (!frame || canceled) {
        return
      }

      const now = Date.now()
      if (now - lastInferenceRequestAtRef.current < INFERENCE_THROTTLE_MS) {
        return
      }

      lastInferenceRequestAtRef.current = now
      await runInference(frame)
    }

    void processFrame()

    const intervalId = window.setInterval(() => {
      void processFrame()
    }, SNAPSHOT_INTERVAL_MS)

    return () => {
      canceled = true
      window.clearInterval(intervalId)
    }
  }, [captureFrame, runInference, status])

  return {
    detections,
    detectionFrameSize,
    inferenceError,
    lastApiStatus,
    lastApiMessage,
    lastApiCode,
    isInferencing,
    lastInferenceAt,
    lastInferenceDurationMs,
    lastDetectionReport,
    storageMessage,
    lastStoredAt,
    resetInferenceState
  }
}
