import { NextResponse } from "next/server"
import { readString } from "@/lib/common-utils"
import { normalizeTrainingAnnotations } from "@/lib/training-annotations"
import {
  countSamplesByStatus,
  getTrainingPipelineConfigState,
  getTrainingPipelineSnapshot
} from "@/lib/server/roboflow-training"
import { requireRoboflowEndpointSecret } from "@/lib/server/roboflow-endpoint-auth"
import {
  createTrainingSample,
  deleteTrainingSampleById,
  listTrainingSamples,
  patchTrainingSample
} from "@/lib/server/training-storage"
import { type TrainingLabel, type TrainingSeverity } from "@/lib/training-types"

function jsonError(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {})
      }
    },
    { status }
  )
}

export async function GET(request: Request) {
  const unauthorized = requireRoboflowEndpointSecret(request, { allowTrustedClientRequest: true })
  if (unauthorized) {
    return unauthorized
  }

  const samples = await listTrainingSamples()
  return NextResponse.json({
    ok: true,
    samples,
    summary: countSamplesByStatus(samples),
    config: getTrainingPipelineConfigState(),
    pipelineState: await getTrainingPipelineSnapshot()
  })
}

export async function POST(request: Request) {
  const unauthorized = requireRoboflowEndpointSecret(request, { allowTrustedClientRequest: true })
  if (unauthorized) {
    return unauthorized
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError(400, "INVALID_JSON", "Body request harus berupa JSON valid.")
  }

  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const imageDataUrl = readString(payload.imageDataUrl ?? payload.image)
  const imageWidth = Number(payload.imageWidth)
  const imageHeight = Number(payload.imageHeight)
  const label = readString(payload.label, "other") as TrainingLabel
  const severity = readString(payload.severity, "unknown") as TrainingSeverity
  const notes = readString(payload.notes)
  const source = readString(payload.source, "admin-upload")
  const annotations = normalizeTrainingAnnotations(payload.annotations)

  if (!imageDataUrl) {
    return jsonError(400, "IMAGE_REQUIRED", "Image training wajib diisi sebagai data URL.")
  }

  if (!Number.isFinite(imageWidth) || imageWidth <= 0 || !Number.isFinite(imageHeight) || imageHeight <= 0) {
    return jsonError(400, "IMAGE_DIMENSIONS_REQUIRED", "Dimensi image training wajib diisi.")
  }

  try {
    const sample = await createTrainingSample({
      imageDataUrl,
      imageWidth,
      imageHeight,
      label,
      severity,
      annotations,
      notes,
      source: source === "camera-capture" ? "camera-capture" : "admin-upload"
    })

    return NextResponse.json({
      ok: true,
      message: "Sample training berhasil disimpan.",
      sample
    })
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : "Gagal menyimpan sample training."
    return jsonError(400, "TRAINING_SAMPLE_CREATE_FAILED", message)
  }
}

export async function PATCH(request: Request) {
  const unauthorized = requireRoboflowEndpointSecret(request, { allowTrustedClientRequest: true })
  if (unauthorized) {
    return unauthorized
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError(400, "INVALID_JSON", "Body request harus berupa JSON valid.")
  }

  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const id = readString(payload.id)
  if (!id) {
    return jsonError(400, "ID_REQUIRED", "Field `id` wajib diisi.")
  }

  const nextLabel = readString(payload.label)
  const nextSeverity = readString(payload.severity)
  const nextNotes = payload.notes
  const nextAnnotations =
    payload.annotations !== undefined ? normalizeTrainingAnnotations(payload.annotations) : undefined

  const updated = await patchTrainingSample(id, {
    ...(nextLabel ? { label: nextLabel as TrainingLabel } : {}),
    ...(nextSeverity ? { severity: nextSeverity as TrainingSeverity } : {}),
    ...(nextNotes !== undefined ? { notes: readString(nextNotes) } : {}),
    ...(nextAnnotations !== undefined ? { annotations: nextAnnotations } : {})
  })

  if (!updated) {
    return jsonError(404, "NOT_FOUND", "Sample training tidak ditemukan.")
  }

  return NextResponse.json({
    ok: true,
    message: "Sample training berhasil diperbarui.",
    sample: updated
  })
}

export async function DELETE(request: Request) {
  const unauthorized = requireRoboflowEndpointSecret(request, { allowTrustedClientRequest: true })
  if (unauthorized) {
    return unauthorized
  }

  const url = new URL(request.url)
  const id = readString(url.searchParams.get("id"))
  if (!id) {
    return jsonError(400, "ID_REQUIRED", "Parameter `id` wajib diisi.")
  }

  const deleted = await deleteTrainingSampleById(id)
  if (!deleted) {
    return jsonError(404, "NOT_FOUND", "Sample training tidak ditemukan.")
  }

  return NextResponse.json({
    ok: true,
    message: "Sample training berhasil dihapus."
  })
}
