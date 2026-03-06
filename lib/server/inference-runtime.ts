import {
  getRoboflowDedicatedInferenceEndpoint,
  getServerRoboflowInferenceEndpoint,
  shouldUseDedicatedDeploymentRouting
} from "@/lib/env/server"
import { getTrainingPipelineConfigState } from "@/lib/server/roboflow-training"
import { readTrainingPipelineState, type InferenceTarget } from "@/lib/server/training-pipeline-state"

export interface DedicatedInferenceHealthStatus {
  configured: boolean
  reachable: boolean
  checkedAt: string
  latencyMs: number | null
  httpStatus: number | null
  endpoint: string | null
  message: string
}

export interface InferenceRuntimeSnapshot {
  target: InferenceTarget
  activeEndpoint: string | null
  dedicatedInferenceEndpoint: string | null
  dedicatedInferenceConfigured: boolean
  dedicatedDeploymentEnabled: boolean
  dedicatedDeploymentReady: boolean
  dedicatedDeploymentDomain: string | null
  dedicatedDeploymentStatus: string | null
  health: DedicatedInferenceHealthStatus | null
}

const HEALTH_CHECK_TIMEOUT_MS = 3500

function sanitizeEndpoint(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) {
    return null
  }

  try {
    const url = new URL(rawUrl)
    url.searchParams.delete("api_key")
    return url.toString()
  } catch {
    return rawUrl
  }
}

function buildManagedDedicatedEndpoint(pipelineState: Awaited<ReturnType<typeof readTrainingPipelineState>>): string | null {
  if (
    shouldUseDedicatedDeploymentRouting() &&
    pipelineState.dedicatedDeploymentDomain &&
    pipelineState.deployedVersion
  ) {
    return `https://${pipelineState.dedicatedDeploymentDomain}`
  }

  return null
}

function isReachableStatus(status: number): boolean {
  return status >= 100 && status <= 599
}

export async function checkDedicatedInferenceHealth(): Promise<DedicatedInferenceHealthStatus> {
  const endpoint = getRoboflowDedicatedInferenceEndpoint()
  const checkedAt = new Date().toISOString()

  if (!endpoint) {
    return {
      configured: false,
      reachable: false,
      checkedAt,
      latencyMs: null,
      httpStatus: null,
      endpoint: null,
      message: "ROBOFLOW_DEDICATED_INFERENCE_ENDPOINT belum dikonfigurasi."
    }
  }

  const startedAt = Date.now()
  try {
    const response = await fetch(endpoint, {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS)
    })

    return {
      configured: true,
      reachable: isReachableStatus(response.status),
      checkedAt,
      latencyMs: Date.now() - startedAt,
      httpStatus: response.status,
      endpoint: sanitizeEndpoint(endpoint),
      message: `Endpoint merespons HTTP ${response.status}.`
    }
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : "Endpoint dedicated tidak merespons."

    return {
      configured: true,
      reachable: false,
      checkedAt,
      latencyMs: Date.now() - startedAt,
      httpStatus: null,
      endpoint: sanitizeEndpoint(endpoint),
      message
    }
  }
}

export async function getInferenceRuntimeSnapshot(params?: {
  includeHealth?: boolean
}): Promise<InferenceRuntimeSnapshot> {
  const includeHealth = params?.includeHealth === true
  const pipelineState = await readTrainingPipelineState()
  const config = getTrainingPipelineConfigState()
  const dedicatedInferenceEndpoint = getRoboflowDedicatedInferenceEndpoint()
  const managedDedicatedEndpoint = buildManagedDedicatedEndpoint(pipelineState)
  const activeEndpoint =
    pipelineState.inferenceTarget === "dedicated"
      ? sanitizeEndpoint(dedicatedInferenceEndpoint || managedDedicatedEndpoint)
      : sanitizeEndpoint(getServerRoboflowInferenceEndpoint())

  return {
    target: pipelineState.inferenceTarget,
    activeEndpoint,
    dedicatedInferenceEndpoint: sanitizeEndpoint(dedicatedInferenceEndpoint),
    dedicatedInferenceConfigured: Boolean(dedicatedInferenceEndpoint),
    dedicatedDeploymentEnabled: config.dedicatedDeploymentEnabled,
    dedicatedDeploymentReady: config.dedicatedDeploymentReady,
    dedicatedDeploymentDomain: pipelineState.dedicatedDeploymentDomain,
    dedicatedDeploymentStatus: pipelineState.dedicatedDeploymentStatus,
    health: includeHealth ? await checkDedicatedInferenceHealth() : null
  }
}
