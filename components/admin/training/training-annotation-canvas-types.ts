import type { MutableRefObject, RefObject } from "react"
import type { TrainingAnnotation, TrainingLabel } from "@/lib/training-types"
import type { DragState } from "@/components/admin/training/training-annotation-canvas-utils"

export interface TrainingAnnotationCanvasView {
  width: number
  height: number
  scale: number
}

export interface UseTrainingAnnotationCanvasParams {
  imageSrc: string
  imageWidth: number
  imageHeight: number
  annotations: TrainingAnnotation[]
  onChange: (annotations: TrainingAnnotation[]) => void
  defaultLabel: TrainingLabel
}

export interface TrainingAnnotationCanvasState {
  containerRef: RefObject<HTMLDivElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  annotations: TrainingAnnotation[]
  imageWidth: number
  imageHeight: number
  nextLabel: TrainingLabel
  selectedIndex: number | null
  selectedAnnotation: TrainingAnnotation | null
  canDeleteSelected: boolean
  view: TrainingAnnotationCanvasView
  setSelectedIndex: (value: number | null) => void
  setEditorLabel: (label: TrainingLabel) => void
  selectAnnotation: (index: number, label: TrainingLabel) => void
  deleteSelected: () => void
  handlePointerDown: (event: React.PointerEvent<HTMLCanvasElement>) => void
  handlePointerMove: (event: React.PointerEvent<HTMLCanvasElement>) => void
  handlePointerUp: () => void
}

export interface TrainingAnnotationCanvasRenderState {
  containerRef: MutableRefObject<HTMLDivElement | null>
  canvasRef: MutableRefObject<HTMLCanvasElement | null>
  view: TrainingAnnotationCanvasView
  previewAnnotation: TrainingAnnotation | null
  getImagePoint: (event: React.PointerEvent<HTMLCanvasElement>) => { x: number; y: number }
}

export interface UseTrainingAnnotationCanvasRenderParams {
  imageSrc: string
  imageWidth: number
  imageHeight: number
  annotations: TrainingAnnotation[]
  selectedIndex: number | null
  dragState: DragState | null
  nextLabel: TrainingLabel
  minBoxSize: number
}
