"use client"

import TrainingAnnotationCanvasSidebar from "@/components/admin/training/training-annotation-canvas-sidebar"
import TrainingAnnotationCanvasToolbar from "@/components/admin/training/training-annotation-canvas-toolbar"
import { useTrainingAnnotationCanvas } from "@/components/admin/training/use-training-annotation-canvas"
import type { TrainingAnnotation, TrainingLabel } from "@/lib/training-types"

interface TrainingAnnotationCanvasEditorProps {
  imageSrc: string
  imageWidth: number
  imageHeight: number
  annotations: TrainingAnnotation[]
  onChange: (annotations: TrainingAnnotation[]) => void
  defaultLabel?: TrainingLabel
  title?: string
}

export default function TrainingAnnotationCanvasEditor(
  props: TrainingAnnotationCanvasEditorProps
) {
  const {
    imageSrc,
    imageWidth,
    imageHeight,
    annotations,
    onChange,
    defaultLabel = "pothole",
    title = "Bounding Box Editor"
  } = props

  const {
    annotations: editorAnnotations,
    canDeleteSelected,
    canvasRef,
    containerRef,
    deleteSelected,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    imageHeight: editorImageHeight,
    imageWidth: editorImageWidth,
    nextLabel,
    selectAnnotation,
    selectedAnnotation,
    selectedIndex,
    setEditorLabel,
    view
  } = useTrainingAnnotationCanvas({
    imageSrc,
    imageWidth,
    imageHeight,
    annotations,
    onChange,
    defaultLabel
  })

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <TrainingAnnotationCanvasToolbar
        title={title}
        activeLabel={nextLabel}
        selectedAnnotation={selectedAnnotation}
        canDeleteSelected={canDeleteSelected}
        onLabelChange={setEditorLabel}
        onDelete={deleteSelected}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div
          ref={containerRef}
          className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-2"
        >
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className="mx-auto block cursor-crosshair rounded-xl bg-slate-950/70"
            style={{
              width: `${view.width}px`,
              height: `${view.height}px`,
              touchAction: "none"
            }}
          />
        </div>

        <TrainingAnnotationCanvasSidebar
          annotations={editorAnnotations}
          imageWidth={editorImageWidth}
          imageHeight={editorImageHeight}
          selectedIndex={selectedIndex}
          onSelect={selectAnnotation}
        />
      </div>
    </section>
  )
}
