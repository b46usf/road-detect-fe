"use client"

import { useCallback, useMemo, useRef } from "react"
import { buildRenderedDetections, buildSeverityAssessment } from "./camera-analytics"
import CameraView from "./camera-view"
import { DEFAULT_MODEL_ID, DEFAULT_MODEL_VERSION } from "./constants"
import {
  getApiStatusBadge,
  getCameraStatusBadge,
  getGpsStatusBadge
} from "./camera-utils"
import { useCameraDevice } from "./use-camera-device"
import { useGpsTracking } from "./use-gps-tracking"
import { useInferenceEngine } from "./use-inference-engine"
import { useViewportSize } from "./use-viewport-size"

export default function CameraClient() {
  const viewportRef = useRef<HTMLDivElement>(null)

  const modelId = DEFAULT_MODEL_ID
  const modelVersion = DEFAULT_MODEL_VERSION

  const {
    videoRef,
    status,
    error,
    snapshotUrl,
    lastSnapshotAt,
    captureFrame,
    startCamera,
    handleStopCamera,
    isMountedRef
  } = useCameraDevice()

  const { gpsStatus, gpsError, gpsLocation } = useGpsTracking()

  const {
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
  } = useInferenceEngine({
    status,
    videoRef,
    captureFrame,
    modelId,
    modelVersion,
    gpsLocation,
    isMountedRef
  })

  const restartCamera = useCallback(() => {
    resetInferenceState()
    void startCamera()
  }, [resetInferenceState, startCamera])

  const stopCamera = useCallback(() => {
    handleStopCamera()
    resetInferenceState()
  }, [handleStopCamera, resetInferenceState])

  const viewportSize = useViewportSize(viewportRef)

  const severityAssessment = useMemo(
    () => buildSeverityAssessment(detections, detectionFrameSize),
    [detections, detectionFrameSize]
  )

  const renderedDetections = useMemo(
    () => buildRenderedDetections(severityAssessment.items, detectionFrameSize, viewportSize),
    [detectionFrameSize, severityAssessment.items, viewportSize]
  )

  const cameraBadge = getCameraStatusBadge(status)
  const apiBadge = getApiStatusBadge(lastApiStatus)
  const gpsBadge = getGpsStatusBadge(gpsStatus)

  const inferenceStatusLabel = isInferencing ? "Mendeteksi..." : `Objek: ${renderedDetections.length}`

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

  return (
    <CameraView
      videoRef={videoRef}
      viewportRef={viewportRef}
      status={status}
      error={error}
      startCamera={restartCamera}
      handleStopCamera={stopCamera}
      renderedDetections={renderedDetections}
      cameraBadge={cameraBadge}
      inferenceStatusLabel={inferenceStatusLabel}
      apiBadge={apiBadge}
      gpsBadge={gpsBadge}
      snapshotUrl={snapshotUrl}
      onDownloadSnapshot={handleDownloadSnapshot}
      severityAssessment={severityAssessment}
      gpsLocation={gpsLocation}
      gpsError={gpsError}
      lastDetectionReport={lastDetectionReport}
      lastSnapshotAt={lastSnapshotAt}
      lastInferenceAt={lastInferenceAt}
      lastInferenceDurationMs={lastInferenceDurationMs}
      lastApiStatus={lastApiStatus}
      lastApiMessage={lastApiMessage}
      lastApiCode={lastApiCode}
      storageMessage={storageMessage}
      lastStoredAt={lastStoredAt}
      inferenceError={inferenceError}
    />
  )
}
