import {
  buildTrainingTriggerPolicy,
  getDedicatedInferenceEndpoint,
  getRoboflowApiKey,
  getTrainingTriggerEndpoint
} from "@/lib/server/roboflow-training-config"
import {
  tryAutoDeployIfReady
} from "@/lib/server/roboflow-training-deployment"
export {
  buildTrainingTriggerPolicy,
  countSamplesByStatus,
  getTrainingPipelineConfigState
} from "@/lib/server/roboflow-training-config"
export {
  checkRoboflowDedicatedDeploymentStatus,
  deployRoboflowModel
} from "@/lib/server/roboflow-training-deployment"
export { uploadQueuedTrainingSamples } from "@/lib/server/roboflow-training-upload"
export type {
  DeployTrainingResult,
  SyncTrainingStatusResult,
  TrainingPipelineConfigState,
  TrainingTriggerPolicyState,
  TriggerTrainingResult,
  UploadPendingSamplesResult
} from "@/lib/server/roboflow-training-types"
import type {
  SyncTrainingStatusResult,
  TriggerTrainingResult
} from "@/lib/server/roboflow-training-types"
import {
  appendApiKeyToEndpoint,
  extractTrainingVersion,
  isTrainingReadyPayload,
  parseResponsePayload,
  parseTrainingHttpError,
  resolveTrainingStatusEndpoint
} from "@/lib/server/roboflow-training-utils"
import {
  patchTrainingPipelineState,
  readTrainingPipelineState,
  type InferenceTarget,
  type TrainingPipelineState
} from "@/lib/server/training-pipeline-state"
import { listTrainingSamples } from "@/lib/server/training-storage"

export async function getTrainingPipelineSnapshot(): Promise<TrainingPipelineState> {
  return readTrainingPipelineState()
}

export async function setTrainingInferenceTarget(targetInput: unknown): Promise<{
  ok: boolean
  status: number
  message: string
  state: TrainingPipelineState
}> {
  const nextTarget: InferenceTarget = targetInput === "dedicated" ? "dedicated" : "serverless"
  const current = await readTrainingPipelineState()

  if (nextTarget === "dedicated" && !getDedicatedInferenceEndpoint()) {
    return {
      ok: false,
      status: 400,
      message: "ROBOFLOW_DEDICATED_INFERENCE_ENDPOINT belum dikonfigurasi.",
      state: current
    }
  }

  const nextState = await patchTrainingPipelineState({
    inferenceTarget: nextTarget,
    lastError: null
  })

  return {
    ok: true,
    status: 200,
    message:
      nextTarget === "dedicated"
        ? "Inference target diubah ke dedicated endpoint."
        : "Inference target diubah ke serverless workflow.",
    state: nextState
  }
}

export async function syncRoboflowTrainingStatus(): Promise<SyncTrainingStatusResult> {
  const state = await readTrainingPipelineState()
  if (!state.pendingVersion) {
    return {
      ok: false,
      status: 400,
      ready: false,
      message: "Belum ada versi training pending yang perlu dicek.",
      response: state
    }
  }

  const endpoint = resolveTrainingStatusEndpoint(state.pendingVersion)
  if (!endpoint) {
    return {
      ok: false,
      status: 0,
      ready: false,
      message: "Status endpoint training belum bisa diturunkan. Set ROBOFLOW_TRAINING_STATUS_ENDPOINT_TEMPLATE jika perlu.",
      response: state
    }
  }

  const response = await fetch(appendApiKeyToEndpoint(endpoint, getRoboflowApiKey()), {
    method: "GET",
    cache: "no-store"
  })
  const payload = await parseResponsePayload(response)

  if (!response.ok) {
    const errorMessage = parseTrainingHttpError(response, payload)
    await patchTrainingPipelineState({
      lastStatusAt: new Date().toISOString(),
      lastStatusResponse: payload,
      lastError: errorMessage
    })

    return {
      ok: false,
      status: response.status,
      ready: false,
      message: errorMessage,
      response: payload
    }
  }

  const ready = isTrainingReadyPayload(payload)
  const nextState = await patchTrainingPipelineState({
    lastStatusAt: new Date().toISOString(),
    lastStatusResponse: payload,
    trainingReady: ready,
    lastError: null
  })

  const deployResult = await tryAutoDeployIfReady(nextState)

  return {
    ok: true,
    status: response.status,
    ready,
    message: deployResult?.ok
      ? `Status training ready. Deploy otomatis berhasil dipicu untuk versi ${state.pendingVersion}.`
      : ready
        ? `Status training ready untuk versi ${state.pendingVersion}.`
        : `Training versi ${state.pendingVersion} masih diproses.`,
    response: {
      status: payload,
      autoDeploy: deployResult
    }
  }
}

export async function triggerRoboflowTraining(): Promise<TriggerTrainingResult> {
  const triggerEndpoint = getTrainingTriggerEndpoint()
  if (!triggerEndpoint) {
    return {
      ok: false,
      status: 0,
      message: "ROBOFLOW_TRAINING_TRIGGER_ENDPOINT belum dikonfigurasi.",
      response: null
    }
  }

  const samples = await listTrainingSamples()
  const uploadedCount = samples.filter((sample) => sample.status === "uploaded").length
  const policy = buildTrainingTriggerPolicy(uploadedCount)

  if (!policy.canTriggerTraining) {
    return {
      ok: false,
      status: 400,
      message: `Training belum boleh dijalankan. Upload minimal ${policy.minUploadedSamples} sample dulu. Saat ini baru ${policy.uploadedCount} sample uploaded.`,
      response: policy
    }
  }

  const apiKey = getRoboflowApiKey()
  const endpoint = appendApiKeyToEndpoint(triggerEndpoint, apiKey)
  const payloadCandidates = [
    {
      api_key: apiKey,
      action: "train"
    },
    {
      api_key: apiKey
    },
    {}
  ]

  let latestStatus = 500
  let latestMessage = "Gagal trigger training."
  let latestPayload: unknown = null

  for (const candidate of payloadCandidates) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(candidate),
      cache: "no-store"
    })

    const parsedPayload = await parseResponsePayload(response)
    if (response.ok) {
      const pendingVersion = extractTrainingVersion(parsedPayload)
      const trainingReady = isTrainingReadyPayload(parsedPayload)
      const nextState = await patchTrainingPipelineState({
        lastTriggerAt: new Date().toISOString(),
        lastTriggerResponse: parsedPayload,
        pendingVersion,
        trainingReady,
        lastStatusAt: trainingReady ? new Date().toISOString() : null,
        lastStatusResponse: trainingReady ? parsedPayload : null,
        lastError: null,
        lastDeployError: null
      })

      const deployResult = await tryAutoDeployIfReady(nextState)
      const advisory =
        policy.uploadedCount > policy.recommendedMaxUploadedSamples
          ? ` Uploaded sample sudah ${policy.uploadedCount}, melebihi rekomendasi ${policy.recommendedMaxUploadedSamples}.`
          : ""

      return {
        ok: true,
        status: response.status,
        message: deployResult?.ok
          ? `Trigger training berhasil dikirim dan deploy otomatis dipicu.${advisory}`.trim()
          : `Trigger training berhasil dikirim.${advisory}`.trim(),
        response: {
          trigger: parsedPayload,
          pendingVersion,
          autoDeploy: deployResult
        }
      }
    }

    latestStatus = response.status
    latestPayload = parsedPayload
    latestMessage = parseTrainingHttpError(response, parsedPayload)
  }

  await patchTrainingPipelineState({
    lastTriggerAt: new Date().toISOString(),
    lastTriggerResponse: latestPayload,
    lastError: latestMessage
  })

  return {
    ok: false,
    status: latestStatus,
    message: latestMessage,
    response: latestPayload
  }
}
