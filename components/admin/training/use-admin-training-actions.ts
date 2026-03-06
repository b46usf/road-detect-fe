import { useCallback } from "react"
import {
  createTrainingSampleRequest,
  deleteTrainingSampleRequest,
  runTrainingPipelineRequest,
  updateTrainingAnnotationsRequest
} from "@/components/admin/training/training-admin-api"
import { confirmRoadsterAction } from "@/lib/ui/roadster-swal"
import type { CreateTrainingSampleInput, TrainingAnnotation, TrainingSample } from "@/lib/training-types"

export type RunningTrainingAction =
  | "upload"
  | "retry"
  | "trigger"
  | "sync"
  | "resume"
  | "deployStatus"
  | "target"
  | "health"
  | null

export type TrainingPipelineAction =
  | "upload_pending"
  | "retry_failed"
  | "trigger_training"
  | "sync_training_status"
  | "set_inference_target"
  | "resume_deployment"
  | "check_deployment_status"

interface UseAdminTrainingActionsParams {
  loadTrainingData: () => Promise<void>
  loadInferenceRuntime: (options?: { silent?: boolean }) => Promise<void>
  setFormMessage: React.Dispatch<React.SetStateAction<string | null>>
  setPipelineMessage: React.Dispatch<React.SetStateAction<string | null>>
  setIsSavingSample: React.Dispatch<React.SetStateAction<boolean>>
  setDeletingId: React.Dispatch<React.SetStateAction<string | null>>
  setRunningAction: React.Dispatch<React.SetStateAction<RunningTrainingAction>>
  setEditorSample: React.Dispatch<React.SetStateAction<TrainingSample | null>>
  setIsSavingAnnotations: React.Dispatch<React.SetStateAction<boolean>>
}

export function useAdminTrainingActions(params: UseAdminTrainingActionsParams) {
  const {
    loadTrainingData,
    loadInferenceRuntime,
    setFormMessage,
    setPipelineMessage,
    setIsSavingSample,
    setDeletingId,
    setRunningAction,
    setEditorSample,
    setIsSavingAnnotations
  } = params

  const handleSaveSample = useCallback(
    async (input: CreateTrainingSampleInput) => {
      setIsSavingSample(true)
      setFormMessage(null)
      try {
        const result = await createTrainingSampleRequest(input)
        setFormMessage(result.message)
        if (result.ok) {
          await loadTrainingData()
        }
      } catch {
        setFormMessage("Gagal terhubung ke endpoint simpan sample.")
      } finally {
        setIsSavingSample(false)
      }
    },
    [loadTrainingData, setFormMessage, setIsSavingSample]
  )

  const handleDeleteSample = useCallback(
    async (sampleId: string) => {
      const confirmed = await confirmRoadsterAction({
        title: "Hapus sample training ini?",
        text: "Image sample di storage server dan metadata training akan dihapus permanen.",
        confirmButtonText: "Ya, Hapus"
      })
      if (!confirmed) {
        return
      }

      setDeletingId(sampleId)
      setPipelineMessage(null)
      try {
        const result = await deleteTrainingSampleRequest(sampleId)
        setPipelineMessage(result.message)
        if (result.ok) {
          await loadTrainingData()
        }
      } catch {
        setPipelineMessage("Gagal menghapus sample training.")
      } finally {
        setDeletingId(null)
      }
    },
    [loadTrainingData, setDeletingId, setPipelineMessage]
  )

  const handleEditAnnotations = useCallback(async (sample: TrainingSample) => {
    setEditorSample(sample)
  }, [setEditorSample])

  const handleSaveAnnotations = useCallback(
    async (sample: TrainingSample, annotations: TrainingAnnotation[]) => {
      setIsSavingAnnotations(true)
      setPipelineMessage(null)

      try {
        const result = await updateTrainingAnnotationsRequest(sample.id, annotations)
        setPipelineMessage(result.message)
        if (result.ok) {
          setEditorSample(null)
          await loadTrainingData()
        }
      } catch {
        setPipelineMessage("Gagal terhubung ke endpoint update anotasi.")
      } finally {
        setIsSavingAnnotations(false)
      }
    },
    [loadTrainingData, setEditorSample, setIsSavingAnnotations, setPipelineMessage]
  )

  const callPipelineAction = useCallback(
    async (
      action: TrainingPipelineAction,
      loadingKey: Exclude<RunningTrainingAction, null>,
      options?: { background?: boolean; payload?: Record<string, unknown>; refreshRuntime?: boolean }
    ) => {
      const background = options?.background === true
      if (!background) {
        setRunningAction(loadingKey)
        setPipelineMessage(null)
      }

      try {
        const result = await runTrainingPipelineRequest(action, options?.payload)
        if (!background || !result.ok) {
          setPipelineMessage(result.message)
        }
        await loadTrainingData()
        if (!background || options?.refreshRuntime) {
          await loadInferenceRuntime({ silent: background })
        }
      } catch {
        if (!background) {
          setPipelineMessage("Gagal menjalankan pipeline training.")
        }
      } finally {
        if (!background) {
          setRunningAction(null)
        }
      }
    },
    [loadInferenceRuntime, loadTrainingData, setPipelineMessage, setRunningAction]
  )

  const handleCheckInferenceHealth = useCallback(async () => {
    setRunningAction("health")
    setPipelineMessage(null)
    try {
      await loadInferenceRuntime()
    } finally {
      setRunningAction(null)
    }
  }, [loadInferenceRuntime, setPipelineMessage, setRunningAction])

  return {
    handleSaveSample,
    handleDeleteSample,
    handleEditAnnotations,
    handleSaveAnnotations,
    callPipelineAction,
    handleCheckInferenceHealth,
    handleUploadPending: () => callPipelineAction("upload_pending", "upload"),
    handleRetryFailed: () => callPipelineAction("retry_failed", "retry"),
    handleTriggerTraining: () => callPipelineAction("trigger_training", "trigger"),
    handleSyncTrainingStatus: () => callPipelineAction("sync_training_status", "sync"),
    handleSetInferenceTarget: (target: "serverless" | "dedicated") =>
      callPipelineAction("set_inference_target", "target", {
        payload: { target },
        refreshRuntime: true
      }),
    handleResumeDeployment: () =>
      callPipelineAction("resume_deployment", "resume", {
        refreshRuntime: true
      }),
    handleCheckDeploymentStatus: () =>
      callPipelineAction("check_deployment_status", "deployStatus", {
        refreshRuntime: true
      })
  }
}
