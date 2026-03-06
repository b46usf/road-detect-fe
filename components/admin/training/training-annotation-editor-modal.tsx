"use client"

import { useState } from "react"
import TrainingAnnotationCanvasEditor from "@/components/admin/training/training-annotation-canvas-editor"
import type { TrainingAnnotation, TrainingSample } from "@/lib/training-types"

interface TrainingAnnotationEditorModalProps {
  sample: TrainingSample | null
  open: boolean
  saving: boolean
  onClose: () => void
  onSave: (sample: TrainingSample, annotations: TrainingAnnotation[]) => Promise<void>
}

export default function TrainingAnnotationEditorModal(
  props: TrainingAnnotationEditorModalProps
) {
  const { sample, open, saving, onClose, onSave } = props
  const [draftAnnotations, setDraftAnnotations] = useState<TrainingAnnotation[]>(sample?.annotations ?? [])

  if (!open || !sample) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-md">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-auto rounded-3xl border border-white/10 bg-slate-950 p-4 shadow-2xl shadow-cyan-950/40 sm:p-5">
        <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Training Annotation Editor</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-100">{sample.filename}</h2>
            <p className="mt-1 text-sm text-slate-400">
              Edit bounding box visual lalu simpan untuk sample training ini.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={() => {
                void onSave(sample, draftAnnotations)
              }}
              disabled={saving}
              className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Menyimpan..." : "Simpan Box"}
            </button>
          </div>
        </div>

        <div className="mt-4">
          <TrainingAnnotationCanvasEditor
            imageSrc={sample.publicImagePath}
            imageWidth={sample.imageWidth}
            imageHeight={sample.imageHeight}
            annotations={draftAnnotations}
            onChange={setDraftAnnotations}
            defaultLabel={sample.label}
            title="Canvas Bounding Box Editor"
          />
        </div>
      </div>
    </div>
  )
}
