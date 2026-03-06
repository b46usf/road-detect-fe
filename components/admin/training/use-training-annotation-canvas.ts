"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  annotationToBounds,
  boundsToAnnotation,
  clampAnnotationToImage
} from "@/lib/training-annotations"
import type { TrainingAnnotation, TrainingLabel } from "@/lib/training-types"
import {
  detectHandle,
  normalizeBounds,
  pointInsideBounds,
  updateBoundsByHandle,
  type DragState
} from "@/components/admin/training/training-annotation-canvas-utils"
import type {
  TrainingAnnotationCanvasState,
  UseTrainingAnnotationCanvasParams
} from "@/components/admin/training/training-annotation-canvas-types"
import { useTrainingAnnotationCanvasRender } from "@/components/admin/training/use-training-annotation-canvas-render"

const MIN_BOX_SIZE = 8

export function useTrainingAnnotationCanvas(
  params: UseTrainingAnnotationCanvasParams
): TrainingAnnotationCanvasState {
  const { imageSrc, imageWidth, imageHeight, annotations, onChange, defaultLabel } = params

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [nextLabel, setNextLabel] = useState<TrainingLabel>(defaultLabel)
  const [dragState, setDragState] = useState<DragState | null>(null)

  useEffect(() => {
    setNextLabel(defaultLabel)
  }, [defaultLabel])

  const renderState = useTrainingAnnotationCanvasRender({
    imageSrc,
    imageWidth,
    imageHeight,
    annotations,
    selectedIndex,
    dragState,
    nextLabel,
    minBoxSize: MIN_BOX_SIZE
  })

  const commitAnnotation = useCallback(
    (index: number, annotation: TrainingAnnotation) => {
      const next = annotations.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item
        }

        return clampAnnotationToImage({
          annotation,
          imageWidth,
          imageHeight,
          minSize: MIN_BOX_SIZE
        })
      })
      onChange(next)
    },
    [annotations, imageHeight, imageWidth, onChange]
  )

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const point = renderState.getImagePoint(event)
      const tolerance = 10 / Math.max(0.1, renderState.view.scale)

      for (let index = annotations.length - 1; index >= 0; index -= 1) {
        const annotation = annotations[index]
        const bounds = annotationToBounds(annotation)
        const handle = detectHandle(point.x, point.y, bounds, tolerance)

        if (handle) {
          setSelectedIndex(index)
          setNextLabel(annotation.label)
          setDragState({
            mode: "resize",
            index,
            handle,
            origin: bounds
          })
          return
        }

        if (pointInsideBounds(point.x, point.y, bounds)) {
          setSelectedIndex(index)
          setNextLabel(annotation.label)
          setDragState({
            mode: "move",
            index,
            offsetX: point.x - annotation.x,
            offsetY: point.y - annotation.y
          })
          return
        }
      }

      setSelectedIndex(null)
      setDragState({
        mode: "draw",
        startX: point.x,
        startY: point.y,
        currentX: point.x,
        currentY: point.y
      })
    },
    [annotations, renderState]
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!dragState) {
        return
      }

      const point = renderState.getImagePoint(event)

      if (dragState.mode === "draw") {
        setDragState({
          ...dragState,
          currentX: point.x,
          currentY: point.y
        })
        return
      }

      if (dragState.mode === "move") {
        const current = annotations[dragState.index]
        if (!current) {
          return
        }

        commitAnnotation(dragState.index, {
          ...current,
          x: point.x - dragState.offsetX,
          y: point.y - dragState.offsetY
        })
        return
      }

      const current = annotations[dragState.index]
      if (!current) {
        return
      }

      const nextBounds = normalizeBounds(
        updateBoundsByHandle(dragState.origin, dragState.handle, point.x, point.y)
      )

      commitAnnotation(
        dragState.index,
        boundsToAnnotation({
          label: current.label,
          ...nextBounds
        })
      )
    },
    [annotations, commitAnnotation, dragState, renderState]
  )

  const handlePointerUp = useCallback(() => {
    if (!dragState) {
      return
    }

    if (dragState.mode === "draw" && renderState.previewAnnotation) {
      onChange([...annotations, renderState.previewAnnotation])
      setSelectedIndex(annotations.length)
      setNextLabel(renderState.previewAnnotation.label)
    }

    setDragState(null)
  }, [annotations, dragState, onChange, renderState.previewAnnotation])

  const deleteSelected = useCallback(() => {
    if (selectedIndex === null) {
      return
    }

    const next = annotations.filter((_, index) => index !== selectedIndex)
    onChange(next)
    setSelectedIndex(null)
  }, [annotations, onChange, selectedIndex])

  const setEditorLabel = useCallback(
    (label: TrainingLabel) => {
      setNextLabel(label)
      if (selectedIndex === null) {
        return
      }

      const current = annotations[selectedIndex]
      if (!current) {
        return
      }

      commitAnnotation(selectedIndex, {
        ...current,
        label
      })
    },
    [annotations, commitAnnotation, selectedIndex]
  )

  const selectAnnotation = useCallback((index: number, label: TrainingLabel) => {
    setSelectedIndex(index)
    setNextLabel(label)
  }, [])

  const selectedAnnotation = useMemo(
    () =>
      selectedIndex !== null && selectedIndex >= 0 && selectedIndex < annotations.length
        ? annotations[selectedIndex]
        : null,
    [annotations, selectedIndex]
  )

  return {
    containerRef: renderState.containerRef,
    canvasRef: renderState.canvasRef,
    annotations,
    imageWidth,
    imageHeight,
    nextLabel,
    selectedIndex,
    selectedAnnotation,
    canDeleteSelected: selectedIndex !== null,
    view: renderState.view,
    setSelectedIndex,
    setEditorLabel,
    selectAnnotation,
    deleteSelected,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp
  }
}
