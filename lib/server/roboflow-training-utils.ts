import { readString } from "@/lib/common-utils"
import {
  getRoboflowTrainingDeployEndpoint,
  getRoboflowTrainingStatusEndpointTemplate,
  getRoboflowTrainingTriggerEndpoint
} from "@/lib/env/server"
import { extractUpstreamMessage, translateUpstreamMessage } from "@/lib/roboflow-client"
import type { TrainingPipelineRunSummary, TrainingSample } from "@/lib/training-types"

export interface TrainingUploadAttemptResult {
  sampleId: string
  status: "uploaded" | "failed" | "skipped"
  message: string
  remoteId: string | null
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

export function appendApiKeyToEndpoint(rawEndpoint: string, apiKey: string): string {
  if (!apiKey) {
    return rawEndpoint
  }

  try {
    const url = new URL(rawEndpoint)
    if (!url.searchParams.has("api_key")) {
      url.searchParams.set("api_key", apiKey)
    }
    return url.toString()
  } catch {
    return rawEndpoint
  }
}

export function appendUploadParams(endpoint: string, sample: TrainingSample, apiKey: string): string {
  const withApiKey = appendApiKeyToEndpoint(endpoint, apiKey)

  try {
    const url = new URL(withApiKey)
    if (!url.searchParams.has("name")) {
      url.searchParams.set("name", sample.filename)
    }
    if (!url.searchParams.has("split")) {
      url.searchParams.set("split", "train")
    }
    if (!url.searchParams.has("batch")) {
      url.searchParams.set("batch", "roadster-admin")
    }
    return url.toString()
  } catch {
    return withApiKey
  }
}

export function deriveAnnotateEndpoint(
  uploadEndpoint: string,
  imageId: string,
  apiKey: string,
  sample: TrainingSample
): string {
  const withApiKey = appendApiKeyToEndpoint(uploadEndpoint, apiKey)

  try {
    const url = new URL(withApiKey)
    url.pathname = url.pathname.replace(/\/upload\/?$/i, `/annotate/${imageId}`)
    url.searchParams.set("name", `${sample.filename}.txt`)
    return url.toString()
  } catch {
    return withApiKey.replace(/\/upload\/?$/i, `/annotate/${imageId}`)
  }
}

export async function parseResponsePayload(response: Response): Promise<unknown> {
  const responseText = await response.text()
  try {
    return JSON.parse(responseText)
  } catch {
    return { raw: responseText }
  }
}

export function extractRemoteId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const source = payload as Record<string, unknown>
  const directId = readString(source.id)
  if (directId) {
    return directId
  }

  if (source.image && typeof source.image === "object") {
    const imageId = readString((source.image as Record<string, unknown>).id)
    if (imageId) {
      return imageId
    }
  }

  if (Array.isArray(source.outputs) && source.outputs.length > 0) {
    const firstOutput = source.outputs[0]
    if (firstOutput && typeof firstOutput === "object") {
      const outputId = readString((firstOutput as Record<string, unknown>).id)
      if (outputId) {
        return outputId
      }
    }
  }

  return null
}

export function parseTrainingHttpError(response: Response, payload: unknown): string {
  const upstreamRaw = extractUpstreamMessage(payload)
  if (upstreamRaw) {
    return `HTTP ${response.status}: ${translateUpstreamMessage(upstreamRaw)}`
  }

  return `HTTP ${response.status}: Upload ke Roboflow gagal.`
}

export function extractTrainingVersion(payload: unknown): string | null {
  const source = readObject(payload)
  const candidateKeys = ["version", "version_id", "dataset_version", "modelVersion", "id"]

  for (const key of candidateKeys) {
    const value = source[key]
    const direct = readString(value)
    if (direct) {
      return direct
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value)
    }

    if (value && typeof value === "object") {
      const nested = extractTrainingVersion(value)
      if (nested) {
        return nested
      }
    }
  }

  const nestedContainers = [source.data, source.result, source.version]
  for (const nested of nestedContainers) {
    const version = extractTrainingVersion(nested)
    if (version) {
      return version
    }
  }

  return null
}

export function isTrainingReadyPayload(payload: unknown): boolean {
  const source = readObject(payload)
  const rawStatus = readString(source.status).toLowerCase()
  if (rawStatus) {
    if (
      ["ready", "completed", "complete", "trained", "success", "finished", "deployed"].some((keyword) =>
        rawStatus.includes(keyword)
      )
    ) {
      return true
    }

    if (
      ["pending", "queued", "training", "processing", "generating", "running", "building"].some((keyword) =>
        rawStatus.includes(keyword)
      )
    ) {
      return false
    }
  }

  if (source.model || source.weights || source.hosted || source.endpoint) {
    return true
  }

  if (source.version && typeof source.version === "object") {
    return isTrainingReadyPayload(source.version)
  }

  return false
}

function parseTrainingProjectFromEndpoint(rawEndpoint: string): {
  workspace: string | null
  project: string | null
} {
  try {
    const url = new URL(rawEndpoint)
    const segments = url.pathname.split("/").filter(Boolean)
    const datasetIndex = segments.findIndex((segment) => segment === "dataset")
    if (datasetIndex >= 0 && segments.length > datasetIndex + 2) {
      return {
        workspace: segments[datasetIndex + 1] ?? null,
        project: segments[datasetIndex + 2] ?? null
      }
    }
  } catch {
    return { workspace: null, project: null }
  }

  return { workspace: null, project: null }
}

export function resolveTrainingStatusEndpoint(version: string | null): string {
  if (!version) {
    return ""
  }

  const template = getRoboflowTrainingStatusEndpointTemplate()
  if (template) {
    const projectInfo = parseTrainingProjectFromEndpoint(getRoboflowTrainingTriggerEndpoint())
    return template
      .replaceAll("{version}", version)
      .replaceAll("{workspace}", projectInfo.workspace ?? "")
      .replaceAll("{project}", projectInfo.project ?? "")
  }

  const projectInfo = parseTrainingProjectFromEndpoint(getRoboflowTrainingTriggerEndpoint())
  if (!projectInfo.workspace || !projectInfo.project) {
    return ""
  }

  return `https://api.roboflow.com/${projectInfo.workspace}/${projectInfo.project}/${version}`
}

export function resolveTrainingDeployEndpoint(): string {
  return getRoboflowTrainingDeployEndpoint()
}

export function extractDedicatedDeploymentDomain(payload: unknown): string | null {
  const source = readObject(payload)
  const domain = readString(source.domain)
  if (domain) {
    return domain
  }

  const nested = [source.data, source.deployment, source.result]
  for (const item of nested) {
    const nestedDomain = extractDedicatedDeploymentDomain(item)
    if (nestedDomain) {
      return nestedDomain
    }
  }

  return null
}

export function extractDedicatedDeploymentStatus(payload: unknown): string | null {
  const source = readObject(payload)
  const candidate = readString(source.status)
  if (candidate) {
    return candidate
  }

  const nested = [source.data, source.deployment, source.result]
  for (const item of nested) {
    const nestedStatus = extractDedicatedDeploymentStatus(item)
    if (nestedStatus) {
      return nestedStatus
    }
  }

  return null
}

export function isSampleReadyForUpload(sample: TrainingSample): boolean {
  return sample.annotations.length > 0 && sample.imageWidth > 0 && sample.imageHeight > 0
}

export function createTrainingRunSummary(attempts: TrainingUploadAttemptResult[]): TrainingPipelineRunSummary {
  return attempts.reduce<TrainingPipelineRunSummary>(
    (summary, item) => {
      summary.total += 1
      if (item.status === "uploaded") {
        summary.succeeded += 1
      } else if (item.status === "failed") {
        summary.failed += 1
      } else {
        summary.skipped += 1
      }
      return summary
    },
    {
      total: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0
    }
  )
}
