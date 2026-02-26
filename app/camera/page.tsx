"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  appendDetectionHistory,
  createSpatialRecord,
  type StoredDetectionRecord
} from "@/lib/admin-storage"
import { classifySeverity, LIGHT_SEVERITY_MAX_PERCENT, MEDIUM_SEVERITY_MAX_PERCENT, type SeverityLevel, type DominantSeverity } from "@/lib/roboflow-utils"
import { toFiniteNumber } from "@/lib/common-utils"
import { formatPercent, severityLabel, dominantSeverityLabel, getSeverityStyles } from "@/lib/ui-utils"
import { extractApiErrorInfo, extractDetectionReport } from "@/lib/roboflow-client"

type CameraStatus = "starting" | "active" | "idle" | "error"
// `SeverityLevel` and `DominantSeverity` come from shared utils
type GpsStatus = "unsupported" | "tracking" | "ready" | "error"

interface CapturedFrame {
  dataUrl: string
  width: number
  height: number
}

interface DetectionPrediction {
  x: number
  y: number
  width: number
  height: number
  label: string
  confidence: number | null
}

interface DetectionWithSeverity extends DetectionPrediction {
  severity: SeverityLevel
  areaPercent: number
}

interface GpsLocation {
  latitude: number
  longitude: number
  accuracy: number | null
  altitude: number | null
  heading: number | null
  speed: number | null
  timestamp: string
  source: string
}

interface DetectionApiReport {
  luasanKerusakan: {
    totalPersentase: number
    totalBoxAreaPx: number
    frameAreaPx: number
  }
  tingkatKerusakan: {
    dominan: DominantSeverity
    jumlah: {
      ringan: number
      sedang: number
      berat: number
      totalDeteksi: number
    }
    distribusiPersentase: {
      ringan: number
      sedang: number
      berat: number
    }
  }
  breakdownKelas: {
    counts: {
      pothole: number
      crack: number
      rutting: number
      lainnya: number
      totalDeteksi: number
    }
    distribusiPersentase: {
      pothole: number
      crack: number
      rutting: number
      lainnya: number
    }
    dominanKelas: string | null
    daftar: Array<{
      label: string
      jumlah: number
      persentaseJumlah: number
      totalPersentaseArea: number
      dominanSeverity: DominantSeverity
    }>
  }
  lokasi: GpsLocation | null
  waktuDeteksi: string
  visualBukti: {
    imageDataUrl: string | null
    mime: string
    quality: number | null
    resolusiCapture: {
      width: number | null
      height: number | null
    }
    resolusiSource: {
      width: number | null
      height: number | null
    }
    isFhdSource: boolean | null
  }
}

interface RoboflowInferenceShape {
  predictions?: unknown
  image?: {
    width?: unknown
    height?: unknown
  }
  report?: unknown
  error?: unknown
  detail?: unknown
}

interface RoboflowApiErrorInfo {
  code: string | null
  message: string
}

interface RenderedDetection extends DetectionWithSeverity {
  id: string
  left: number
  top: number
}

const SNAPSHOT_INTERVAL_MS = 1000
const INFERENCE_THROTTLE_MS = 2500
const MAX_CAPTURE_WIDTH = 640
const MAX_CAPTURE_HEIGHT = 640
const CAPTURE_JPEG_QUALITY = 0.72
// severity thresholds imported from shared utils
const DEFAULT_MODEL_ID = process.env.NEXT_PUBLIC_ROBOFLOW_MODEL_ID ?? "baguss-workspace/yolov8"
const DEFAULT_MODEL_VERSION = process.env.NEXT_PUBLIC_ROBOFLOW_MODEL_VERSION ?? "1"
const DEFAULT_CONFIDENCE = 0.4
const DEFAULT_OVERLAP = 0.3

function mapCameraError(error: unknown): string {
  if (!(error instanceof DOMException)) {
    return "Tidak bisa mengakses kamera. Cek izin kamera di browser."
  }

  switch (error.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Izin kamera ditolak. Aktifkan izin kamera di browser."
    case "NotFoundError":
      return "Kamera tidak ditemukan pada perangkat ini."
    case "NotReadableError":
    case "TrackStartError":
      return "Kamera sedang dipakai aplikasi lain. Tutup aplikasi kamera lain lalu coba lagi."
    case "OverconstrainedError":
      return "Mode kamera belakang tidak tersedia. Coba pakai kamera default."
    case "SecurityError":
      return "Akses kamera diblokir. Gunakan HTTPS atau localhost."
    default:
      return `Gagal mengakses kamera (${error.name}).`
  }
}

function mapGeolocationError(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Izin lokasi ditolak. Aktifkan GPS/location permission di browser."
    case error.POSITION_UNAVAILABLE:
      return "Lokasi tidak tersedia. Pastikan GPS/GNSS aktif."
    case error.TIMEOUT:
      return "Permintaan lokasi timeout. Coba lagi di area dengan sinyal lebih baik."
    default:
      return "Gagal membaca lokasi GPS."
  }
}

// `toFiniteNumber` imported from `lib/common-utils`

// `extractApiErrorInfo` is provided by `lib/roboflow-client`

// `extractDetectionReport` is provided by `lib/roboflow-client`

function extractInferencePayload(payload: unknown): {
  data: RoboflowInferenceShape
  report: DetectionApiReport | null
  message: string
  durationMs: number | null
} {
  if (!payload || typeof payload !== "object") {
    return {
      data: {},
      report: null,
      message: "Deteksi berhasil diproses.",
      durationMs: null
    }
  }

  const source = payload as Record<string, unknown>

  if (source.ok === true) {
    const message =
      typeof source.message === "string" && source.message.trim().length > 0
        ? source.message
        : "Deteksi berhasil diproses."

    const rawData = source.data && typeof source.data === "object" ? (source.data as Record<string, unknown>) : null
    const hasNestedInference = rawData && rawData.inference && typeof rawData.inference === "object"
    const data = hasNestedInference
      ? (rawData?.inference as RoboflowInferenceShape)
      : ((rawData ?? {}) as RoboflowInferenceShape)
    const report = extractDetectionReport(
      hasNestedInference ? rawData?.report : (rawData?.report ?? (rawData as RoboflowInferenceShape).report)
    )
    const durationMs =
      source.meta && typeof source.meta === "object"
        ? toFiniteNumber((source.meta as Record<string, unknown>).durationMs)
        : null

    return { data, report, message, durationMs }
  }

  return {
    data: source as RoboflowInferenceShape,
    report: extractDetectionReport((source as RoboflowInferenceShape).report),
    message: "Deteksi berhasil diproses.",
    durationMs: null
  }
}

function normalizePredictions(rawPredictions: unknown): DetectionPrediction[] {
  if (!Array.isArray(rawPredictions)) {
    return []
  }

  const results: DetectionPrediction[] = []

  for (const item of rawPredictions) {
    if (!item || typeof item !== "object") {
      continue
    }

    const source = item as Record<string, unknown>
    const x = toFiniteNumber(source.x)
    const y = toFiniteNumber(source.y)
    const width = toFiniteNumber(source.width)
    const height = toFiniteNumber(source.height)

    if (x === null || y === null || width === null || height === null || width <= 0 || height <= 0) {
      continue
    }

    const rawLabel = source.class
    const label = typeof rawLabel === "string" && rawLabel.trim().length > 0 ? rawLabel : "objek"

    const rawConfidence = toFiniteNumber(source.confidence)
    const confidence = rawConfidence === null ? null : rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence

    results.push({ x, y, width, height, label, confidence })
  }

  return results
}

function formatConfidence(value: number | null): string | null {
  if (value === null) {
    return null
  }

  return `${Math.max(0, Math.min(100, value)).toFixed(1)}%`
}

// classifySeverity provided by shared utils

// formatPercent, severityLabel, dominantSeverityLabel, getSeverityStyles
// are imported from lib/ui-utils

function buildHistoryRecord(params: {
  report: DetectionApiReport
  modelId: string
  modelVersion: string
  apiMessage: string
  apiDurationMs: number | null
}): StoredDetectionRecord {
  const { report, modelId, modelVersion, apiMessage, apiDurationMs } = params
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const createdAt = new Date().toISOString()
  const location =
    report.lokasi
      ? {
          latitude: report.lokasi.latitude,
          longitude: report.lokasi.longitude,
          accuracy: report.lokasi.accuracy,
          timestamp: report.lokasi.timestamp,
          source: report.lokasi.source
        }
      : null

  return {
    id,
    createdAt,
    modelId,
    modelVersion,
    apiMessage,
    apiDurationMs,
    luasanKerusakanPercent: report.luasanKerusakan.totalPersentase,
    tingkatKerusakan: report.tingkatKerusakan.dominan,
    totalDeteksi: report.tingkatKerusakan.jumlah.totalDeteksi,
    dominantClass: report.breakdownKelas.dominanKelas,
    classCounts: {
      pothole: report.breakdownKelas.counts.pothole,
      crack: report.breakdownKelas.counts.crack,
      rutting: report.breakdownKelas.counts.rutting,
      lainnya: report.breakdownKelas.counts.lainnya,
      totalDeteksi: report.breakdownKelas.counts.totalDeteksi
    },
    classDistribution: {
      pothole: report.breakdownKelas.distribusiPersentase.pothole,
      crack: report.breakdownKelas.distribusiPersentase.crack,
      rutting: report.breakdownKelas.distribusiPersentase.rutting,
      lainnya: report.breakdownKelas.distribusiPersentase.lainnya
    },
    lokasi: location,
    waktuDeteksi: report.waktuDeteksi,
    visualBukti: {
      mime: report.visualBukti.mime,
      quality: report.visualBukti.quality,
      captureWidth: report.visualBukti.resolusiCapture.width,
      captureHeight: report.visualBukti.resolusiCapture.height,
      sourceWidth: report.visualBukti.resolusiSource.width,
      sourceHeight: report.visualBukti.resolusiSource.height,
      isFhdSource: report.visualBukti.isFhdSource
    },
    spatial: createSpatialRecord({
      id,
      createdAt,
      waktuDeteksi: report.waktuDeteksi,
      tingkatKerusakan: report.tingkatKerusakan.dominan,
      luasanKerusakanPercent: report.luasanKerusakan.totalPersentase,
      dominantClass: report.breakdownKelas.dominanKelas,
      modelId,
      modelVersion,
      lokasi: location
    })
  }
}

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mountedRef = useRef(false)
  const inferencingRef = useRef(false)
  const lastInferenceRequestAtRef = useRef(0)

  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<CameraStatus>("starting")
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null)
  const [lastSnapshotAt, setLastSnapshotAt] = useState<Date | null>(null)
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID)
  const [modelVersion, setModelVersion] = useState(DEFAULT_MODEL_VERSION)
  const [detections, setDetections] = useState<DetectionPrediction[]>([])
  const [detectionFrameSize, setDetectionFrameSize] = useState<{ width: number; height: number } | null>(null)
  const [inferenceError, setInferenceError] = useState<string | null>(null)
  const [lastApiStatus, setLastApiStatus] = useState<"idle" | "success" | "error">("idle")
  const [lastApiMessage, setLastApiMessage] = useState<string | null>(null)
  const [lastApiCode, setLastApiCode] = useState<string | null>(null)
  const [isInferencing, setIsInferencing] = useState(false)
  const [lastInferenceAt, setLastInferenceAt] = useState<Date | null>(null)
  const [lastInferenceDurationMs, setLastInferenceDurationMs] = useState<number | null>(null)
  const [lastDetectionReport, setLastDetectionReport] = useState<DetectionApiReport | null>(null)
  const [storageMessage, setStorageMessage] = useState<string | null>(null)
  const [lastStoredAt, setLastStoredAt] = useState<Date | null>(null)
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("tracking")
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [gpsLocation, setGpsLocation] = useState<GpsLocation | null>(null)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })

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

  const captureFrame = useCallback((): CapturedFrame | null => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      return null
    }

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return null
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas")
    }

    const scale = Math.min(1, MAX_CAPTURE_WIDTH / video.videoWidth, MAX_CAPTURE_HEIGHT / video.videoHeight)
    const captureWidth = Math.max(1, Math.round(video.videoWidth * scale))
    const captureHeight = Math.max(1, Math.round(video.videoHeight * scale))

    const canvas = canvasRef.current
    canvas.width = captureWidth
    canvas.height = captureHeight

    const context = canvas.getContext("2d")
    if (!context) {
      return null
    }

    context.drawImage(video, 0, 0, captureWidth, captureHeight)

    const dataUrl = canvas.toDataURL("image/jpeg", CAPTURE_JPEG_QUALITY)
    setSnapshotUrl(dataUrl)
    setLastSnapshotAt(new Date())

    return { dataUrl, width: captureWidth, height: captureHeight }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    setStatus("starting")
    setError(null)
    setSnapshotUrl(null)
    setLastSnapshotAt(null)
    resetInferenceState()
    stopCamera()

    if (!window.isSecureContext) {
      setError("Halaman tidak aman. Kamera hanya bisa diakses lewat HTTPS atau localhost.")
      setStatus("error")
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Browser tidak mendukung akses kamera (getUserMedia).")
      setStatus("error")
      return
    }

    try {
      let stream: MediaStream

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false
        })
      } catch (err) {
        if (
          err instanceof DOMException &&
          (err.name === "OverconstrainedError" || err.name === "NotFoundError")
        ) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          })
        } else {
          throw err
        }
      }

      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }

      setStatus("active")
    } catch (err) {
      if (!mountedRef.current) {
        return
      }

      setError(mapCameraError(err))
      setStatus("error")
    }
  }, [resetInferenceState, stopCamera])

  const handleStopCamera = useCallback(() => {
    stopCamera()
    setError(null)
    setStatus("idle")
    resetInferenceState()
  }, [resetInferenceState, stopCamera])

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

        const response = await fetch("/api/roboflow", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            image: frame.dataUrl,
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
          if (!mountedRef.current) {
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

        const successPayload = extractInferencePayload(payload)
        const inferenceData = successPayload.data
        const report = successPayload.report

        const parsedPredictions = normalizePredictions(inferenceData.predictions)

        const inferenceWidth = toFiniteNumber(inferenceData.image?.width) ?? frame.width
        const inferenceHeight = toFiniteNumber(inferenceData.image?.height) ?? frame.height

        if (!mountedRef.current) {
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
        setLastInferenceAt(
          report && report.waktuDeteksi ? new Date(report.waktuDeteksi) : new Date()
        )

        if (report) {
          const historyRecord = buildHistoryRecord({
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
      } catch (inferError) {
        if (!mountedRef.current) {
          return
        }

        const message =
          inferError instanceof Error && inferError.message.trim().length > 0
            ? inferError.message
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
        if (mountedRef.current) {
          setIsInferencing(false)
        }
      }
    },
    [gpsLocation, modelId, modelVersion]
  )

  const handleDownloadSnapshot = useCallback(() => {
    if (!snapshotUrl) {
      return
    }

    const captureTime = lastSnapshotAt ?? new Date()
    const datePart = [
      captureTime.getFullYear(),
      String(captureTime.getMonth() + 1).padStart(2, "0"),
      String(captureTime.getDate()).padStart(2, "0")
    ].join("")
    const timePart = [
      String(captureTime.getHours()).padStart(2, "0"),
      String(captureTime.getMinutes()).padStart(2, "0"),
      String(captureTime.getSeconds()).padStart(2, "0")
    ].join("")

    const anchor = document.createElement("a")
    anchor.href = snapshotUrl
    anchor.download = `snapshot-jalan-${datePart}-${timePart}.jpg`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  }, [lastSnapshotAt, snapshotUrl])

  useEffect(() => {
    mountedRef.current = true
    startCamera()

    return () => {
      mountedRef.current = false
      stopCamera()
    }
  }, [startCamera, stopCamera])

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsStatus("unsupported")
      setGpsError("Browser tidak mendukung geolokasi GPS.")
      return
    }

    setGpsStatus("tracking")
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coords = position.coords
        setGpsLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: Number.isFinite(coords.accuracy) ? coords.accuracy : null,
          altitude: Number.isFinite(coords.altitude) ? coords.altitude : null,
          heading: Number.isFinite(coords.heading) ? coords.heading : null,
          speed: Number.isFinite(coords.speed) ? coords.speed : null,
          timestamp: new Date(position.timestamp).toISOString(),
          source: "gnss"
        })
        setGpsStatus("ready")
        setGpsError(null)
      },
      (error) => {
        setGpsStatus("error")
        setGpsError(mapGeolocationError(error))
      },
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 3_000
      }
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [])

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

  useEffect(() => {
    const node = viewportRef.current
    if (!node) {
      return
    }

    const updateSize = () => {
      setViewportSize({
        width: node.clientWidth,
        height: node.clientHeight
      })
    }

    updateSize()

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateSize)
      return () => {
        window.removeEventListener("resize", updateSize)
      }
    }

    const observer = new ResizeObserver(updateSize)
    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [])

  const severityAssessment = useMemo(() => {
    const emptyResult = {
      items: [] as DetectionWithSeverity[],
      totalDamagePercent: 0,
      counts: { ringan: 0, sedang: 0, berat: 0 },
      distributionPercent: { ringan: 0, sedang: 0, berat: 0 },
      dominantSeverity: null as SeverityLevel | null
    }

    if (!detectionFrameSize || detections.length === 0) {
      return emptyResult
    }

    const frameArea = detectionFrameSize.width * detectionFrameSize.height
    if (!Number.isFinite(frameArea) || frameArea <= 0) {
      return emptyResult
    }

    const items = detections.map((prediction) => {
      const areaPercent = Math.max(0, (prediction.width * prediction.height * 100) / frameArea)
      const severity = classifySeverity(areaPercent)
      return {
        ...prediction,
        areaPercent,
        severity
      }
    })

    const counts = { ringan: 0, sedang: 0, berat: 0 }
    const areaBySeverity = { ringan: 0, sedang: 0, berat: 0 }
    let totalAreaPercent = 0

    for (const item of items) {
      counts[item.severity] += 1
      areaBySeverity[item.severity] += item.areaPercent
      totalAreaPercent += item.areaPercent
    }

    const totalDamagePercent = Math.min(100, totalAreaPercent)
    const distributionBase = Math.max(0.0001, areaBySeverity.ringan + areaBySeverity.sedang + areaBySeverity.berat)
    const distributionPercent = {
      ringan: (areaBySeverity.ringan * 100) / distributionBase,
      sedang: (areaBySeverity.sedang * 100) / distributionBase,
      berat: (areaBySeverity.berat * 100) / distributionBase
    }

    const dominantSeverity: SeverityLevel =
      areaBySeverity.berat >= areaBySeverity.sedang && areaBySeverity.berat >= areaBySeverity.ringan
        ? "berat"
        : areaBySeverity.sedang >= areaBySeverity.ringan
          ? "sedang"
          : "ringan"

    return {
      items,
      totalDamagePercent,
      counts,
      distributionPercent,
      dominantSeverity: items.length > 0 ? dominantSeverity : null
    }
  }, [detectionFrameSize, detections])

  const renderedDetections = useMemo<RenderedDetection[]>(() => {
    if (!detectionFrameSize || viewportSize.width === 0 || viewportSize.height === 0) {
      return []
    }

    const { width: sourceWidth, height: sourceHeight } = detectionFrameSize
    const { width: targetWidth, height: targetHeight } = viewportSize

    if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
      return []
    }

    const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight)
    const renderedWidth = sourceWidth * scale
    const renderedHeight = sourceHeight * scale
    const offsetX = (targetWidth - renderedWidth) / 2
    const offsetY = (targetHeight - renderedHeight) / 2

    return severityAssessment.items
      .map((prediction, index) => {
        const rawLeft = (prediction.x - prediction.width / 2) * scale + offsetX
        const rawTop = (prediction.y - prediction.height / 2) * scale + offsetY
        const rawRight = rawLeft + prediction.width * scale
        const rawBottom = rawTop + prediction.height * scale

        const left = Math.max(0, rawLeft)
        const top = Math.max(0, rawTop)
        const right = Math.min(targetWidth, rawRight)
        const bottom = Math.min(targetHeight, rawBottom)
        const width = Math.max(0, right - left)
        const height = Math.max(0, bottom - top)

        if (width === 0 || height === 0) {
          return null
        }

        return {
          ...prediction,
          id: `${prediction.label}-${index}-${Math.round(prediction.x)}-${Math.round(prediction.y)}`,
          left,
          top,
          width,
          height
        }
      })
      .filter((item): item is RenderedDetection => item !== null)
  }, [detectionFrameSize, severityAssessment.items, viewportSize])

  const statusTone =
    status === "active"
      ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
      : status === "error"
        ? "border-rose-300/40 bg-rose-400/15 text-rose-100"
        : status === "idle"
          ? "border-amber-300/40 bg-amber-400/15 text-amber-100"
          : "border-cyan-300/40 bg-cyan-400/15 text-cyan-100"

  const statusLabel =
    status === "active"
      ? "Kamera Aktif"
      : status === "error"
        ? "Perlu Tindakan"
        : status === "idle"
          ? "Kamera Berhenti"
          : "Memulai Kamera"

  const inferenceStatusLabel = isInferencing
    ? "Mendeteksi..."
    : `Objek: ${renderedDetections.length}`

  const apiStatusTone =
    lastApiStatus === "success"
      ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
      : lastApiStatus === "error"
        ? "border-rose-300/40 bg-rose-400/15 text-rose-100"
        : "border-slate-300/30 bg-slate-300/10 text-slate-200"

  const apiStatusLabel =
    lastApiStatus === "success"
      ? "API Sukses"
      : lastApiStatus === "error"
        ? "API Error"
        : "API Menunggu"

  const gpsTone =
    gpsStatus === "ready"
      ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
      : gpsStatus === "error"
        ? "border-rose-300/40 bg-rose-400/15 text-rose-100"
        : gpsStatus === "unsupported"
          ? "border-amber-300/40 bg-amber-400/15 text-amber-100"
          : "border-cyan-300/40 bg-cyan-400/15 text-cyan-100"

  const gpsLabel =
    gpsStatus === "ready"
      ? "GPS Ready"
      : gpsStatus === "error"
        ? "GPS Error"
        : gpsStatus === "unsupported"
          ? "GPS Unsupported"
          : "GPS Tracking"

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100 [font-family:var(--font-geist-sans)]">
      <div className="pointer-events-none absolute -left-16 top-10 h-56 w-56 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-0 h-56 w-56 rounded-full bg-emerald-500/20 blur-3xl" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
        <header className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/90">Live Detection</p>
              <h1 className="mt-1 text-xl font-semibold sm:text-2xl">Deteksi Jalan Realtime</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Snapshot diambil tiap 1 detik. Inference di-throttle tiap 2.5 detik dengan frame yang sudah di-resize agar quota Roboflow lebih awet.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusTone}`}>
                {statusLabel}
              </span>
              <span className="rounded-full border border-cyan-300/40 bg-cyan-400/15 px-3 py-1 text-xs font-medium text-cyan-100">
                {inferenceStatusLabel}
              </span>
              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${apiStatusTone}`}>
                {apiStatusLabel}
              </span>
              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${gpsTone}`}>
                {gpsLabel}
              </span>
              <Link
                href="/"
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-medium text-slate-100 transition hover:bg-white/10"
              >
                Kembali
              </Link>
              <Link
                href="/admin/dashboard"
                className="rounded-lg border border-cyan-300/35 bg-cyan-400/15 px-3 py-2 text-xs font-medium text-cyan-100 transition hover:bg-cyan-400/25"
              >
                Dashboard Admin
              </Link>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" value={modelId} />
            <input type="hidden" value={modelVersion} />
          </div>
        </header>

        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
          <div ref={viewportRef} className="relative aspect-[9/16] w-full md:aspect-[16/9]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />

            {renderedDetections.length > 0 && (
              <div className="pointer-events-none absolute inset-0">
                {renderedDetections.map((prediction) => {
                  const styles = getSeverityStyles(prediction.severity)
                  return (
                  <div
                    key={prediction.id}
                    className={`absolute rounded-md border-2 shadow-[0_0_0_1px_rgba(0,0,0,0.4)] ${styles.boxClass}`}
                    style={{
                      left: `${prediction.left}px`,
                      top: `${prediction.top}px`,
                      width: `${prediction.width}px`,
                      height: `${prediction.height}px`
                    }}
                  >
                    <span className={`absolute -top-6 left-0 rounded px-2 py-0.5 text-[10px] font-semibold ${styles.labelClass}`}>
                      {prediction.label}
                      {formatConfidence(prediction.confidence) ? ` ${formatConfidence(prediction.confidence)}` : ""}
                      {` | ${severityLabel(prediction.severity)} ${formatPercent(prediction.areaPercent)}`}
                    </span>
                  </div>
                  )
                })}
              </div>
            )}

            {status === "starting" && (
              <div className="absolute inset-0 grid place-items-center bg-slate-950/70">
                <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
                  Memulai kamera...
                </div>
              </div>
            )}

            {status === "idle" && (
              <div className="absolute inset-0 grid place-items-center bg-slate-950/75 p-4">
                <div className="rounded-xl border border-white/15 bg-black/45 px-4 py-3 text-center text-sm text-slate-200">
                  Kamera sedang tidak aktif.
                </div>
              </div>
            )}

            {status === "error" && error && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 p-4">
                <div className="max-w-md rounded-2xl border border-rose-300/35 bg-rose-950/45 p-5 text-center">
                  <p className="text-sm leading-relaxed text-rose-100">{error}</p>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="mt-4 rounded-lg bg-rose-300 px-4 py-2 text-sm font-semibold text-rose-950 transition hover:bg-rose-200"
                  >
                    Coba Lagi
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold sm:text-base">Snapshot Frame</h2>
              <span className="text-xs text-slate-400">Auto update ~1 detik (inferensi ~2.5 detik)</span>
            </div>

            <button
              type="button"
              onClick={handleDownloadSnapshot}
              disabled={!snapshotUrl}
              className="rounded-lg bg-emerald-300 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-slate-700"
            >
              Simpan Snapshot
            </button>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/60">
            <div className="relative aspect-[16/9] w-full">
              {snapshotUrl ? (
                <img
                  src={snapshotUrl}
                  alt="Snapshot frame dari video kamera"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full place-items-center p-4 text-sm text-slate-400">
                  Menunggu frame dari kamera...
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <article className="rounded-xl border border-white/10 bg-black/35 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Estimasi Kerusakan</p>
              <p className="mt-1 text-lg font-semibold text-slate-100">
                {formatPercent(severityAssessment.totalDamagePercent)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {severityAssessment.dominantSeverity
                  ? `Dominan: ${severityLabel(severityAssessment.dominantSeverity)}`
                  : "Menunggu hasil deteksi."}
              </p>
            </article>

            <article className="rounded-xl border border-white/10 bg-black/35 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Distribusi Severity</p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded-lg border border-emerald-300/35 bg-emerald-400/10 p-2 text-center">
                  <p className="font-semibold text-emerald-200">Ringan</p>
                  <p className="text-emerald-100">{formatPercent(severityAssessment.distributionPercent.ringan)}</p>
                  <p className="text-emerald-200/80">{severityAssessment.counts.ringan} box</p>
                </div>
                <div className="rounded-lg border border-amber-300/35 bg-amber-400/10 p-2 text-center">
                  <p className="font-semibold text-amber-200">Sedang</p>
                  <p className="text-amber-100">{formatPercent(severityAssessment.distributionPercent.sedang)}</p>
                  <p className="text-amber-200/80">{severityAssessment.counts.sedang} box</p>
                </div>
                <div className="rounded-lg border border-rose-300/35 bg-rose-400/10 p-2 text-center">
                  <p className="font-semibold text-rose-200">Berat</p>
                  <p className="text-rose-100">{formatPercent(severityAssessment.distributionPercent.berat)}</p>
                  <p className="text-rose-200/80">{severityAssessment.counts.berat} box</p>
                </div>
              </div>
            </article>
          </div>

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <article className="rounded-xl border border-white/10 bg-black/35 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Lokasi Realtime (GPS/GNSS)</p>
              {gpsLocation ? (
                <>
                  <p className="mt-1 text-sm font-semibold text-slate-100">
                    {gpsLocation.latitude.toFixed(6)}, {gpsLocation.longitude.toFixed(6)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Akurasi: {gpsLocation.accuracy !== null ? `${Math.round(gpsLocation.accuracy)} m` : "n/a"}
                  </p>
                  <p className="text-xs text-slate-400">
                    Update: {new Date(gpsLocation.timestamp).toLocaleTimeString("id-ID")}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-xs text-slate-400">Menunggu data GPS...</p>
              )}
              {gpsError && <p className="mt-2 text-xs text-rose-300">{gpsError}</p>}
            </article>

            <article className="rounded-xl border border-white/10 bg-black/35 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Ringkasan Response API</p>
              <p className="mt-1 text-xs text-slate-300">
                Luasan:{" "}
                {lastDetectionReport
                  ? formatPercent(lastDetectionReport.luasanKerusakan.totalPersentase)
                  : "n/a"}
              </p>
              <p className="text-xs text-slate-300">
                Level:{" "}
                {lastDetectionReport
                  ? dominantSeverityLabel(lastDetectionReport.tingkatKerusakan.dominan)
                  : "n/a"}
              </p>
              <p className="text-xs text-slate-300">
                Kelas dominan:{" "}
                {lastDetectionReport?.breakdownKelas.dominanKelas
                  ? lastDetectionReport.breakdownKelas.dominanKelas
                  : "n/a"}
              </p>
              <p className="text-xs text-slate-300">
                Multi-class:{" "}
                {lastDetectionReport
                  ? `pothole ${lastDetectionReport.breakdownKelas.counts.pothole}, crack ${lastDetectionReport.breakdownKelas.counts.crack}, rutting ${lastDetectionReport.breakdownKelas.counts.rutting}, lainnya ${lastDetectionReport.breakdownKelas.counts.lainnya}`
                  : "n/a"}
              </p>
              <p className="text-xs text-slate-300">
                Distribusi kelas:{" "}
                {lastDetectionReport
                  ? `pothole ${formatPercent(lastDetectionReport.breakdownKelas.distribusiPersentase.pothole)}, crack ${formatPercent(lastDetectionReport.breakdownKelas.distribusiPersentase.crack)}, rutting ${formatPercent(lastDetectionReport.breakdownKelas.distribusiPersentase.rutting)}`
                  : "n/a"}
              </p>
              <p className="text-xs text-slate-300">
                Waktu:{" "}
                {lastDetectionReport
                  ? new Date(lastDetectionReport.waktuDeteksi).toLocaleString("id-ID")
                  : "n/a"}
              </p>
              <p className="text-xs text-slate-300">
                Lokasi:{" "}
                {lastDetectionReport?.lokasi
                  ? `${lastDetectionReport.lokasi.latitude.toFixed(6)}, ${lastDetectionReport.lokasi.longitude.toFixed(6)}`
                  : "n/a"}
              </p>
              <p className="text-xs text-slate-300">
                Visual:{" "}
                {lastDetectionReport
                  ? `${lastDetectionReport.visualBukti.resolusiCapture.width ?? "?"}x${lastDetectionReport.visualBukti.resolusiCapture.height ?? "?"} | Source FHD: ${
                      lastDetectionReport.visualBukti.isFhdSource ? "Ya" : "Tidak"
                    }`
                  : "n/a"}
              </p>
              {lastDetectionReport && lastDetectionReport.breakdownKelas.daftar.length > 0 && (
                <div className="mt-2 rounded-md border border-white/10 bg-black/40 p-2">
                  <p className="text-[11px] font-semibold text-slate-300">Detail Kelas (Top 5)</p>
                  {lastDetectionReport.breakdownKelas.daftar.slice(0, 5).map((item) => (
                    <p key={item.label} className="text-[11px] text-slate-400">
                      {`${item.label}: ${item.jumlah} box | ${formatPercent(item.persentaseJumlah)} | ${dominantSeverityLabel(item.dominanSeverity)}`}
                    </p>
                  ))}
                </div>
              )}
              {lastDetectionReport?.visualBukti.imageDataUrl && (
                <img
                  src={lastDetectionReport.visualBukti.imageDataUrl}
                  alt="Visual bukti dari response API"
                  className="mt-2 h-20 w-full rounded-md object-cover"
                />
              )}
            </article>
          </div>

          <p className="mt-2 text-[11px] text-slate-500">
            Ambang severity: Ringan &lt; {LIGHT_SEVERITY_MAX_PERCENT}% area frame, Sedang &lt; {MEDIUM_SEVERITY_MAX_PERCENT}%, Berat di atasnya.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <p>
              {lastSnapshotAt
                ? `Snapshot: ${lastSnapshotAt.toLocaleTimeString("id-ID")}`
                : "Snapshot akan tampil setelah video aktif."}
            </p>
            <p>
              {lastInferenceAt
                ? `Inferensi: ${lastInferenceAt.toLocaleTimeString("id-ID")}`
                : "Inferensi menunggu frame pertama."}
            </p>
            <p>
              {lastInferenceDurationMs !== null
                ? `Durasi API: ${Math.round(lastInferenceDurationMs)} ms`
                : "Durasi API belum tersedia."}
            </p>
            <p>
              {`Resize: maks ${MAX_CAPTURE_WIDTH}x${MAX_CAPTURE_HEIGHT}, JPEG ${CAPTURE_JPEG_QUALITY}`}
            </p>
            <p>
              {lastStoredAt
                ? `LocalStorage: ${lastStoredAt.toLocaleTimeString("id-ID")}`
                : "LocalStorage: belum ada data tersimpan."}
            </p>
          </div>

          {lastApiStatus === "success" && lastApiMessage && (
            <p className="mt-2 text-xs text-emerald-300">{lastApiMessage}</p>
          )}
          {storageMessage && (
            <p
              className={`mt-1 text-xs ${
                storageMessage.toLowerCase().includes("tersimpan")
                  ? "text-cyan-300"
                  : "text-amber-300"
              }`}
            >
              {storageMessage}
            </p>
          )}

          {inferenceError && <p className="mt-2 text-xs text-rose-300">{inferenceError}</p>}
          {lastApiStatus === "error" && lastApiCode && (
            <p className="mt-1 text-xs text-rose-300/80">Kode error: {lastApiCode}</p>
          )}
        </div>

        <footer className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:p-5">
          <div className="grid gap-2 text-sm text-slate-300 md:grid-cols-3">
            <p>1. Pastikan browser sudah mendapat izin kamera.</p>
            <p>2. Aktifkan izin lokasi agar GPS/GNSS ikut terkirim ke payload.</p>
            <p>3. Inference di-throttle + resize frame untuk hemat quota.</p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startCamera}
              className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Muat Ulang Kamera
            </button>
            <button
              type="button"
              onClick={handleStopCamera}
              className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
            >
              Matikan Kamera
            </button>
          </div>
        </footer>
      </section>
    </main>
  )
}
