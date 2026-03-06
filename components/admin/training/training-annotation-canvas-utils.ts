import {
  type AnnotationBounds,
  annotationToBounds,
  boundsToAnnotation,
  clampAnnotationToImage
} from "@/lib/training-annotations"
import type { TrainingAnnotation, TrainingLabel } from "@/lib/training-types"

export type ResizeHandle = "nw" | "ne" | "sw" | "se"

export type DragState =
  | {
      mode: "draw"
      startX: number
      startY: number
      currentX: number
      currentY: number
    }
  | {
      mode: "move"
      index: number
      offsetX: number
      offsetY: number
    }
  | {
      mode: "resize"
      index: number
      handle: ResizeHandle
      origin: AnnotationBounds
    }

export function drawRoundedLabel(params: {
  context: CanvasRenderingContext2D
  x: number
  y: number
  text: string
  active: boolean
}) {
  const { context, x, y, text, active } = params
  context.font = "12px sans-serif"
  const textWidth = context.measureText(text).width
  const width = textWidth + 14
  const height = 22

  context.fillStyle = active ? "rgba(34, 211, 238, 0.95)" : "rgba(15, 23, 42, 0.82)"
  context.strokeStyle = active ? "rgba(34, 211, 238, 1)" : "rgba(148, 163, 184, 0.4)"
  context.lineWidth = 1
  context.beginPath()
  context.roundRect(x, y, width, height, 8)
  context.fill()
  context.stroke()

  context.fillStyle = active ? "#082f49" : "#e2e8f0"
  context.fillText(text, x + 7, y + 14)
}

export function pointInsideBounds(x: number, y: number, bounds: AnnotationBounds): boolean {
  return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom
}

export function detectHandle(
  x: number,
  y: number,
  bounds: AnnotationBounds,
  tolerance: number
): ResizeHandle | null {
  const handles: Array<{ key: ResizeHandle; x: number; y: number }> = [
    { key: "nw", x: bounds.left, y: bounds.top },
    { key: "ne", x: bounds.right, y: bounds.top },
    { key: "sw", x: bounds.left, y: bounds.bottom },
    { key: "se", x: bounds.right, y: bounds.bottom }
  ]

  for (const handle of handles) {
    if (Math.abs(x - handle.x) <= tolerance && Math.abs(y - handle.y) <= tolerance) {
      return handle.key
    }
  }

  return null
}

export function updateBoundsByHandle(
  bounds: AnnotationBounds,
  handle: ResizeHandle,
  x: number,
  y: number
): AnnotationBounds {
  if (handle === "nw") {
    return { ...bounds, left: x, top: y }
  }
  if (handle === "ne") {
    return { ...bounds, right: x, top: y }
  }
  if (handle === "sw") {
    return { ...bounds, left: x, bottom: y }
  }
  return { ...bounds, right: x, bottom: y }
}

export function normalizeBounds(bounds: AnnotationBounds): AnnotationBounds {
  return {
    left: Math.min(bounds.left, bounds.right),
    top: Math.min(bounds.top, bounds.bottom),
    right: Math.max(bounds.left, bounds.right),
    bottom: Math.max(bounds.top, bounds.bottom)
  }
}

export function buildPreviewAnnotation(params: {
  dragState: DragState | null
  nextLabel: TrainingLabel
  imageWidth: number
  imageHeight: number
  minBoxSize: number
}): TrainingAnnotation | null {
  const { dragState, nextLabel, imageWidth, imageHeight, minBoxSize } = params
  if (!dragState || dragState.mode !== "draw") {
    return null
  }

  const left = Math.min(dragState.startX, dragState.currentX)
  const top = Math.min(dragState.startY, dragState.currentY)
  const right = Math.max(dragState.startX, dragState.currentX)
  const bottom = Math.max(dragState.startY, dragState.currentY)

  if (right - left < minBoxSize || bottom - top < minBoxSize) {
    return null
  }

  return clampAnnotationToImage({
    annotation: boundsToAnnotation({
      label: nextLabel,
      left,
      top,
      right,
      bottom
    }),
    imageWidth,
    imageHeight,
    minSize: minBoxSize
  })
}

export function drawAnnotationLayer(params: {
  context: CanvasRenderingContext2D
  annotations: TrainingAnnotation[]
  selectedIndex: number | null
  scale: number
}) {
  const { context, annotations, selectedIndex, scale } = params

  annotations.forEach((annotation, index) => {
    const bounds = annotationToBounds(annotation)
    const left = bounds.left * scale
    const top = bounds.top * scale
    const width = annotation.width * scale
    const height = annotation.height * scale
    const active = selectedIndex === index

    context.strokeStyle = active ? "#22d3ee" : "#f59e0b"
    context.lineWidth = active ? 2.5 : 2
    context.fillStyle = active ? "rgba(34, 211, 238, 0.18)" : "rgba(245, 158, 11, 0.18)"
    context.fillRect(left, top, width, height)
    context.strokeRect(left, top, width, height)

    const handles = [
      [left, top],
      [left + width, top],
      [left, top + height],
      [left + width, top + height]
    ]

    context.fillStyle = active ? "#22d3ee" : "#f8fafc"
    handles.forEach(([x, y]) => {
      context.beginPath()
      context.arc(x, y, active ? 4.5 : 3.5, 0, Math.PI * 2)
      context.fill()
    })

    drawRoundedLabel({
      context,
      x: Math.max(6, left + 4),
      y: Math.max(6, top - 28),
      text: `${annotation.label} #${index + 1}`,
      active
    })
  })
}
