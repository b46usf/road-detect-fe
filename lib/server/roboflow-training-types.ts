import type { TrainingPipelineRunSummary } from "@/lib/training-types"
import type { TrainingUploadAttemptResult } from "@/lib/server/roboflow-training-utils"

export interface UploadPendingSamplesResult {
  ok: boolean
  message: string
  summary: TrainingPipelineRunSummary
  attempts: TrainingUploadAttemptResult[]
}

export interface TriggerTrainingResult {
  ok: boolean
  status: number
  message: string
  response: unknown
}

export interface SyncTrainingStatusResult {
  ok: boolean
  status: number
  ready: boolean
  message: string
  response: unknown
}

export interface DeployTrainingResult {
  ok: boolean
  status: number
  message: string
  response: unknown
}

export interface TrainingTriggerPolicyState {
  uploadedCount: number
  minUploadedSamples: number
  recommendedMaxUploadedSamples: number
  canTriggerTraining: boolean
}

export interface TrainingPipelineConfigState {
  uploadEndpointConfigured: boolean
  triggerEndpointConfigured: boolean
  statusEndpointConfigured: boolean
  dedicatedInferenceEndpointConfigured: boolean
  deployEndpointConfigured: boolean
  deployStatusEndpointConfigured: boolean
  dedicatedDeploymentEnabled: boolean
  dedicatedDeploymentReady: boolean
  autoDeployEnabled: boolean
  apiKeyConfigured: boolean
  minUploadedSamples: number
  recommendedMaxUploadedSamples: number
}
