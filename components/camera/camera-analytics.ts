import { classifySeverity } from "@/lib/roboflow-utils"
import type {
  DetectionPrediction,
  DetectionWithSeverity,
  RenderedDetection,
  SeverityAssessment
} from "./types"

const EMPTY_ASSESSMENT: SeverityAssessment = {
  items: [],
  totalDamagePercent: 0,
  counts: { ringan: 0, sedang: 0, berat: 0 },
  distributionPercent: { ringan: 0, sedang: 0, berat: 0 },
  dominantSeverity: null
}

export function buildSeverityAssessment(
  detections: DetectionPrediction[],
  detectionFrameSize: { width: number; height: number } | null
): SeverityAssessment {
  if (!detectionFrameSize || detections.length === 0) {
    return EMPTY_ASSESSMENT
  }

  const frameArea = detectionFrameSize.width * detectionFrameSize.height
  if (!Number.isFinite(frameArea) || frameArea <= 0) {
    return EMPTY_ASSESSMENT
  }

  const items: DetectionWithSeverity[] = detections.map((prediction) => {
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

  const distributionBase = Math.max(
    0.0001,
    areaBySeverity.ringan + areaBySeverity.sedang + areaBySeverity.berat
  )

  const dominantSeverity =
    areaBySeverity.berat >= areaBySeverity.sedang && areaBySeverity.berat >= areaBySeverity.ringan
      ? "berat"
      : areaBySeverity.sedang >= areaBySeverity.ringan
        ? "sedang"
        : "ringan"

  return {
    items,
    totalDamagePercent: Math.min(100, totalAreaPercent),
    counts,
    distributionPercent: {
      ringan: (areaBySeverity.ringan * 100) / distributionBase,
      sedang: (areaBySeverity.sedang * 100) / distributionBase,
      berat: (areaBySeverity.berat * 100) / distributionBase
    },
    dominantSeverity: items.length > 0 ? dominantSeverity : null
  }
}

export function buildRenderedDetections(
  severityItems: DetectionWithSeverity[],
  detectionFrameSize: { width: number; height: number } | null,
  viewportSize: { width: number; height: number }
): RenderedDetection[] {
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

  return severityItems
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
}
