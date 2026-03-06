"use client"

import type { InferenceRuntimeState } from "@/lib/inference-runtime-state"
import {
  DEFAULT_TRAINING_MIN_UPLOADED_SAMPLES,
  DEFAULT_TRAINING_RECOMMENDED_MAX_UPLOADED_SAMPLES
} from "@/lib/env/shared"
import type {
  TrainingConfigState,
  TrainingPipelineState
} from "@/components/admin/training/training-page-state"
import TrainingInferenceRoutingCard from "@/components/admin/training/training-inference-routing-card"

interface TrainingPipelinePanelProps {
  config: TrainingConfigState | null
  pendingCount: number
  uploadedCount: number
  failedCount: number
  pipelineState: TrainingPipelineState | null
  runtime: InferenceRuntimeState | null
  onUploadPending: () => Promise<void>
  onRetryFailed: () => Promise<void>
  onTriggerTraining: () => Promise<void>
  onSyncTrainingStatus: () => Promise<void>
  onSetInferenceTarget: (target: "serverless" | "dedicated") => Promise<void>
  onCheckInferenceHealth: () => Promise<void>
  onResumeDeployment: () => Promise<void>
  onCheckDeploymentStatus: () => Promise<void>
  runningAction:
    | "upload"
    | "retry"
    | "trigger"
    | "sync"
    | "resume"
    | "deployStatus"
    | "target"
    | "health"
    | null
  statusMessage: string | null
}

function indicatorTone(active: boolean): string {
  return active ? "text-emerald-200" : "text-rose-200"
}

export default function TrainingPipelinePanel(props: TrainingPipelinePanelProps) {
  const {
    config,
    pendingCount,
    uploadedCount,
    failedCount,
    pipelineState,
    runtime,
    onUploadPending,
    onRetryFailed,
    onTriggerTraining,
    onSyncTrainingStatus,
    onSetInferenceTarget,
    onCheckInferenceHealth,
    onResumeDeployment,
    onCheckDeploymentStatus,
    runningAction,
    statusMessage
  } = props

  const minUploadedSamples = config?.minUploadedSamples ?? DEFAULT_TRAINING_MIN_UPLOADED_SAMPLES
  const recommendedMaxUploadedSamples =
    config?.recommendedMaxUploadedSamples ?? DEFAULT_TRAINING_RECOMMENDED_MAX_UPLOADED_SAMPLES
  const triggerLocked = uploadedCount < minUploadedSamples
  const dedicatedDeploymentEnabled = Boolean(config?.dedicatedDeploymentEnabled)
  const dedicatedDeploymentReady = Boolean(config?.dedicatedDeploymentReady)
  const dedicatedInferenceEndpointConfigured = Boolean(config?.dedicatedInferenceEndpointConfigured)
  const inferenceTarget = runtime?.target ?? pipelineState?.inferenceTarget ?? "serverless"

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:p-5">
      <h2 className="text-lg font-semibold text-slate-100">Pipeline Roboflow Training</h2>
      <p className="mt-1 text-sm text-slate-300">
        Upload sample beranotasi dulu ke dataset. Training baru dijalankan manual setelah sample uploaded
        terkumpul cukup, bukan setiap kali upload.
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

      <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <p className={`rounded-lg border border-white/10 bg-black/35 px-3 py-2 ${indicatorTone(Boolean(config?.statusEndpointConfigured))}`}>
          Status Endpoint: {config?.statusEndpointConfigured ? "Configured" : "Missing"}
        </p>
        <p className={`rounded-lg border border-white/10 bg-black/35 px-3 py-2 ${indicatorTone(dedicatedInferenceEndpointConfigured)}`}>
          Dedicated Inference Endpoint: {dedicatedInferenceEndpointConfigured ? "Configured" : "Missing"}
        </p>
        <p className={`rounded-lg border border-white/10 bg-black/35 px-3 py-2 ${indicatorTone(Boolean(config?.deployEndpointConfigured))}`}>
          Resume Endpoint: {config?.deployEndpointConfigured ? "Configured" : "Missing"}
        </p>
        <p className={`rounded-lg border border-white/10 bg-black/35 px-3 py-2 ${indicatorTone(Boolean(config?.deployStatusEndpointConfigured))}`}>
          Deploy Status Endpoint: {config?.deployStatusEndpointConfigured ? "Configured" : "Missing"}
        </p>
      </div>

      <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <p className={`rounded-lg border border-white/10 bg-black/35 px-3 py-2 ${indicatorTone(dedicatedDeploymentEnabled)}`}>
          Dedicated Deployment: {dedicatedDeploymentEnabled ? "Enabled" : "Disabled"}
        </p>
        <p className={`rounded-lg border border-white/10 bg-black/35 px-3 py-2 ${indicatorTone(dedicatedDeploymentReady)}`}>
          Dedicated Deploy Ready: {dedicatedDeploymentReady ? "Ready" : "Waiting Config"}
        </p>
        <p className={`rounded-lg border border-white/10 bg-black/35 px-3 py-2 ${indicatorTone(Boolean(config?.autoDeployEnabled))}`}>
          Auto Deploy: {config?.autoDeployEnabled ? "Enabled" : "Disabled"}
        </p>
        <p className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-cyan-100">
          Active Inference Target: {inferenceTarget === "dedicated" ? "Dedicated" : "Serverless"}
        </p>
      </div>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <p className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-slate-200">
          Uploaded: {uploadedCount} sample
        </p>
        <p className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-slate-200">
          Minimum trigger: {minUploadedSamples} sample
        </p>
        <p className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-slate-200">
          Rekomendasi batch: {recommendedMaxUploadedSamples} sample
        </p>
      </div>

      <p className="mt-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-slate-300">
        Rule pipeline: `upload_pending` kumpulkan 100-500 sample teranotasi, lalu baru `trigger_training`.
      </p>

      <TrainingInferenceRoutingCard
        inferenceTarget={inferenceTarget}
        dedicatedInferenceEndpointConfigured={dedicatedInferenceEndpointConfigured}
        runtime={runtime}
        runningAction={runningAction}
        onSetInferenceTarget={onSetInferenceTarget}
        onCheckInferenceHealth={onCheckInferenceHealth}
      />

      {!dedicatedDeploymentEnabled && (
        <p className="mt-2 rounded-lg border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
          Dedicated Deployment management masih OFF di `.env`. Ini tidak mengganggu toggle inference ke endpoint
          dedicated self-hosted.
        </p>
      )}

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <p className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-slate-200">
          Pending version: {pipelineState?.pendingVersion ?? "-"}
        </p>
        <p className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-slate-200">
          Ready: {pipelineState?.trainingReady ? "Yes" : "No"}
        </p>
        <p className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-slate-200">
          Last status: {pipelineState?.lastStatusAt ? new Date(pipelineState.lastStatusAt).toLocaleString("id-ID") : "-"}
        </p>
        <p className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-slate-200">
          Last deploy: {pipelineState?.lastDeployAt ? new Date(pipelineState.lastDeployAt).toLocaleString("id-ID") : "-"}
        </p>
      </div>

      <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <p className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-slate-200">
          Deployment: {pipelineState?.dedicatedDeploymentName ?? "-"}
        </p>
        <p className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-slate-200">
          Domain: {pipelineState?.dedicatedDeploymentDomain ?? "-"}
        </p>
        <p className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-slate-200">
          Deploy status: {pipelineState?.dedicatedDeploymentStatus ?? "-"}
        </p>
        <p className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-slate-200">
          Deployed version: {pipelineState?.deployedVersion ?? "-"}
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
          disabled={runningAction !== null || triggerLocked}
          onClick={() => {
            void onTriggerTraining()
          }}
          className="rounded-lg border border-emerald-300/40 bg-emerald-400/15 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {runningAction === "trigger"
            ? "Triggering..."
            : triggerLocked
              ? `Trigger Training (min ${minUploadedSamples})`
              : "Trigger Training"}
        </button>
        <button
          type="button"
          disabled={runningAction !== null || !pipelineState?.pendingVersion}
          onClick={() => {
            void onSyncTrainingStatus()
          }}
          className="rounded-lg border border-violet-300/40 bg-violet-400/15 px-3 py-2 text-xs font-semibold text-violet-100 transition hover:bg-violet-400/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {runningAction === "sync" ? "Syncing..." : "Cek Status Training"}
        </button>
        <button
          type="button"
          disabled={runningAction !== null || !dedicatedDeploymentReady}
          onClick={() => {
            void onResumeDeployment()
          }}
          className="rounded-lg border border-fuchsia-300/40 bg-fuchsia-400/15 px-3 py-2 text-xs font-semibold text-fuchsia-100 transition hover:bg-fuchsia-400/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {runningAction === "resume" ? "Resuming..." : "Resume Deployment"}
        </button>
        <button
          type="button"
          disabled={runningAction !== null || !dedicatedDeploymentReady}
          onClick={() => {
            void onCheckDeploymentStatus()
          }}
          className="rounded-lg border border-sky-300/40 bg-sky-400/15 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-sky-400/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {runningAction === "deployStatus" ? "Checking..." : "Cek Deployment Status"}
        </button>
      </div>

      {statusMessage && (
        <p className="mt-3 rounded-lg border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">
          {statusMessage}
        </p>
      )}

      {(pipelineState?.lastError || pipelineState?.lastDeployError) && (
        <p className="mt-3 rounded-lg border border-rose-300/25 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
          {pipelineState?.lastDeployError ?? pipelineState?.lastError}
        </p>
      )}
    </section>
  )
}
