import type { InferenceRuntimeState } from "@/lib/inference-runtime-state"

interface TrainingInferenceRoutingCardProps {
  inferenceTarget: "serverless" | "dedicated"
  dedicatedInferenceEndpointConfigured: boolean
  runtime: InferenceRuntimeState | null
  runningAction: "target" | "health" | string | null
  onSetInferenceTarget: (target: "serverless" | "dedicated") => Promise<void>
  onCheckInferenceHealth: () => Promise<void>
}

function healthTone(reachable: boolean | null): string {
  if (reachable === null) {
    return "text-slate-200"
  }

  return reachable ? "text-emerald-200" : "text-rose-200"
}

export default function TrainingInferenceRoutingCard(props: TrainingInferenceRoutingCardProps) {
  const {
    inferenceTarget,
    dedicatedInferenceEndpointConfigured,
    runtime,
    runningAction,
    onSetInferenceTarget,
    onCheckInferenceHealth
  } = props

  const health = runtime?.health ?? null

  return (
    <div className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-400/10 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/90">Inference Routing</p>
          <p className="mt-1 text-xs text-cyan-50/85">
            Toggle ini menentukan `/api/roboflow` memakai workflow serverless default atau endpoint dedicated yang
            sudah diisi di `.env`.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={runningAction !== null || inferenceTarget === "serverless"}
            onClick={() => {
              void onSetInferenceTarget("serverless")
            }}
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {runningAction === "target" && inferenceTarget !== "serverless" ? "Switching..." : "Gunakan Serverless"}
          </button>
          <button
            type="button"
            disabled={runningAction !== null || !dedicatedInferenceEndpointConfigured || inferenceTarget === "dedicated"}
            onClick={() => {
              void onSetInferenceTarget("dedicated")
            }}
            className="rounded-lg border border-cyan-300/40 bg-cyan-300/15 px-3 py-2 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {runningAction === "target" && inferenceTarget !== "dedicated" ? "Switching..." : "Gunakan Dedicated"}
          </button>
          <button
            type="button"
            disabled={runningAction !== null || !dedicatedInferenceEndpointConfigured}
            onClick={() => {
              void onCheckInferenceHealth()
            }}
            className="rounded-lg border border-sky-300/40 bg-sky-400/15 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-sky-400/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {runningAction === "health" ? "Pinging..." : "Ping Dedicated"}
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <p className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-slate-200">
          Active Endpoint: {runtime?.activeEndpoint ?? "-"}
        </p>
        <p className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-slate-200">
          Dedicated Endpoint: {runtime?.dedicatedInferenceEndpoint ?? "-"}
        </p>
        <p className={`rounded-lg border border-white/10 bg-black/35 px-3 py-2 ${healthTone(health ? health.reachable : null)}`}>
          Dedicated Health: {health ? (health.reachable ? "Online" : "Offline") : "Unchecked"}
        </p>
        <p className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-slate-200">
          Last Health Check: {health?.checkedAt ? new Date(health.checkedAt).toLocaleString("id-ID") : "-"}
        </p>
      </div>

      {health && (
        <p className={`mt-2 rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs ${healthTone(health.reachable)}`}>
          {health.message}
          {health.httpStatus !== null ? ` HTTP ${health.httpStatus}.` : ""}
          {health.latencyMs !== null ? ` ${health.latencyMs} ms.` : ""}
        </p>
      )}
    </div>
  )
}
