import {
  getDedicatedDeploymentName,
  getDedicatedDeploymentStatusEndpoint,
  getRoboflowApiKey,
  isAutoDeployEnabled,
  isDedicatedDeploymentConfigured,
  isDedicatedDeploymentEnabled
} from "@/lib/server/roboflow-training-config"
import {
  extractDedicatedDeploymentDomain,
  extractDedicatedDeploymentStatus,
  parseResponsePayload,
  parseTrainingHttpError,
  resolveTrainingDeployEndpoint
} from "@/lib/server/roboflow-training-utils"
import {
  patchTrainingPipelineState,
  readTrainingPipelineState,
  type TrainingPipelineState
} from "@/lib/server/training-pipeline-state"
import type { DeployTrainingResult } from "@/lib/server/roboflow-training-types"

export async function fetchDedicatedDeploymentInfo(): Promise<{
  ok: boolean
  status: number
  message: string
  response: unknown
  domain: string | null
  deploymentStatus: string | null
}> {
  const endpoint = getDedicatedDeploymentStatusEndpoint()
  const deploymentName = getDedicatedDeploymentName()
  if (!endpoint || !deploymentName) {
    return {
      ok: false,
      status: 0,
      message: "Dedicated Deployment endpoint/status belum dikonfigurasi lengkap.",
      response: null,
      domain: null,
      deploymentStatus: null
    }
  }

  const apiKey = getRoboflowApiKey()
  const url = new URL(endpoint)
  url.searchParams.set("api_key", apiKey)
  url.searchParams.set("deployment_name", deploymentName)

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store"
  })
  const payload = await parseResponsePayload(response)
  const domain = extractDedicatedDeploymentDomain(payload)
  const deploymentStatus = extractDedicatedDeploymentStatus(payload)

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: parseTrainingHttpError(response, payload),
      response: payload,
      domain,
      deploymentStatus
    }
  }

  return {
    ok: true,
    status: response.status,
    message: "Dedicated Deployment status berhasil diambil.",
    response: payload,
    domain,
    deploymentStatus
  }
}

async function executeDeployRequest(params: {
  version: string | null
}): Promise<DeployTrainingResult> {
  if (!isDedicatedDeploymentEnabled()) {
    return {
      ok: false,
      status: 0,
      message: "Dedicated Deployment sedang nonaktif. Aktifkan ROBOFLOW_USE_DEDICATED_DEPLOYMENT=true saat siap.",
      response: null
    }
  }

  const endpoint = resolveTrainingDeployEndpoint()
  if (!endpoint) {
    return {
      ok: false,
      status: 0,
      message: "ROBOFLOW_TRAINING_DEPLOY_ENDPOINT belum dikonfigurasi.",
      response: null
    }
  }

  const apiKey = getRoboflowApiKey()
  const deploymentName = getDedicatedDeploymentName()
  if (!deploymentName) {
    return {
      ok: false,
      status: 0,
      message: "ROBOFLOW_DEDICATED_DEPLOYMENT_NAME belum dikonfigurasi.",
      response: null
    }
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      api_key: apiKey,
      deployment_name: deploymentName
    }),
    cache: "no-store"
  })

  const payload = await parseResponsePayload(response)
  if (response.ok) {
    const deploymentInfo = await fetchDedicatedDeploymentInfo()
    await patchTrainingPipelineState({
      lastDeployAt: new Date().toISOString(),
      lastDeployResponse: {
        resume: payload,
        deploymentInfo: deploymentInfo.response
      },
      lastDeployError: deploymentInfo.ok ? null : deploymentInfo.message,
      dedicatedDeploymentName: deploymentName,
      dedicatedDeploymentDomain: deploymentInfo.domain,
      dedicatedDeploymentStatus: deploymentInfo.deploymentStatus,
      deployedVersion: params.version ?? null
    })

    return {
      ok: true,
      status: response.status,
      message: deploymentInfo.domain
        ? `Dedicated Deployment resumed. Domain aktif: ${deploymentInfo.domain}`
        : "Dedicated Deployment resumed.",
      response: {
        resume: payload,
        deploymentInfo: deploymentInfo.response,
        deployedVersion: params.version
      }
    }
  }

  const errorMessage = parseTrainingHttpError(response, payload)
  await patchTrainingPipelineState({
    lastDeployError: errorMessage,
    dedicatedDeploymentName: deploymentName
  })

  return {
    ok: false,
    status: response.status,
    message: errorMessage,
    response: payload
  }
}

export async function tryAutoDeployIfReady(
  state: TrainingPipelineState
): Promise<DeployTrainingResult | null> {
  if (
    !state.trainingReady ||
    !state.pendingVersion ||
    !isAutoDeployEnabled() ||
    !isDedicatedDeploymentConfigured()
  ) {
    return null
  }

  return executeDeployRequest({
    version: state.pendingVersion
  })
}

export async function checkRoboflowDedicatedDeploymentStatus(): Promise<DeployTrainingResult> {
  if (!isDedicatedDeploymentEnabled()) {
    return {
      ok: false,
      status: 0,
      message: "Dedicated Deployment sedang nonaktif. Toggle ROBOFLOW_USE_DEDICATED_DEPLOYMENT masih false.",
      response: null
    }
  }

  const deploymentName = getDedicatedDeploymentName()
  if (!deploymentName) {
    return {
      ok: false,
      status: 0,
      message: "ROBOFLOW_DEDICATED_DEPLOYMENT_NAME belum diisi. Saat belum dipakai boleh bernilai false.",
      response: null
    }
  }

  const result = await fetchDedicatedDeploymentInfo()
  await patchTrainingPipelineState({
    lastDeployError: result.ok ? null : result.message,
    dedicatedDeploymentName: deploymentName,
    dedicatedDeploymentDomain: result.domain,
    dedicatedDeploymentStatus: result.deploymentStatus
  })

  return {
    ok: result.ok,
    status: result.status,
    message: result.ok
      ? result.domain
        ? `Dedicated Deployment aktif pada ${result.domain}`
        : "Dedicated Deployment status berhasil dicek."
      : result.message,
    response: result.response
  }
}

export async function deployRoboflowModel(versionInput?: string | null): Promise<DeployTrainingResult> {
  const state = await readTrainingPipelineState()
  const version = state.pendingVersion || state.deployedVersion || null
  const requestedVersion = typeof versionInput === "string" && versionInput.trim().length > 0 ? versionInput : version

  return executeDeployRequest({
    version: requestedVersion
  })
}
