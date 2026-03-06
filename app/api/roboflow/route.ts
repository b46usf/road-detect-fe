import { getServerRoboflowApiKey } from "@/lib/env/server"
import { requireRoboflowEndpointSecret } from "@/lib/server/roboflow-endpoint-auth"
import { executeRoboflowInference } from "@/lib/server/roboflow-api-execution"
import { parseRoboflowInferenceRequest } from "@/lib/server/roboflow-api-request"
import { jsonError, mapRoboflowInferenceSuccess } from "@/lib/server/roboflow-api-response"
import { isRoboflowRouteError } from "@/lib/server/roboflow-api-types"

export async function POST(request: Request) {
  const startedAt = Date.now()
  const apiKey = getServerRoboflowApiKey()
  if (!apiKey) {
    return jsonError(500, "ENV_MISSING", "ROBOFLOW_API_KEY belum diset di environment server.")
  }

  const unauthorized = requireRoboflowEndpointSecret(request, { allowTrustedClientRequest: true })
  if (unauthorized) {
    return unauthorized
  }

  try {
    const parsedRequest = await parseRoboflowInferenceRequest(request, apiKey)
    const execution = await executeRoboflowInference({
      apiKey,
      request: parsedRequest
    })

    return mapRoboflowInferenceSuccess({
      request: parsedRequest,
      execution,
      durationMs: Date.now() - startedAt
    })
  } catch (error) {
    if (isRoboflowRouteError(error)) {
      return jsonError(error.status, error.code, error.message, error.details)
    }

    return jsonError(500, "INTERNAL_SERVER_ERROR", "Terjadi error internal yang tidak terduga.")
  }
}
