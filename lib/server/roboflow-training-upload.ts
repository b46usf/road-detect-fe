import { readString, toFiniteNumber } from "@/lib/common-utils"
import { buildDarknetAnnotationFile } from "@/lib/training-annotations"
import {
  getRoboflowApiKey,
  getTrainingUploadEndpoint
} from "@/lib/server/roboflow-training-config"
import type { UploadPendingSamplesResult } from "@/lib/server/roboflow-training-types"
import {
  appendUploadParams,
  createTrainingRunSummary,
  deriveAnnotateEndpoint,
  extractRemoteId,
  isSampleReadyForUpload,
  parseResponsePayload,
  parseTrainingHttpError,
  type TrainingUploadAttemptResult
} from "@/lib/server/roboflow-training-utils"
import {
  listTrainingSamples,
  patchTrainingSample,
  readTrainingImageAsDataUrl
} from "@/lib/server/training-storage"
import type { TrainingSample } from "@/lib/training-types"

async function uploadSampleViaEndpoint(sample: TrainingSample): Promise<{ remoteId: string }> {
  const uploadEndpoint = getTrainingUploadEndpoint()
  if (!uploadEndpoint) {
    throw new Error("ROBOFLOW_TRAINING_UPLOAD_ENDPOINT belum dikonfigurasi.")
  }

  if (!isSampleReadyForUpload(sample)) {
    throw new Error("Sample belum punya anotasi atau dimensi image yang valid.")
  }

  const apiKey = getRoboflowApiKey()
  const endpoint = appendUploadParams(uploadEndpoint, sample, apiKey)
  const imageDataUrl = await readTrainingImageAsDataUrl(sample)
  const base64Payload = imageDataUrl.split(",", 2)[1] ?? ""

  let uploadPayload: unknown = null
  let uploadStatus = 500
  let latestError = "Upload ke Roboflow gagal."

  const uploadResponse = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "text/plain;charset=utf-8"
    },
    body: base64Payload,
    cache: "no-store"
  })
  uploadPayload = await parseResponsePayload(uploadResponse)
  uploadStatus = uploadResponse.status

  if (!uploadResponse.ok) {
    latestError = parseTrainingHttpError(uploadResponse, uploadPayload)

    const uploadMime = readString(sample.mime, "image/jpeg")
    const uploadBuffer = Buffer.from(base64Payload, "base64")
    const form = new FormData()
    form.append("file", new Blob([uploadBuffer], { type: uploadMime }), sample.filename)

    const formResponse = await fetch(endpoint, {
      method: "POST",
      body: form,
      cache: "no-store"
    })
    uploadPayload = await parseResponsePayload(formResponse)
    uploadStatus = formResponse.status
    if (!formResponse.ok) {
      latestError = parseTrainingHttpError(formResponse, uploadPayload)
      throw new Error(latestError)
    }
  }

  const remoteId = extractRemoteId(uploadPayload)
  if (!remoteId) {
    throw new Error(
      uploadStatus >= 200 && uploadStatus < 300
        ? "Upload image berhasil tetapi image ID dari Roboflow tidak ditemukan."
        : latestError
    )
  }

  const annotateEndpoint = deriveAnnotateEndpoint(uploadEndpoint, remoteId, apiKey, sample)
  const annotationPayload = buildDarknetAnnotationFile({
    annotations: sample.annotations,
    imageWidth: sample.imageWidth,
    imageHeight: sample.imageHeight
  })

  const annotateResponse = await fetch(annotateEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(annotationPayload),
    cache: "no-store"
  })
  const annotateResult = await parseResponsePayload(annotateResponse)
  if (!annotateResponse.ok) {
    throw new Error(parseTrainingHttpError(annotateResponse, annotateResult))
  }

  return { remoteId }
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
    const attempts = queuedSamples.map<TrainingUploadAttemptResult>((sample) => ({
      sampleId: sample.id,
      status: "skipped",
      message: "ROBOFLOW_TRAINING_UPLOAD_ENDPOINT belum diset.",
      remoteId: null
    }))

    return {
      ok: false,
      message: "Upload endpoint belum dikonfigurasi.",
      summary: createTrainingRunSummary(attempts),
      attempts
    }
  }

  const attempts: TrainingUploadAttemptResult[] = []

  for (const sample of queuedSamples) {
    if (!isSampleReadyForUpload(sample)) {
      attempts.push({
        sampleId: sample.id,
        status: "skipped",
        message: "Sample belum memiliki anotasi valid. Edit bounding box dulu sebelum upload.",
        remoteId: null
      })
      continue
    }

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
        message: "Upload image dan anotasi berhasil.",
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

  const summary = createTrainingRunSummary(attempts)
  const ok = summary.failed === 0 && summary.skipped === 0

  return {
    ok,
    message:
      summary.failed > 0
        ? `Upload selesai dengan error. Berhasil ${summary.succeeded}, gagal ${summary.failed}, skip ${summary.skipped}.`
        : summary.skipped > 0
          ? `Upload parsial. Berhasil ${summary.succeeded}, skip ${summary.skipped} sample yang belum siap anotasi.`
          : `Upload selesai. ${summary.succeeded} sample berhasil diproses.`,
    summary,
    attempts
  }
}
