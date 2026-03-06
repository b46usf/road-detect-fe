import { readString, toFiniteNumber } from "@/lib/common-utils"
import { extractUpstreamMessage, translateUpstreamMessage } from "@/lib/roboflow-client"
import {
  listTrainingSamples,
  patchTrainingSample,
  readTrainingImageAsDataUrl
} from "@/lib/server/training-storage"
import type {
  TrainingPipelineRunSummary,
  TrainingSample,
  TrainingSampleStatus
} from "@/lib/training-types"

interface UploadAttemptResult {
  sampleId: string
  status: "uploaded" | "failed" | "skipped"
  message: string
  remoteId: string | null
}

export interface UploadPendingSamplesResult {
  ok: boolean
  message: string
  summary: TrainingPipelineRunSummary
  attempts: UploadAttemptResult[]
}

export interface TriggerTrainingResult {
  ok: boolean
  status: number
  message: string
  response: unknown
}

function getTrainingUploadEndpoint(): string {
  return readString(process.env.ROBOFLOW_TRAINING_UPLOAD_ENDPOINT)
}

function getTrainingTriggerEndpoint(): string {
  return readString(process.env.ROBOFLOW_TRAINING_TRIGGER_ENDPOINT)
}

function getRoboflowApiKey(): string {
  return readString(process.env.ROBOFLOW_API_KEY)
}

function appendApiKeyToEndpoint(rawEndpoint: string, apiKey: string): string {
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

async function parseResponsePayload(response: Response): Promise<unknown> {
  const responseText = await response.text()
  try {
    return JSON.parse(responseText)
  } catch {
    return { raw: responseText }
  }
}

function extractRemoteId(payload: unknown): string | null {
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

function parseHttpError(response: Response, payload: unknown): string {
  const upstreamRaw = extractUpstreamMessage(payload)
  if (upstreamRaw) {
    return `HTTP ${response.status}: ${translateUpstreamMessage(upstreamRaw)}`
  }

  return `HTTP ${response.status}: Upload ke Roboflow gagal.`
}

async function uploadSampleViaEndpoint(sample: TrainingSample): Promise<{ remoteId: string | null }> {
  const uploadEndpoint = getTrainingUploadEndpoint()
  if (!uploadEndpoint) {
    throw new Error("ROBOFLOW_TRAINING_UPLOAD_ENDPOINT belum dikonfigurasi.")
  }

  const apiKey = getRoboflowApiKey()
  const endpoint = appendApiKeyToEndpoint(uploadEndpoint, apiKey)
  const imageDataUrl = await readTrainingImageAsDataUrl(sample)
  const base64Payload = imageDataUrl.split(",", 2)[1] ?? ""
  const metadata = {
    label: sample.label,
    severity: sample.severity,
    source: sample.source,
    notes: sample.notes
  }

  const jsonCandidates: unknown[] = [
    {
      api_key: apiKey,
      inputs: {
        image: imageDataUrl,
        metadata
      }
    },
    {
      api_key: apiKey,
      image: imageDataUrl,
      name: sample.filename,
      split: "train",
      tag: sample.label,
      metadata
    },
    {
      api_key: apiKey,
      image: base64Payload,
      name: sample.filename,
      split: "train",
      tag: sample.label,
      metadata
    }
  ]

  let latestError = "Upload ke Roboflow gagal."

  for (const body of jsonCandidates) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body),
      cache: "no-store"
    })

    const parsedPayload = await parseResponsePayload(response)
    if (response.ok) {
      return {
        remoteId: extractRemoteId(parsedPayload)
      }
    }

    latestError = parseHttpError(response, parsedPayload)
  }

  const uploadMime = readString(sample.mime, "image/jpeg")
  const uploadBuffer = Buffer.from(base64Payload, "base64")
  const form = new FormData()
  form.append("api_key", apiKey)
  form.append("name", sample.filename)
  form.append("split", "train")
  form.append("tag", sample.label)
  form.append("file", new Blob([uploadBuffer], { type: uploadMime }), sample.filename)

  const formResponse = await fetch(endpoint, {
    method: "POST",
    body: form,
    cache: "no-store"
  })
  const formPayload = await parseResponsePayload(formResponse)
  if (formResponse.ok) {
    return {
      remoteId: extractRemoteId(formPayload)
    }
  }

  latestError = parseHttpError(formResponse, formPayload)
  throw new Error(latestError)
}

function createSummaryFromAttempts(attempts: UploadAttemptResult[]): TrainingPipelineRunSummary {
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

export async function uploadQueuedTrainingSamples(limitInput: unknown): Promise<UploadPendingSamplesResult> {
  const limit = Math.max(1, Math.min(50, toFiniteNumber(limitInput) ?? 12))
  const uploadEndpoint = getTrainingUploadEndpoint()

  const queuedSamples = (await listTrainingSamples())
    .filter((sample) => sample.status === "queued" || sample.status === "failed")
    .slice(0, limit)

  if (queuedSamples.length === 0) {
    return {
      ok: true,
      message: "Tidak ada sample queued/failed yang perlu diupload.",
      summary: { total: 0, succeeded: 0, failed: 0, skipped: 0 },
      attempts: []
    }
  }

  if (!uploadEndpoint) {
    const attempts = queuedSamples.map<UploadAttemptResult>((sample) => ({
      sampleId: sample.id,
      status: "skipped",
      message: "ROBOFLOW_TRAINING_UPLOAD_ENDPOINT belum diset.",
      remoteId: null
    }))

    return {
      ok: false,
      message: "Upload endpoint belum dikonfigurasi.",
      summary: createSummaryFromAttempts(attempts),
      attempts
    }
  }

  const attempts: UploadAttemptResult[] = []

  for (const sample of queuedSamples) {
    await patchTrainingSample(sample.id, {
      status: "uploading",
      lastError: null
    })

    try {
      const uploaded = await uploadSampleViaEndpoint(sample)
      await patchTrainingSample(sample.id, {
        status: "uploaded",
        uploadedAt: new Date().toISOString(),
        lastError: null,
        remoteId: uploaded.remoteId,
        uploadAttempts: sample.uploadAttempts + 1
      })

      attempts.push({
        sampleId: sample.id,
        status: "uploaded",
        message: "Upload berhasil.",
        remoteId: uploaded.remoteId
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Upload sample ke Roboflow gagal."

      await patchTrainingSample(sample.id, {
        status: "failed",
        lastError: errorMessage,
        uploadAttempts: sample.uploadAttempts + 1
      })

      attempts.push({
        sampleId: sample.id,
        status: "failed",
        message: errorMessage,
        remoteId: null
      })
    }
  }

  const summary = createSummaryFromAttempts(attempts)
  return {
    ok: summary.failed === 0,
    message:
      summary.failed === 0
        ? `Upload selesai. ${summary.succeeded} sample berhasil diproses.`
        : `Upload selesai dengan error. Berhasil ${summary.succeeded}, gagal ${summary.failed}.`,
    summary,
    attempts
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
      return {
        ok: true,
        status: response.status,
        message: "Trigger training berhasil dikirim.",
        response: parsedPayload
      }
    }

    latestStatus = response.status
    latestPayload = parsedPayload
    latestMessage = parseHttpError(response, parsedPayload)
  }

  return {
    ok: false,
    status: latestStatus,
    message: latestMessage,
    response: latestPayload
  }
}

export function getTrainingPipelineConfigState(): {
  uploadEndpointConfigured: boolean
  triggerEndpointConfigured: boolean
  apiKeyConfigured: boolean
} {
  return {
    uploadEndpointConfigured: Boolean(getTrainingUploadEndpoint()),
    triggerEndpointConfigured: Boolean(getTrainingTriggerEndpoint()),
    apiKeyConfigured: Boolean(getRoboflowApiKey())
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
