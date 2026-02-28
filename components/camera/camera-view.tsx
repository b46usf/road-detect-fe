import type { RefObject } from "react"
import CameraDetailPanel from "./camera-detail-panel"
import CameraStageCard from "./camera-stage-card"
import type {
  ApiStatus,
  DetectionApiReport,
  GpsLocation,
  RenderedDetection,
  SeverityAssessment
} from "./types"

interface CameraViewProps {
  videoRef: RefObject<HTMLVideoElement | null>
  viewportRef: RefObject<HTMLDivElement | null>
  status: "starting" | "active" | "idle" | "error"
  error: string | null
  startCamera: () => void
  handleStopCamera: () => void
  renderedDetections: RenderedDetection[]
  cameraBadge: { tone: string; label: string }
  inferenceStatusLabel: string
  apiBadge: { tone: string; label: string }
  gpsBadge: { tone: string; label: string }
  snapshotUrl: string | null
  onDownloadSnapshot: () => void
  severityAssessment: SeverityAssessment
  gpsLocation: GpsLocation | null
  gpsError: string | null
  lastDetectionReport: DetectionApiReport | null
  lastSnapshotAt: Date | null
  lastInferenceAt: Date | null
  lastInferenceDurationMs: number | null
  lastApiStatus: ApiStatus
  lastApiMessage: string | null
  lastApiCode: string | null
  storageMessage: string | null
  lastStoredAt: Date | null
  inferenceError: string | null
}

export default function CameraView(props: CameraViewProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100 [font-family:var(--font-geist-sans)]">
      <div className="pointer-events-none absolute -left-16 top-10 h-56 w-56 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-0 h-56 w-56 rounded-full bg-emerald-500/20 blur-3xl" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
        <CameraStageCard
          videoRef={props.videoRef}
          viewportRef={props.viewportRef}
          status={props.status}
          error={props.error}
          startCamera={props.startCamera}
          renderedDetections={props.renderedDetections}
          cameraBadge={props.cameraBadge}
          inferenceStatusLabel={props.inferenceStatusLabel}
          apiBadge={props.apiBadge}
          gpsBadge={props.gpsBadge}
        />

        <CameraDetailPanel
          snapshotUrl={props.snapshotUrl}
          onDownloadSnapshot={props.onDownloadSnapshot}
          severityAssessment={props.severityAssessment}
          gpsLocation={props.gpsLocation}
          gpsError={props.gpsError}
          lastDetectionReport={props.lastDetectionReport}
          lastSnapshotAt={props.lastSnapshotAt}
          lastInferenceAt={props.lastInferenceAt}
          lastInferenceDurationMs={props.lastInferenceDurationMs}
          lastApiStatus={props.lastApiStatus}
          lastApiMessage={props.lastApiMessage}
          lastApiCode={props.lastApiCode}
          storageMessage={props.storageMessage}
          lastStoredAt={props.lastStoredAt}
          inferenceError={props.inferenceError}
        />

        <footer className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:p-5">
          <div className="grid gap-2 text-sm text-slate-300 md:grid-cols-3">
            <p>1. Pastikan browser sudah mendapat izin kamera.</p>
            <p>2. Aktifkan izin lokasi agar GPS/GNSS ikut terkirim ke payload.</p>
            <p>3. Inference di-throttle + resize frame untuk hemat quota.</p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={props.startCamera}
              className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Muat Ulang Kamera
            </button>
            <button
              type="button"
              onClick={props.handleStopCamera}
              className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
            >
              Matikan Kamera
            </button>
          </div>
        </footer>
      </section>
    </main>
  )
}
