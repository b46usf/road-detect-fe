import {
  getRoboflowDedicatedDeploymentName,
  getRoboflowDedicatedDeploymentStatusEndpoint,
  getRoboflowDedicatedInferenceEndpoint,
  getRoboflowTrainingTriggerEndpoint,
  getRoboflowTrainingUploadEndpoint,
  getServerRoboflowApiKey,
  getTrainingMinUploadedSamples,
  getTrainingRecommendedMaxUploadedSamples,
  isRoboflowDedicatedDeploymentEnabled,
  isRoboflowTrainingAutoDeployEnabled
} from "@/lib/env/server"
import { resolveTrainingDeployEndpoint, resolveTrainingStatusEndpoint } from "@/lib/server/roboflow-training-utils"
import type { TrainingSample, TrainingSampleStatus } from "@/lib/training-types"
import type {
  TrainingPipelineConfigState,
  TrainingTriggerPolicyState
} from "@/lib/server/roboflow-training-types"

export function getTrainingUploadEndpoint(): string {
  return getRoboflowTrainingUploadEndpoint()
}

export function getTrainingTriggerEndpoint(): string {
  return getRoboflowTrainingTriggerEndpoint()
}

export function getDedicatedDeploymentStatusEndpoint(): string {
  return getRoboflowDedicatedDeploymentStatusEndpoint()
}

export function getDedicatedDeploymentName(): string {
  return getRoboflowDedicatedDeploymentName()
}

export function getDedicatedInferenceEndpoint(): string {
  return getRoboflowDedicatedInferenceEndpoint()
}

export function isDedicatedDeploymentEnabled(): boolean {
  return isRoboflowDedicatedDeploymentEnabled()
}

export function getRoboflowApiKey(): string {
  return getServerRoboflowApiKey()
}

export function isAutoDeployEnabled(): boolean {
  return isRoboflowTrainingAutoDeployEnabled()
}

export function getTrainingPolicyThresholds() {
  return {
    minUploadedSamples: getTrainingMinUploadedSamples(),
    recommendedMaxUploadedSamples: getTrainingRecommendedMaxUploadedSamples()
  }
}

export function isDedicatedDeploymentConfigured(): boolean {
  return Boolean(
    resolveTrainingDeployEndpoint() &&
      getDedicatedDeploymentStatusEndpoint() &&
      getDedicatedDeploymentName()
  )
}

export function buildTrainingTriggerPolicy(uploadedCount: number): TrainingTriggerPolicyState {
  const { minUploadedSamples, recommendedMaxUploadedSamples } = getTrainingPolicyThresholds()

  return {
    uploadedCount,
    minUploadedSamples,
    recommendedMaxUploadedSamples,
    canTriggerTraining: uploadedCount >= minUploadedSamples
  }
}

export function getTrainingPipelineConfigState(): TrainingPipelineConfigState {
  const { minUploadedSamples, recommendedMaxUploadedSamples } = getTrainingPolicyThresholds()
  const dedicatedDeploymentEnabled = isDedicatedDeploymentEnabled()
  const dedicatedInferenceEndpointConfigured = Boolean(getDedicatedInferenceEndpoint())
  const deployEndpointConfigured = Boolean(resolveTrainingDeployEndpoint())
  const deployStatusEndpointConfigured = Boolean(getDedicatedDeploymentStatusEndpoint())
  const dedicatedDeploymentReady = dedicatedDeploymentEnabled && isDedicatedDeploymentConfigured()

  return {
    uploadEndpointConfigured: Boolean(getTrainingUploadEndpoint()),
    triggerEndpointConfigured: Boolean(getTrainingTriggerEndpoint()),
    statusEndpointConfigured: Boolean(
      resolveTrainingStatusEndpoint("pending") || getTrainingTriggerEndpoint()
    ),
    dedicatedInferenceEndpointConfigured,
    deployEndpointConfigured,
    deployStatusEndpointConfigured,
    dedicatedDeploymentEnabled,
    dedicatedDeploymentReady,
    autoDeployEnabled: isAutoDeployEnabled(),
    apiKeyConfigured: Boolean(getRoboflowApiKey()),
    minUploadedSamples,
    recommendedMaxUploadedSamples
  }
}

export function countSamplesByStatus(samples: TrainingSample[]): Record<TrainingSampleStatus, number> {
  return samples.reduce<Record<TrainingSampleStatus, number>>(
    (accumulator, sample) => {
      accumulator[sample.status] += 1
      return accumulator
    },
    {
      queued: 0,
      uploading: 0,
      uploaded: 0,
      failed: 0
    }
  )
}
