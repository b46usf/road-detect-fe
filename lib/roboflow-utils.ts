import { toFiniteNumber, readString, extractMimeFromDataUrl } from "./common-utils"

export type SeverityLevel = "ringan" | "sedang" | "berat"
export type DominantSeverity = SeverityLevel | "tidak-terdeteksi"

export interface ParsedPrediction {
  label: string
  width: number
  height: number
}

export interface ClassSummaryAccumulator {
  label: string
  count: number
  totalAreaPercent: number
  severityArea: {
    ringan: number
    sedang: number
    berat: number
  }
}

export interface ParsedVisualEvidence {
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

export const LIGHT_SEVERITY_MAX_PERCENT = 1.5
export const MEDIUM_SEVERITY_MAX_PERCENT = 4

export function normalizePredictions(rawPredictions: unknown): ParsedPrediction[] {
  if (!Array.isArray(rawPredictions)) {
    return []
  }

  const results: ParsedPrediction[] = []

  for (const item of rawPredictions) {
    if (!item || typeof item !== "object") {
      continue
    }

    const source = item as Record<string, unknown>
    const rawLabel = typeof source.class === "string" ? source.class.trim() : ""
    const label = rawLabel.length > 0 ? rawLabel : "objek"
    const width = toFiniteNumber(source.width)
    const height = toFiniteNumber(source.height)

    if (width === null || height === null || width <= 0 || height <= 0) {
      continue
    }

    results.push({
      label,
      width,
      height
    })
  }

  return results
}

// Detection shape used by client camera UI (includes position + confidence)
export interface DetectionPrediction {
  x: number
  y: number
  width: number
  height: number
  label: string
  confidence: number | null
}

// Normalize model/raw predictions into detection predictions usable by camera UI
export function normalizePredictionsToDetections(rawPredictions: unknown): DetectionPrediction[] {
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

export function classifySeverity(areaPercent: number): SeverityLevel {
  if (areaPercent < LIGHT_SEVERITY_MAX_PERCENT) {
    return "ringan"
  }

  if (areaPercent < MEDIUM_SEVERITY_MAX_PERCENT) {
    return "sedang"
  }

  return "berat"
}

export function classifyClassBucket(label: string): "pothole" | "crack" | "rutting" | "lainnya" {
  const normalized = label.toLowerCase()

  if (normalized.includes("pothole")) {
    return "pothole"
  }

  if (normalized.includes("crack")) {
    return "crack"
  }

  if (normalized.includes("rutting")) {
    return "rutting"
  }

  return "lainnya"
}

export function dominantSeverityFromArea(severityArea: { ringan: number; sedang: number; berat: number }): DominantSeverity {
  const total = severityArea.ringan + severityArea.sedang + severityArea.berat
  if (total <= 0) {
    return "tidak-terdeteksi"
  }

  if (severityArea.berat >= severityArea.sedang && severityArea.berat >= severityArea.ringan) {
    return "berat"
  }

  if (severityArea.sedang >= severityArea.ringan) {
    return "sedang"
  }

  return "ringan"
}

export function buildDamageSummary(
  predictions: ParsedPrediction[],
  frameWidth: number | null,
  frameHeight: number | null
) {
  const frameAreaPx =
    frameWidth !== null && frameHeight !== null && frameWidth > 0 && frameHeight > 0
      ? frameWidth * frameHeight
      : 0

  const counts = { ringan: 0, sedang: 0, berat: 0 }
  const areaBySeverity = { ringan: 0, sedang: 0, berat: 0 }
  const classMap = new Map<string, ClassSummaryAccumulator>()
  const classBucketCounts = { pothole: 0, crack: 0, rutting: 0, lainnya: 0 }

  let totalBoxAreaPx = 0
  for (const prediction of predictions) {
    const areaPx = prediction.width * prediction.height
    totalBoxAreaPx += areaPx

    const areaPercent = frameAreaPx > 0 ? (areaPx * 100) / frameAreaPx : 0
    const severity = classifySeverity(areaPercent)
    counts[severity] += 1
    areaBySeverity[severity] += areaPercent

    const normalizedLabel = prediction.label.trim().toLowerCase() || "objek"
    const existing = classMap.get(normalizedLabel)
    if (existing) {
      existing.count += 1
      existing.totalAreaPercent += areaPercent
      existing.severityArea[severity] += areaPercent
    } else {
      classMap.set(normalizedLabel, {
        label: normalizedLabel,
        count: 1,
        totalAreaPercent: areaPercent,
        severityArea: {
          ringan: severity === "ringan" ? areaPercent : 0,
          sedang: severity === "sedang" ? areaPercent : 0,
          berat: severity === "berat" ? areaPercent : 0
        }
      })
    }

    const bucket = classifyClassBucket(normalizedLabel)
    classBucketCounts[bucket] += 1
  }

  const totalDamagePercent = frameAreaPx > 0 ? Math.min(100, (totalBoxAreaPx * 100) / frameAreaPx) : 0
  const distributionBase = Math.max(0.0001, areaBySeverity.ringan + areaBySeverity.sedang + areaBySeverity.berat)
  const distributionPercent = {
    ringan: (areaBySeverity.ringan * 100) / distributionBase,
    sedang: (areaBySeverity.sedang * 100) / distributionBase,
    berat: (areaBySeverity.berat * 100) / distributionBase
  }

  const totalDetections = counts.ringan + counts.sedang + counts.berat
  const dominantSeverity: DominantSeverity =
    totalDetections === 0
      ? "tidak-terdeteksi"
      : areaBySeverity.berat >= areaBySeverity.sedang && areaBySeverity.berat >= areaBySeverity.ringan
        ? "berat"
        : areaBySeverity.sedang >= areaBySeverity.ringan
          ? "sedang"
          : "ringan"

  const daftar = Array.from(classMap.values())
    .map((item) => ({
      label: item.label,
      jumlah: item.count,
      persentaseJumlah: totalDetections > 0 ? (item.count * 100) / totalDetections : 0,
      totalPersentaseArea: item.totalAreaPercent,
      dominanSeverity: dominantSeverityFromArea(item.severityArea)
    }))
    .sort((a, b) => b.jumlah - a.jumlah)

  const distribusiPersentase = {
    pothole: totalDetections > 0 ? (classBucketCounts.pothole * 100) / totalDetections : 0,
    crack: totalDetections > 0 ? (classBucketCounts.crack * 100) / totalDetections : 0,
    rutting: totalDetections > 0 ? (classBucketCounts.rutting * 100) / totalDetections : 0,
    lainnya: totalDetections > 0 ? (classBucketCounts.lainnya * 100) / totalDetections : 0
  }

  const dominanKelas = daftar.length > 0 ? daftar[0].label : null

  return {
    totalDamagePercent,
    totalBoxAreaPx,
    frameAreaPx,
    counts,
    distributionPercent,
    dominantSeverity,
    breakdownKelas: {
      counts: {
        ...classBucketCounts,
        totalDeteksi: totalDetections
      },
      distribusiPersentase,
      dominanKelas,
      daftar
    }
  }
}

export function parseVisualEvidence(
  evidenceValue: unknown,
  rawImageInput: string,
  fallbackCaptureWidth: number | null,
  fallbackCaptureHeight: number | null
): ParsedVisualEvidence {
  const source = evidenceValue && typeof evidenceValue === "object" ? (evidenceValue as Record<string, unknown>) : {}

  const captureWidth = toFiniteNumber(source.captureWidth ?? source.frameWidth) ?? fallbackCaptureWidth
  const captureHeight = toFiniteNumber(source.captureHeight ?? source.frameHeight) ?? fallbackCaptureHeight
  const sourceWidth = toFiniteNumber(source.sourceWidth) ?? captureWidth
  const sourceHeight = toFiniteNumber(source.sourceHeight) ?? captureHeight

  const mime = readString(source.mime) || extractMimeFromDataUrl(rawImageInput) || "image/jpeg"
  const quality = toFiniteNumber(source.quality)
  const imageDataUrl = rawImageInput.startsWith("data:") ? rawImageInput : null

  const isFhdSource =
    sourceWidth !== null && sourceHeight !== null
      ? Math.max(sourceWidth, sourceHeight) >= 1920 && Math.min(sourceWidth, sourceHeight) >= 1080
      : null

  return {
    imageDataUrl,
    mime,
    quality,
    resolusiCapture: {
      width: captureWidth,
      height: captureHeight
    },
    resolusiSource: {
      width: sourceWidth,
      height: sourceHeight
    },
    isFhdSource
  }
}
