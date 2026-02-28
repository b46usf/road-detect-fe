import { useCallback, useEffect, useRef, useState } from "react"
import {
  CAPTURE_JPEG_QUALITY,
  MAX_CAPTURE_HEIGHT,
  MAX_CAPTURE_WIDTH
} from "./constants"
import { mapCameraError } from "./camera-utils"
import type { CameraStatus, CapturedFrame } from "./types"

interface UseCameraDeviceOptions {
  onResetInference?: () => void
}

export function useCameraDevice(options: UseCameraDeviceOptions = {}) {
  const { onResetInference } = options

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mountedRef = useRef(false)

  const [status, setStatus] = useState<CameraStatus>("starting")
  const [error, setError] = useState<string | null>(null)
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null)
  const [lastSnapshotAt, setLastSnapshotAt] = useState<Date | null>(null)

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

    const scale = Math.min(
      1,
      MAX_CAPTURE_WIDTH / video.videoWidth,
      MAX_CAPTURE_HEIGHT / video.videoHeight
    )
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
    onResetInference?.()
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
      } catch (captureError) {
        if (
          captureError instanceof DOMException &&
          (captureError.name === "OverconstrainedError" || captureError.name === "NotFoundError")
        ) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          })
        } else {
          throw captureError
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
    } catch (captureError) {
      if (!mountedRef.current) {
        return
      }

      setError(mapCameraError(captureError))
      setStatus("error")
    }
  }, [onResetInference, stopCamera])

  const handleStopCamera = useCallback(() => {
    stopCamera()
    setError(null)
    setStatus("idle")
    onResetInference?.()
  }, [onResetInference, stopCamera])

  useEffect(() => {
    mountedRef.current = true
    void startCamera()

    return () => {
      mountedRef.current = false
      stopCamera()
    }
  }, [startCamera, stopCamera])

  return {
    videoRef,
    status,
    error,
    snapshotUrl,
    lastSnapshotAt,
    captureFrame,
    startCamera,
    stopCamera,
    handleStopCamera,
    isMountedRef: mountedRef
  }
}
