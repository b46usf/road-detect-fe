"use client"

interface TrainingPipelineConfig {
  uploadEndpointConfigured: boolean
  triggerEndpointConfigured: boolean
  apiKeyConfigured: boolean
}

interface TrainingPipelinePanelProps {
  config: TrainingPipelineConfig | null
  pendingCount: number
  failedCount: number
  onUploadPending: () => Promise<void>
  onRetryFailed: () => Promise<void>
  onTriggerTraining: () => Promise<void>
  runningAction: "upload" | "retry" | "trigger" | null
  statusMessage: string | null
}

function indicatorTone(active: boolean): string {
  return active ? "text-emerald-200" : "text-rose-200"
}

export default function TrainingPipelinePanel(props: TrainingPipelinePanelProps) {
  const {
    config,
    pendingCount,
    failedCount,
    onUploadPending,
    onRetryFailed,
    onTriggerTraining,
    runningAction,
    statusMessage
  } = props

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:p-5">
      <h2 className="text-lg font-semibold text-slate-100">Pipeline Roboflow Training</h2>
      <p className="mt-1 text-sm text-slate-300">
        Jalankan upload sample queued lalu trigger training model dari panel admin.
      </p>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <p className={`rounded-lg border border-white/10 bg-black/35 px-3 py-2 ${indicatorTone(Boolean(config?.apiKeyConfigured))}`}>
          API Key: {config?.apiKeyConfigured ? "Configured" : "Missing"}
        </p>
        <p className={`rounded-lg border border-white/10 bg-black/35 px-3 py-2 ${indicatorTone(Boolean(config?.uploadEndpointConfigured))}`}>
          Upload Endpoint: {config?.uploadEndpointConfigured ? "Configured" : "Missing"}
        </p>
        <p className={`rounded-lg border border-white/10 bg-black/35 px-3 py-2 ${indicatorTone(Boolean(config?.triggerEndpointConfigured))}`}>
          Trigger Endpoint: {config?.triggerEndpointConfigured ? "Configured" : "Missing"}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={runningAction !== null || pendingCount <= 0}
          onClick={() => {
            void onUploadPending()
          }}
          className="rounded-lg border border-cyan-300/40 bg-cyan-400/15 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {runningAction === "upload" ? "Uploading..." : `Upload Pending (${pendingCount})`}
        </button>
        <button
          type="button"
          disabled={runningAction !== null || failedCount <= 0}
          onClick={() => {
            void onRetryFailed()
          }}
          className="rounded-lg border border-amber-300/40 bg-amber-400/15 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {runningAction === "retry" ? "Memproses..." : `Retry Failed (${failedCount})`}
        </button>
        <button
          type="button"
          disabled={runningAction !== null}
          onClick={() => {
            void onTriggerTraining()
          }}
          className="rounded-lg border border-emerald-300/40 bg-emerald-400/15 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {runningAction === "trigger" ? "Triggering..." : "Trigger Training"}
        </button>
      </div>

      {statusMessage && (
        <p className="mt-3 rounded-lg border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">
          {statusMessage}
        </p>
      )}
    </section>
  )
}
