import type { DetectionPrediction } from "@/components/camera/types"
import { readString, toFiniteNumber } from "@/lib/common-utils"
import {
  TRAINING_LABELS,
  type TrainingAnnotation,
  type TrainingLabel
} from "@/lib/training-types"

const TRAINING_LABEL_SET = new Set<TrainingLabel>(TRAINING_LABELS)

function clampPositiveNumber(value: unknown): number | null {
  const parsed = toFiniteNumber(value)
  if (parsed === null || parsed <= 0) {
    return null
  }

  return parsed
}

export function normalizeTrainingAnnotationLabel(value: unknown): TrainingLabel {
  const raw = readString(value).trim().toLowerCase()
  if (TRAINING_LABEL_SET.has(raw as TrainingLabel)) {
    return raw as TrainingLabel
  }

  if (raw.includes("pothole")) {
    return "pothole"
  }
  if (raw.includes("crack")) {
    return "crack"
  }
  if (raw.includes("rut")) {
    return "rutting"
  }
  if (raw.includes("barrier")) {
    return "barrier"
  }
  if (raw.includes("water")) {
    return "water"
  }

  return "other"
}

export function normalizeTrainingAnnotations(value: unknown): TrainingAnnotation[] {
  if (!Array.isArray(value)) {
    return []
  }

  const results: TrainingAnnotation[] = []

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue
    }

    const source = item as Record<string, unknown>
    const x = clampPositiveNumber(source.x)
    const y = clampPositiveNumber(source.y)
    const width = clampPositiveNumber(source.width)
    const height = clampPositiveNumber(source.height)

    if (x === null || y === null || width === null || height === null) {
      continue
    }

    results.push({
      label: normalizeTrainingAnnotationLabel(source.label),
      x,
      y,
      width,
      height
    })
  }

  return results
}

export function createTrainingAnnotationsFromDetections(
  detections: DetectionPrediction[]
): TrainingAnnotation[] {
  return detections.map((item) => ({
    label: normalizeTrainingAnnotationLabel(item.label),
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height
  }))
}

export function serializeTrainingAnnotations(
  annotations: TrainingAnnotation[],
  space = 2
): string {
  return JSON.stringify({ annotations }, null, space)
}

export function parseTrainingAnnotationDocument(value: string): TrainingAnnotation[] {
  const trimmed = value.trim()
  if (!trimmed) {
    return []
  }

  const parsed: unknown = JSON.parse(trimmed)
  if (Array.isArray(parsed)) {
    return normalizeTrainingAnnotations(parsed)
  }

  if (parsed && typeof parsed === "object") {
    const source = parsed as Record<string, unknown>
    return normalizeTrainingAnnotations(source.annotations)
  }

  return []
}

export function buildDarknetAnnotationFile(params: {
  annotations: TrainingAnnotation[]
  imageWidth: number
  imageHeight: number
}): { annotationFile: string; labelmap: Record<string, string> } {
  const { annotations, imageWidth, imageHeight } = params
  if (!Number.isFinite(imageWidth) || imageWidth <= 0 || !Number.isFinite(imageHeight) || imageHeight <= 0) {
    throw new Error("Dimensi image training tidak valid untuk konversi anotasi.")
  }

  const labelmap: Record<string, string> = {}
  TRAINING_LABELS.forEach((label, index) => {
    labelmap[String(index)] = label
  })

  const lines = annotations.map((annotation) => {
    const classIndex = TRAINING_LABELS.indexOf(annotation.label)
    const xCenter = Math.min(1, Math.max(0, annotation.x / imageWidth))
    const yCenter = Math.min(1, Math.max(0, annotation.y / imageHeight))
    const width = Math.min(1, Math.max(0, annotation.width / imageWidth))
    const height = Math.min(1, Math.max(0, annotation.height / imageHeight))

    return [classIndex, xCenter, yCenter, width, height]
      .map((value, index) => (index === 0 ? value : Number(value).toFixed(6)))
      .join(" ")
  })

  return {
    annotationFile: lines.join("\n"),
    labelmap
  }
}

export interface AnnotationBounds {
  left: number
  top: number
  right: number
  bottom: number
}

export function annotationToBounds(annotation: TrainingAnnotation): AnnotationBounds {
  return {
    left: annotation.x - annotation.width / 2,
    top: annotation.y - annotation.height / 2,
    right: annotation.x + annotation.width / 2,
    bottom: annotation.y + annotation.height / 2
  }
}

export function boundsToAnnotation(params: {
  label: TrainingLabel
  left: number
  top: number
  right: number
  bottom: number
}): TrainingAnnotation {
  const width = Math.max(1, params.right - params.left)
  const height = Math.max(1, params.bottom - params.top)

  return {
    label: params.label,
    x: params.left + width / 2,
    y: params.top + height / 2,
    width,
    height
  }
}

export function clampAnnotationToImage(params: {
  annotation: TrainingAnnotation
  imageWidth: number
  imageHeight: number
  minSize?: number
}): TrainingAnnotation {
  const { annotation, imageWidth, imageHeight, minSize = 6 } = params
  const halfWidth = Math.max(minSize, annotation.width) / 2
  const halfHeight = Math.max(minSize, annotation.height) / 2

  const x = Math.min(Math.max(annotation.x, halfWidth), imageWidth - halfWidth)
  const y = Math.min(Math.max(annotation.y, halfHeight), imageHeight - halfHeight)
  const width = Math.min(Math.max(annotation.width, minSize), imageWidth)
  const height = Math.min(Math.max(annotation.height, minSize), imageHeight)

  return {
    ...annotation,
    x,
    y,
    width,
    height
  }
}
