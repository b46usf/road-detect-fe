import { TRAINING_LABEL_OPTIONS } from "@/components/admin/training/training-shared"
import type { TrainingAnnotation, TrainingLabel } from "@/lib/training-types"

interface TrainingAnnotationCanvasToolbarProps {
  title: string
  activeLabel: TrainingLabel
  selectedAnnotation: TrainingAnnotation | null
  canDeleteSelected: boolean
  onLabelChange: (label: TrainingLabel) => void
  onDelete: () => void
}

export default function TrainingAnnotationCanvasToolbar(
  props: TrainingAnnotationCanvasToolbarProps
) {
  const { title, activeLabel, selectedAnnotation, canDeleteSelected, onLabelChange, onDelete } = props

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        <p className="mt-1 text-xs text-slate-400">
          Drag area kosong untuk membuat box. Drag box untuk memindahkan. Tarik titik sudut untuk resize.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-slate-300">
          Label aktif
          <select
            value={selectedAnnotation?.label ?? activeLabel}
            onChange={(event) => onLabelChange(event.currentTarget.value as TrainingLabel)}
            className="ml-2 rounded-lg border border-white/15 bg-slate-900 px-2 py-1 text-xs text-slate-100"
          >
            {TRAINING_LABEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={onDelete}
          disabled={!canDeleteSelected}
          className="rounded-lg border border-rose-300/35 bg-rose-400/10 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Hapus Box
        </button>
      </div>
    </div>
  )
}
