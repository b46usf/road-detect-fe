import { readString } from "@/lib/common-utils"
import { buildRoboflowPath } from "@/lib/server/roboflow-model-path"

export const DEFAULT_ROBOFLOW_SERVERLESS_ENDPOINT =
  "https://serverless.roboflow.com/baguss-workspace/find-barriers-potholes-waters-crackings-ruttings-and-roads"

interface ResolveRoboflowEndpointParams {
  apiKey: string
  modelId: string
  modelVersion: string
  confidence: string | null
  overlap: string | null
}

export type RoboflowEndpointType = "workflow" | "detect"

export interface ResolvedRoboflowEndpoint {
  roboflowUrl: string
  endpointType: RoboflowEndpointType
  modelMeta: {
    modelId: string | null
    modelVersion: string | null
  }
}

function normalizeServerlessWorkflowPath(url: URL): URL {
  const normalizedHost = url.hostname.toLowerCase()
  if (normalizedHost !== "serverless.roboflow.com") {
    return url
  }

  const segments = url.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)

  if (segments.length < 2) {
    return url
  }

  if (segments[1] !== "workflows") {
    const [workspace, workflow, ...rest] = segments
    url.pathname = `/${[workspace, "workflows", workflow, ...rest].join("/")}`
  }

  return url
}

export function resolveRoboflowEndpoint(
  params: ResolveRoboflowEndpointParams
): ResolvedRoboflowEndpoint | null {
  const { apiKey, modelId, modelVersion, confidence, overlap } = params
  const configuredEndpoint = readString(process.env.ROBOFLOW_INFERENCE_ENDPOINT)
  const endpointBase = configuredEndpoint || DEFAULT_ROBOFLOW_SERVERLESS_ENDPOINT

  try {
    const inputUrl = new URL(endpointBase)
    const normalizedUrl = normalizeServerlessWorkflowPath(inputUrl)

    if (normalizedUrl.hostname.toLowerCase() === "serverless.roboflow.com") {
      return {
        roboflowUrl: normalizedUrl.toString(),
        endpointType: "workflow",
        modelMeta: {
          modelId: null,
          modelVersion: null
        }
      }
    }

    if (!normalizedUrl.searchParams.has("api_key")) {
      normalizedUrl.searchParams.set("api_key", apiKey)
    }

    if (confidence !== null) {
      normalizedUrl.searchParams.set("confidence", confidence)
    }

    if (overlap !== null) {
      normalizedUrl.searchParams.set("overlap", overlap)
    }

    return {
      roboflowUrl: normalizedUrl.toString(),
      endpointType: "detect",
      modelMeta: {
        modelId: null,
        modelVersion: null
      }
    }
  } catch {
    // Fallback to legacy detect.roboflow.com path when endpoint is not a valid absolute URL.
  }

  const builtPath = buildRoboflowPath(modelId, modelVersion)
  if (!builtPath) {
    return null
  }

  const query = new URLSearchParams({ api_key: apiKey })
  if (confidence !== null) {
    query.set("confidence", confidence)
  }

  if (overlap !== null) {
    query.set("overlap", overlap)
  }

  return {
    roboflowUrl: `https://detect.roboflow.com/${builtPath.path}?${query.toString()}`,
    endpointType: "detect",
    modelMeta: {
      modelId: builtPath.normalizedModelId || modelId,
      modelVersion
    }
  }
}

function readPredictionsArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null
}

function findObjectWithPredictions(value: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 7 || !value || typeof value !== "object") {
    return null
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findObjectWithPredictions(item, depth + 1)
      if (found) {
        return found
      }
    }
    return null
  }

  const source = value as Record<string, unknown>
  if (readPredictionsArray(source.predictions)) {
    return source
  }

  for (const nested of Object.values(source)) {
    const found = findObjectWithPredictions(nested, depth + 1)
    if (found) {
      return found
    }
  }

  return null
}

export function normalizeRoboflowInferencePayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object") {
    return { raw: payload }
  }

  const source = payload as Record<string, unknown>
  const found = findObjectWithPredictions(source)
  if (!found) {
    return source
  }

  if (!("image" in found) && source.image && typeof source.image === "object") {
    return {
      ...found,
      image: source.image
    }
  }

  return found
}
