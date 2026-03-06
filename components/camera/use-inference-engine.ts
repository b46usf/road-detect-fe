import { useCallback, useEffect, useRef, useState, type MutableRefObject, type RefObject } from "react"
import {
  CameraInferenceError,
  persistInferenceHistory,
  requestCameraInference
} from "@/components/camera/inference-engine-service"
import {
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
import type { DetectionReport } from "@/lib/roboflow-client"

interface UseInferenceEngineOptions {
  status: CameraStatus
  videoRef: RefObject<HTMLVideoElement | null>
  captureFrame: () => CapturedFrame | null
  modelId: string
  modelVersion: string
  gpsLocation: GpsLocation | null
  isMountedRef: MutableRefObject<boolean>
}

function buildMissingModelError() {
  return {
    message: "Isi Model ID dan Version untuk menjalankan deteksi.",
    code: "MODEL_REQUIRED"
  }
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
        const { message, code } = buildMissingModelError()
        setInferenceError(message)
        setLastApiStatus("error")
        setLastApiMessage(message)
        setLastApiCode(code)
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
        const result = await requestCameraInference({
          frame,
          modelId: normalizedModelId,
          modelVersion: normalizedModelVersion,
          gpsLocation,
          sourceWidth: videoRef.current?.videoWidth ?? frame.width,
          sourceHeight: videoRef.current?.videoHeight ?? frame.height
        })

        if (!isMountedRef.current) {
          return
        }

        setDetections(result.predictions)
        setDetectionFrameSize({ width: result.frameWidth, height: result.frameHeight })
        setInferenceError(null)
        setLastApiStatus("success")
        setLastApiMessage(result.message)
        setLastApiCode(null)
        setLastInferenceDurationMs(result.durationMs)
        setLastDetectionReport(result.report)
        setLastInferenceAt(result.report?.waktuDeteksi ? new Date(result.report.waktuDeteksi) : new Date())

        if (result.report) {
          const savedHistory = persistInferenceHistory({
            report: result.report,
            modelId: normalizedModelId,
            modelVersion: normalizedModelVersion,
            message: result.message,
            durationMs: result.durationMs,
            imageToSend: result.imageToSend,
            frameWidth: result.frameWidth,
            frameHeight: result.frameHeight,
            predictions: result.predictions
          })

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
        setLastApiCode(
          error instanceof CameraInferenceError ? error.code : "INFERENCE_RUNTIME_ERROR"
        )
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
