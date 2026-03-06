"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { EMPTY_SUMMARY } from "@/components/admin/training/training-page-state"
import {
  fetchInferenceRuntimeState,
  fetchTrainingSamplesState
} from "@/components/admin/training/training-admin-api"
import {
  useAdminTrainingActions,
  type RunningTrainingAction
} from "@/components/admin/training/use-admin-training-actions"
import {
  clearAdminSession,
  readAdminSession,
  type AdminSession
} from "@/lib/admin-storage"
import type { InferenceRuntimeState } from "@/lib/inference-runtime-state"
import type {
  CreateTrainingSampleInput,
  TrainingAnnotation,
  TrainingSample
} from "@/lib/training-types"
import type {
  TrainingConfigState,
  TrainingPipelineState,
  TrainingSummaryState
} from "@/components/admin/training/training-page-state"

export function useAdminTrainingPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<AdminSession | null>(null)
  const [samples, setSamples] = useState<TrainingSample[]>([])
  const [summary, setSummary] = useState<TrainingSummaryState>(EMPTY_SUMMARY)
  const [config, setConfig] = useState<TrainingConfigState | null>(null)
  const [pipelineState, setPipelineState] = useState<TrainingPipelineState | null>(null)
  const [runtime, setRuntime] = useState<InferenceRuntimeState | null>(null)
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [pipelineMessage, setPipelineMessage] = useState<string | null>(null)
  const [isSavingSample, setIsSavingSample] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [runningAction, setRunningAction] = useState<RunningTrainingAction>(null)
  const [editorSample, setEditorSample] = useState<TrainingSample | null>(null)
  const [isSavingAnnotations, setIsSavingAnnotations] = useState(false)

  const loadTrainingData = useCallback(async () => {
    try {
      const result = await fetchTrainingSamplesState()
      setSamples(result.samples)
      setSummary(result.summary)
      setConfig(result.config)
      setPipelineState(result.pipelineState)

      if (!result.ok) {
        setPipelineMessage(result.message)
      }
    } catch {
      setPipelineMessage("Gagal terhubung ke endpoint training.")
    }
  }, [])

  const loadInferenceRuntime = useCallback(async (options?: { silent?: boolean }) => {
    try {
      const result = await fetchInferenceRuntimeState()
      setRuntime(result.runtime)

      if (!result.ok && options?.silent !== true) {
        setPipelineMessage(result.message)
      } else if (!options?.silent && result.runtime?.health?.message) {
        setPipelineMessage(result.runtime.health.message)
      }
    } catch {
      if (options?.silent !== true) {
        setPipelineMessage("Gagal memeriksa runtime inference.")
      }
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
    await loadInferenceRuntime({ silent: true })
    setReady(true)
  }, [loadInferenceRuntime, loadTrainingData, router])

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

  const actions = useAdminTrainingActions({
    loadTrainingData,
    loadInferenceRuntime,
    setFormMessage,
    setPipelineMessage,
    setIsSavingSample,
    setDeletingId,
    setRunningAction,
    setEditorSample,
    setIsSavingAnnotations
  })

  useEffect(() => {
    if (
      !ready ||
      !config?.autoDeployEnabled ||
      !config.dedicatedDeploymentReady ||
      !pipelineState?.pendingVersion ||
      pipelineState.lastDeployAt
    ) {
      return
    }

    const intervalId = window.setInterval(() => {
      void actions.callPipelineAction("sync_training_status", "sync", { background: true })
    }, 20000)

    return () => window.clearInterval(intervalId)
  }, [
    actions,
    config?.autoDeployEnabled,
    config?.dedicatedDeploymentReady,
    pipelineState?.lastDeployAt,
    pipelineState?.pendingVersion,
    ready
  ])

  const totals = useMemo(
    () => ({
      total: samples.length,
      queued: summary.queued + summary.uploading,
      uploaded: summary.uploaded,
      failed: summary.failed
    }),
    [samples.length, summary.failed, summary.queued, summary.uploaded, summary.uploading]
  )

  return {
    ready,
    session,
    samples,
    config,
    pipelineState,
    runtime,
    formMessage,
    pipelineMessage,
    isSavingSample,
    deletingId,
    runningAction,
    editorSample,
    isSavingAnnotations,
    totals,
    setEditorSample,
    handleLogout,
    handleSaveSample: actions.handleSaveSample as (input: CreateTrainingSampleInput) => Promise<void>,
    handleDeleteSample: actions.handleDeleteSample,
    handleEditAnnotations: actions.handleEditAnnotations,
    handleSaveAnnotations: actions.handleSaveAnnotations as (
      sample: TrainingSample,
      annotations: TrainingAnnotation[]
    ) => Promise<void>,
    handleUploadPending: actions.handleUploadPending,
    handleRetryFailed: actions.handleRetryFailed,
    handleTriggerTraining: actions.handleTriggerTraining,
    handleSyncTrainingStatus: actions.handleSyncTrainingStatus,
    handleSetInferenceTarget: actions.handleSetInferenceTarget,
    handleCheckInferenceHealth: actions.handleCheckInferenceHealth,
    handleResumeDeployment: actions.handleResumeDeployment,
    handleCheckDeploymentStatus: actions.handleCheckDeploymentStatus
  }
}
