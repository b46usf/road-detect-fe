"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  buildPreviewAnnotation,
  drawAnnotationLayer
} from "@/components/admin/training/training-annotation-canvas-utils"
import type {
  TrainingAnnotationCanvasRenderState,
  UseTrainingAnnotationCanvasRenderParams
} from "@/components/admin/training/training-annotation-canvas-types"

const MAX_CANVAS_WIDTH = 880

export function useTrainingAnnotationCanvasRender(
  params: UseTrainingAnnotationCanvasRenderParams
): TrainingAnnotationCanvasRenderState {
  const {
    imageSrc,
    imageWidth,
    imageHeight,
    annotations,
    selectedIndex,
    dragState,
    nextLabel,
    minBoxSize
  } = params

  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const element = containerRef.current
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0
      setContainerWidth(width)
    })

    observer.observe(element)
    setContainerWidth(element.clientWidth)

    return () => observer.disconnect()
  }, [])

  const view = useMemo(() => {
    const width = Math.max(
      1,
      Math.min(imageWidth, MAX_CANVAS_WIDTH, containerWidth > 0 ? containerWidth : MAX_CANVAS_WIDTH)
    )
    const scale = width / Math.max(1, imageWidth)
    return {
      width,
      height: Math.max(1, Math.round(imageHeight * scale)),
      scale
    }
  }, [containerWidth, imageHeight, imageWidth])

  const previewAnnotation = useMemo(
    () =>
      buildPreviewAnnotation({
        dragState,
        nextLabel,
        imageWidth,
        imageHeight,
        minBoxSize
      }),
    [dragState, imageHeight, imageWidth, minBoxSize, nextLabel]
  )

  const allAnnotations = useMemo(
    () => (previewAnnotation ? [...annotations, previewAnnotation] : annotations),
    [annotations, previewAnnotation]
  )

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const image = imageRef.current
    if (!canvas || !image) {
      return
    }

    const context = canvas.getContext("2d")
    if (!context) {
      return
    }

    canvas.width = view.width
    canvas.height = view.height

    context.clearRect(0, 0, view.width, view.height)
    context.drawImage(image, 0, 0, view.width, view.height)
    context.fillStyle = "rgba(2, 6, 23, 0.16)"
    context.fillRect(0, 0, view.width, view.height)
    drawAnnotationLayer({
      context,
      annotations: allAnnotations,
      selectedIndex,
      scale: view.scale
    })
  }, [allAnnotations, selectedIndex, view.height, view.scale, view.width])

  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  useEffect(() => {
    const image = new Image()
    image.onload = () => {
      imageRef.current = image
      drawCanvas()
    }
    image.src = imageSrc

    return () => {
      imageRef.current = null
    }
  }, [drawCanvas, imageSrc])

  const getImagePoint = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) {
        return { x: 0, y: 0 }
      }

      const rect = canvas.getBoundingClientRect()
      const x = ((event.clientX - rect.left) / rect.width) * imageWidth
      const y = ((event.clientY - rect.top) / rect.height) * imageHeight
      return {
        x: Math.max(0, Math.min(imageWidth, x)),
        y: Math.max(0, Math.min(imageHeight, y))
      }
    },
    [imageHeight, imageWidth]
  )

  return {
    containerRef,
    canvasRef,
    view,
    previewAnnotation,
    getImagePoint
  }
}
