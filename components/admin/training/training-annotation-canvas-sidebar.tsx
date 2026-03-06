import type { TrainingAnnotation } from "@/lib/training-types"

interface TrainingAnnotationCanvasSidebarProps {
  annotations: TrainingAnnotation[]
  imageWidth: number
  imageHeight: number
  selectedIndex: number | null
  onSelect: (index: number, label: TrainingAnnotation["label"]) => void
}

export default function TrainingAnnotationCanvasSidebar(
  props: TrainingAnnotationCanvasSidebarProps
) {
  const { annotations, imageWidth, imageHeight, selectedIndex, onSelect } = props

  return (
    <aside className="rounded-2xl border border-white/10 bg-black/35 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">Annotation Summary</p>
      <p className="mt-1 text-sm text-slate-200">
        {annotations.length} box pada {imageWidth}x{imageHeight}px
      </p>

      <div className="mt-3 space-y-2">
        {annotations.length === 0 ? (
          <p className="text-xs text-slate-400">Belum ada bounding box.</p>
        ) : (
          annotations.map((annotation, index) => (
            <button
              key={`${annotation.label}-${index}-${annotation.x}-${annotation.y}`}
              type="button"
              onClick={() => onSelect(index, annotation.label)}
              className={`w-full rounded-xl border px-3 py-2 text-left text-xs transition ${
                selectedIndex === index
                  ? "border-cyan-300/40 bg-cyan-400/15 text-cyan-100"
                  : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              }`}
            >
              <p className="font-semibold">
                #{index + 1} {annotation.label}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                center ({Math.round(annotation.x)}, {Math.round(annotation.y)}) | size{" "}
                {Math.round(annotation.width)}x{Math.round(annotation.height)}
              </p>
            </button>
          ))
        )}
      </div>
    </aside>
  )
}
