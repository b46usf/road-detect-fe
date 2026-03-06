"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import TrainingHeader from "@/components/admin/training/training-header"
import TrainingPipelinePanel from "@/components/admin/training/training-pipeline-panel"
import TrainingSamplesPanel from "@/components/admin/training/training-samples-panel"
import TrainingUploadForm from "@/components/admin/training/training-upload-form"
import {
  clearAdminSession,
  readAdminSession,
  type AdminSession
} from "@/lib/admin-storage"
import { confirmRoadsterAction } from "@/lib/ui/roadster-swal"
import type {
  CreateTrainingSampleInput,
  TrainingSample,
  TrainingSampleStatus
} from "@/lib/training-types"

interface TrainingConfigState {
  uploadEndpointConfigured: boolean
  triggerEndpointConfigured: boolean
  apiKeyConfigured: boolean
}

interface TrainingSummaryState {
  queued: number
  uploading: number
  uploaded: number
  failed: number
}

const EMPTY_SUMMARY: TrainingSummaryState = {
  queued: 0,
  uploading: 0,
  uploaded: 0,
  failed: 0
}

function normalizeSummary(value: unknown): TrainingSummaryState {
  if (!value || typeof value !== "object") {
    return EMPTY_SUMMARY
  }

  const source = value as Record<string, unknown>
  const read = (status: TrainingSampleStatus) => {
    const raw = source[status]
    return typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, raw) : 0
  }

  return {
    queued: read("queued"),
    uploading: read("uploading"),
    uploaded: read("uploaded"),
    failed: read("failed")
  }
}

function normalizeConfig(value: unknown): TrainingConfigState | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const source = value as Record<string, unknown>
  return {
    uploadEndpointConfigured: Boolean(source.uploadEndpointConfigured),
    triggerEndpointConfigured: Boolean(source.triggerEndpointConfigured),
    apiKeyConfigured: Boolean(source.apiKeyConfigured)
  }
}

export default function AdminTrainingPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<AdminSession | null>(null)
  const [samples, setSamples] = useState<TrainingSample[]>([])
  const [summary, setSummary] = useState<TrainingSummaryState>(EMPTY_SUMMARY)
  const [config, setConfig] = useState<TrainingConfigState | null>(null)
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [pipelineMessage, setPipelineMessage] = useState<string | null>(null)
  const [isSavingSample, setIsSavingSample] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [runningAction, setRunningAction] = useState<"upload" | "retry" | "trigger" | null>(null)

  const loadTrainingData = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/training/samples", {
        method: "GET",
        cache: "no-store"
      })

      const payload: unknown = await response.json()
      const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {}
      const nextSamples = Array.isArray(body.samples) ? (body.samples as TrainingSample[]) : []

      setSamples(nextSamples)
      setSummary(normalizeSummary(body.summary))
      setConfig(normalizeConfig(body.config))

      if (!response.ok) {
        const errorObject =
          body.error && typeof body.error === "object" ? (body.error as Record<string, unknown>) : {}
        const message =
          typeof errorObject.message === "string" && errorObject.message.trim().length > 0
            ? errorObject.message
            : "Gagal memuat data training."
        setPipelineMessage(message)
      }
    } catch {
      setPipelineMessage("Gagal terhubung ke endpoint training.")
    }
  }, [])

  const bootstrapPage = useCallback(async () => {
    const currentSession = readAdminSession()
    if (!currentSession) {
      router.replace("/admin/login")
      return
    }

    setSession(currentSession)
    await loadTrainingData()
    setReady(true)
  }, [loadTrainingData, router])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void bootstrapPage()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [bootstrapPage])

  const handleLogout = useCallback(() => {
    clearAdminSession()
    router.replace("/admin/login")
  }, [router])

  const handleSaveSample = useCallback(
    async (input: CreateTrainingSampleInput) => {
      setIsSavingSample(true)
      setFormMessage(null)
      try {
        const response = await fetch("/api/admin/training/samples", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify(input)
        })

        const payload: unknown = await response.json()
        const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {}
        if (!response.ok || body.ok !== true) {
          const errorObject =
            body.error && typeof body.error === "object" ? (body.error as Record<string, unknown>) : {}
          const message =
            typeof errorObject.message === "string" && errorObject.message.trim().length > 0
              ? errorObject.message
              : "Gagal menyimpan sample training."
          setFormMessage(message)
          return
        }

        const message =
          typeof body.message === "string" && body.message.trim().length > 0
            ? body.message
            : "Sample training berhasil disimpan."
        setFormMessage(message)
        await loadTrainingData()
      } catch {
        setFormMessage("Gagal terhubung ke endpoint simpan sample.")
      } finally {
        setIsSavingSample(false)
      }
    },
    [loadTrainingData]
  )

  const handleDeleteSample = useCallback(
    async (sampleId: string) => {
      const confirmed = await confirmRoadsterAction({
        title: "Hapus sample training ini?",
        text: "Image file di public/img/training dan metadata JSON akan dihapus permanen.",
        confirmButtonText: "Ya, Hapus"
      })
      if (!confirmed) {
        return
      }

      setDeletingId(sampleId)
      setPipelineMessage(null)
      try {
        const response = await fetch(`/api/admin/training/samples?id=${encodeURIComponent(sampleId)}`, {
          method: "DELETE"
        })

        const payload: unknown = await response.json()
        const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {}
        if (!response.ok || body.ok !== true) {
          const errorObject =
            body.error && typeof body.error === "object" ? (body.error as Record<string, unknown>) : {}
          const message =
            typeof errorObject.message === "string" && errorObject.message.trim().length > 0
              ? errorObject.message
              : "Gagal menghapus sample."
          setPipelineMessage(message)
          return
        }

        setPipelineMessage("Sample training berhasil dihapus.")
        await loadTrainingData()
      } catch {
        setPipelineMessage("Gagal menghapus sample training.")
      } finally {
        setDeletingId(null)
      }
    },
    [loadTrainingData]
  )

  const callPipelineAction = useCallback(
    async (action: "upload_pending" | "retry_failed" | "trigger_training", loadingKey: "upload" | "retry" | "trigger") => {
      setRunningAction(loadingKey)
      setPipelineMessage(null)
      try {
        const response = await fetch("/api/admin/training/pipeline", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({ action })
        })

        const payload: unknown = await response.json()
        const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {}
        const message =
          typeof body.message === "string" && body.message.trim().length > 0
            ? body.message
            : response.ok
              ? "Pipeline action selesai."
              : "Pipeline action gagal."

        setPipelineMessage(message)
        await loadTrainingData()
      } catch {
        setPipelineMessage("Gagal menjalankan pipeline training.")
      } finally {
        setRunningAction(null)
      }
    },
    [loadTrainingData]
  )

  const totals = useMemo(
    () => ({
      total: samples.length,
      queued: summary.queued + summary.uploading,
      uploaded: summary.uploaded,
      failed: summary.failed
    }),
    [samples.length, summary.failed, summary.queued, summary.uploaded, summary.uploading]
  )

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-slate-100 [font-family:var(--font-geist-sans)]">
        <p className="text-sm text-slate-300">Memuat modul training admin...</p>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100 [font-family:var(--font-geist-sans)]">
      <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6">
        <TrainingHeader
          username={session?.username ?? null}
          totalSamples={totals.total}
          queued={totals.queued}
          uploaded={totals.uploaded}
          failed={totals.failed}
          onLogout={handleLogout}
        />

        <TrainingUploadForm
          onSubmit={handleSaveSample}
          isSubmitting={isSavingSample}
          statusMessage={formMessage}
        />

        <TrainingPipelinePanel
          config={config}
          pendingCount={totals.queued}
          failedCount={totals.failed}
          onUploadPending={() => callPipelineAction("upload_pending", "upload")}
          onRetryFailed={() => callPipelineAction("retry_failed", "retry")}
          onTriggerTraining={() => callPipelineAction("trigger_training", "trigger")}
          runningAction={runningAction}
          statusMessage={pipelineMessage}
        />

        <TrainingSamplesPanel
          samples={samples}
          deletingId={deletingId}
          onDelete={handleDeleteSample}
        />
      </section>
    </main>
  )
}
