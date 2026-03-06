export interface TrainingConfigState {
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

export interface TrainingPipelineState {
  inferenceTarget: "serverless" | "dedicated"
  pendingVersion: string | null
  deployedVersion: string | null
  trainingReady: boolean
  lastTriggerAt: string | null
  lastStatusAt: string | null
  lastDeployAt: string | null
  lastError: string | null
  lastDeployError: string | null
  dedicatedDeploymentName: string | null
  dedicatedDeploymentDomain: string | null
  dedicatedDeploymentStatus: string | null
}

export interface TrainingSummaryState {
  queued: number
  uploading: number
  uploaded: number
  failed: number
}

export const EMPTY_SUMMARY: TrainingSummaryState = {
  queued: 0,
  uploading: 0,
  uploaded: 0,
  failed: 0
}

export function normalizeSummary(value: unknown): TrainingSummaryState {
  if (!value || typeof value !== "object") {
    return EMPTY_SUMMARY
  }

  const source = value as Record<string, unknown>
  const read = (status: keyof TrainingSummaryState) => {
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

export function normalizeConfig(value: unknown): TrainingConfigState | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const source = value as Record<string, unknown>
  return {
    uploadEndpointConfigured: Boolean(source.uploadEndpointConfigured),
    triggerEndpointConfigured: Boolean(source.triggerEndpointConfigured),
    statusEndpointConfigured: Boolean(source.statusEndpointConfigured),
    dedicatedInferenceEndpointConfigured: Boolean(source.dedicatedInferenceEndpointConfigured),
    deployEndpointConfigured: Boolean(source.deployEndpointConfigured),
    deployStatusEndpointConfigured: Boolean(source.deployStatusEndpointConfigured),
    dedicatedDeploymentEnabled: Boolean(source.dedicatedDeploymentEnabled),
    dedicatedDeploymentReady: Boolean(source.dedicatedDeploymentReady),
    autoDeployEnabled: Boolean(source.autoDeployEnabled),
    apiKeyConfigured: Boolean(source.apiKeyConfigured),
    minUploadedSamples:
      typeof source.minUploadedSamples === "number" && Number.isFinite(source.minUploadedSamples)
        ? Math.max(1, source.minUploadedSamples)
        : 100,
    recommendedMaxUploadedSamples:
      typeof source.recommendedMaxUploadedSamples === "number" &&
      Number.isFinite(source.recommendedMaxUploadedSamples)
        ? Math.max(1, source.recommendedMaxUploadedSamples)
        : 500
  }
}

export function normalizePipelineState(value: unknown): TrainingPipelineState | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const source = value as Record<string, unknown>
  const readDate = (key: string) =>
    typeof source[key] === "string" && String(source[key]).trim().length > 0
      ? String(source[key])
      : null

  return {
    inferenceTarget: source.inferenceTarget === "dedicated" ? "dedicated" : "serverless",
    pendingVersion:
      typeof source.pendingVersion === "string" && source.pendingVersion.trim().length > 0
        ? source.pendingVersion
        : null,
    deployedVersion:
      typeof source.deployedVersion === "string" && source.deployedVersion.trim().length > 0
        ? source.deployedVersion
        : null,
    trainingReady: Boolean(source.trainingReady),
    lastTriggerAt: readDate("lastTriggerAt"),
    lastStatusAt: readDate("lastStatusAt"),
    lastDeployAt: readDate("lastDeployAt"),
    lastError:
      typeof source.lastError === "string" && source.lastError.trim().length > 0 ? source.lastError : null,
    lastDeployError:
      typeof source.lastDeployError === "string" && source.lastDeployError.trim().length > 0
        ? source.lastDeployError
        : null,
    dedicatedDeploymentName:
      typeof source.dedicatedDeploymentName === "string" &&
      source.dedicatedDeploymentName.trim().length > 0
        ? source.dedicatedDeploymentName
        : null,
    dedicatedDeploymentDomain:
      typeof source.dedicatedDeploymentDomain === "string" &&
      source.dedicatedDeploymentDomain.trim().length > 0
        ? source.dedicatedDeploymentDomain
        : null,
    dedicatedDeploymentStatus:
      typeof source.dedicatedDeploymentStatus === "string" &&
      source.dedicatedDeploymentStatus.trim().length > 0
        ? source.dedicatedDeploymentStatus
        : null
  }
}
