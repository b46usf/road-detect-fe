import Link from "next/link"
import { formatPercent, getSeverityStyles, severityLabel } from "@/lib/ui-utils"
import { formatConfidence } from "./camera-utils"
import type { RenderedDetection } from "./types"
import type { RefObject } from "react"

interface CameraStageCardProps {
  videoRef: RefObject<HTMLVideoElement | null>
  viewportRef: RefObject<HTMLDivElement | null>
  status: "starting" | "active" | "idle" | "error"
  error: string | null
  startCamera: () => void
  renderedDetections: RenderedDetection[]
  cameraBadge: { tone: string; label: string }
  inferenceStatusLabel: string
  apiBadge: { tone: string; label: string }
  gpsBadge: { tone: string; label: string }
}

export default function CameraStageCard(props: CameraStageCardProps) {
  const {
    videoRef,
    viewportRef,
    status,
    error,
    startCamera,
    renderedDetections,
    cameraBadge,
    inferenceStatusLabel,
    apiBadge,
    gpsBadge
  } = props

  return (
    <>
      <header className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/90">Live Detection</p>
            <h1 className="mt-1 text-xl font-semibold sm:text-2xl">Deteksi Jalan Realtime</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Snapshot diambil tiap 1 detik. Inference di-throttle tiap 2.5 detik dengan frame yang sudah di-resize agar quota Roboflow lebih awet.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/25 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Kontrol Cepat</p>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-white/10 bg-black/35 p-2">
                <p className="text-[10px] uppercase tracking-wide text-slate-400">Kamera</p>
                <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${cameraBadge.tone}`}>
                  {cameraBadge.label}
                </span>
              </div>
              <div className="rounded-lg border border-cyan-300/20 bg-black/35 p-2">
                <p className="text-[10px] uppercase tracking-wide text-slate-400">Deteksi</p>
                <span className="mt-1 inline-flex rounded-full border border-cyan-300/40 bg-cyan-400/15 px-2 py-0.5 text-[11px] font-medium text-cyan-100">
                  {inferenceStatusLabel}
                </span>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/35 p-2">
                <p className="text-[10px] uppercase tracking-wide text-slate-400">API</p>
                <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${apiBadge.tone}`}>
                  {apiBadge.label}
                </span>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/35 p-2">
                <p className="text-[10px] uppercase tracking-wide text-slate-400">GPS</p>
                <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${gpsBadge.tone}`}>
                  {gpsBadge.label}
                </span>
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <Link
                href="/admin/dashboard"
                className="inline-flex items-center justify-center rounded-lg border border-cyan-300/40 bg-cyan-400/20 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/30"
              >
                Buka Dashboard Admin
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-medium text-slate-100 transition hover:bg-white/10"
              >
                Kembali ke Beranda
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
        <div ref={viewportRef} className="relative aspect-[9/16] w-full md:aspect-[16/9]">
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />

          {renderedDetections.length > 0 && (
            <div className="pointer-events-none absolute inset-0">
              {renderedDetections.map((prediction) => {
                const styles = getSeverityStyles(prediction.severity)
                return (
                  <div
                    key={prediction.id}
                    className={`absolute rounded-md border-2 shadow-[0_0_0_1px_rgba(0,0,0,0.4)] ${styles.boxClass}`}
                    style={{
                      left: `${prediction.left}px`,
                      top: `${prediction.top}px`,
                      width: `${prediction.width}px`,
                      height: `${prediction.height}px`
                    }}
                  >
                    <span
                      className={`absolute -top-6 left-0 rounded px-2 py-0.5 text-[10px] font-semibold ${styles.labelClass}`}
                    >
                      {prediction.label}
                      {formatConfidence(prediction.confidence)
                        ? ` ${formatConfidence(prediction.confidence)}`
                        : ""}
                      {` | ${severityLabel(prediction.severity)} ${formatPercent(prediction.areaPercent)}`}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {status === "starting" && (
            <div className="absolute inset-0 grid place-items-center bg-slate-950/70">
              <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
                Memulai kamera...
              </div>
            </div>
          )}

          {status === "idle" && (
            <div className="absolute inset-0 grid place-items-center bg-slate-950/75 p-4">
              <div className="rounded-xl border border-white/15 bg-black/45 px-4 py-3 text-center text-sm text-slate-200">
                Kamera sedang tidak aktif.
              </div>
            </div>
          )}

          {status === "error" && error && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 p-4">
              <div className="max-w-md rounded-2xl border border-rose-300/35 bg-rose-950/45 p-5 text-center">
                <p className="text-sm leading-relaxed text-rose-100">{error}</p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="mt-4 rounded-lg bg-rose-300 px-4 py-2 text-sm font-semibold text-rose-950 transition hover:bg-rose-200"
                >
                  Coba Lagi
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
