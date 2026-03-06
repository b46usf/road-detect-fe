import { extractUpstreamMessage, translateUpstreamMessage } from "@/lib/roboflow-client"
import {
  getRoboflowDedicatedInferenceEndpoint,
  shouldUseDedicatedDeploymentRouting
} from "@/lib/env/server"
import {
  normalizeRoboflowInferencePayload,
  resolveRoboflowEndpoint
} from "@/lib/server/roboflow-endpoint"
import { forwardInferenceToRoboflow } from "@/lib/server/roboflow-inference-request"
import { readTrainingPipelineState } from "@/lib/server/training-pipeline-state"
import {
  RoboflowRouteError,
  type ExecutedRoboflowInference,
  type ParsedRoboflowInferenceRequest
} from "@/lib/server/roboflow-api-types"

function resolveDedicatedEndpointBase(pipelineState: Awaited<ReturnType<typeof readTrainingPipelineState>>) {
  const dedicatedInferenceEndpoint = getRoboflowDedicatedInferenceEndpoint()
  const managedDedicatedEndpointBase =
    shouldUseDedicatedDeploymentRouting() &&
    pipelineState?.dedicatedDeploymentDomain &&
    pipelineState.deployedVersion
      ? `https://${pipelineState.dedicatedDeploymentDomain}`
      : null

  return pipelineState.inferenceTarget === "dedicated"
    ? dedicatedInferenceEndpoint || managedDedicatedEndpointBase
    : null
}

export async function executeRoboflowInference(params: {
  apiKey: string
  request: ParsedRoboflowInferenceRequest
}): Promise<ExecutedRoboflowInference> {
  const { apiKey, request } = params
  const pipelineState = await readTrainingPipelineState()
  const dedicatedEndpointBase = resolveDedicatedEndpointBase(pipelineState)
  const modelVersion =
    pipelineState.inferenceTarget === "dedicated" &&
    !getRoboflowDedicatedInferenceEndpoint() &&
    pipelineState.deployedVersion &&
    dedicatedEndpointBase
      ? pipelineState.deployedVersion
      : request.requestedModelVersion

  if (pipelineState.inferenceTarget === "dedicated" && !dedicatedEndpointBase) {
    throw new RoboflowRouteError(
      400,
      "DEDICATED_ENDPOINT_NOT_READY",
      "Inference target sedang diarahkan ke dedicated, tetapi endpoint dedicated belum siap. Periksa ROBOFLOW_DEDICATED_INFERENCE_ENDPOINT atau deployment aktif."
    )
  }

  const resolvedEndpoint = resolveRoboflowEndpoint({
    apiKey,
    modelId: request.modelId,
    modelVersion,
    confidence: request.confidence,
    overlap: request.overlap,
    endpointBaseOverride: dedicatedEndpointBase
  })

  if (!resolvedEndpoint) {
    throw new RoboflowRouteError(
      400,
      "INFERENCE_ENDPOINT_INVALID",
      "Konfigurasi endpoint inferensi Roboflow tidak valid. Periksa ROBOFLOW_INFERENCE_ENDPOINT atau model path."
    )
  }

  try {
    const upstream = await forwardInferenceToRoboflow({
      roboflowUrl: resolvedEndpoint.roboflowUrl,
      apiKey,
      endpointType: resolvedEndpoint.endpointType,
      cleanedBase64: request.cleanedBase64,
      imageInput: request.imageInput
    })

    if (!upstream.ok) {
      const upstreamMessageRaw = extractUpstreamMessage(upstream.responseData)
      const upstreamMessage = upstreamMessageRaw ? translateUpstreamMessage(upstreamMessageRaw) : null

      throw new RoboflowRouteError(
        upstream.status,
        "UPSTREAM_HTTP_ERROR",
        upstreamMessage
          ? `Request ke Roboflow gagal: ${upstreamMessage}`
          : "Request ke Roboflow gagal.",
        {
          upstreamStatus: upstream.status,
          upstreamMessage: upstreamMessageRaw ?? null,
          upstreamBody: upstream.responseData
        }
      )
    }

    return {
      pipelineState,
      resolvedEndpoint,
      modelId: request.modelId,
      modelVersion,
      upstreamData: normalizeRoboflowInferencePayload(upstream.responseData)
    }
  } catch (error) {
    if (error instanceof RoboflowRouteError) {
      throw error
    }

    throw new RoboflowRouteError(
      502,
      "UPSTREAM_NETWORK_ERROR",
      "Tidak dapat terhubung ke layanan Roboflow."
    )
  }
}
