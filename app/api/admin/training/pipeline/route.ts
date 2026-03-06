import { NextResponse } from "next/server"
import { readString, toFiniteNumber } from "@/lib/common-utils"
import {
  getTrainingPipelineConfigState,
  triggerRoboflowTraining,
  uploadQueuedTrainingSamples
} from "@/lib/server/roboflow-training"
import { requireRoboflowEndpointSecret } from "@/lib/server/roboflow-endpoint-auth"
import { requeueFailedTrainingSamples } from "@/lib/server/training-storage"

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
  const action = readString(payload.action)

  if (action === "upload_pending") {
    const limit = toFiniteNumber(payload.limit) ?? 12
    const result = await uploadQueuedTrainingSamples(limit)
    return NextResponse.json({
      ok: result.ok,
      message: result.message,
      summary: result.summary,
      attempts: result.attempts,
      config: getTrainingPipelineConfigState()
    })
  }

  if (action === "retry_failed") {
    const retried = await requeueFailedTrainingSamples()
    return NextResponse.json({
      ok: true,
      message:
        retried > 0
          ? `${retried} sample gagal sudah dipindah kembali ke status queued.`
          : "Tidak ada sample failed yang perlu diretry.",
      retried
    })
  }

  if (action === "trigger_training") {
    const result = await triggerRoboflowTraining()
    return NextResponse.json(
      {
        ok: result.ok,
        message: result.message,
        status: result.status,
        response: result.response,
        config: getTrainingPipelineConfigState()
      },
      {
        status: result.ok ? 200 : 400
      }
    )
  }

  return jsonError(400, "INVALID_ACTION", "Action tidak valid untuk pipeline training.")
}
