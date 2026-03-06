import {
  normalizeConfig,
  normalizePipelineState,
  normalizeSummary,
  type TrainingConfigState,
  type TrainingPipelineState,
  type TrainingSummaryState
} from "@/components/admin/training/training-page-state"
import {
  normalizeInferenceRuntime,
  type InferenceRuntimeState
} from "@/lib/inference-runtime-state"
import type { CreateTrainingSampleInput, TrainingAnnotation, TrainingSample } from "@/lib/training-types"

type ResponseBody = Record<string, unknown>

type MessageResult = {
  ok: boolean
  message: string
}

export interface TrainingSamplesResponse extends MessageResult {
  samples: TrainingSample[]
  summary: TrainingSummaryState
  config: TrainingConfigState | null
  pipelineState: TrainingPipelineState | null
}

export interface InferenceRuntimeResponse extends MessageResult {
  runtime: InferenceRuntimeState | null
}

function readBody(payload: unknown): ResponseBody {
  return payload && typeof payload === "object" ? (payload as ResponseBody) : {}
}

function readErrorMessage(body: ResponseBody, fallback: string): string {
  const errorObject =
    body.error && typeof body.error === "object" ? (body.error as ResponseBody) : {}
  const message = typeof errorObject.message === "string" ? errorObject.message.trim() : ""
  return message.length > 0 ? message : fallback
}

function readResponseMessage(body: ResponseBody, successFallback: string, errorFallback: string): string {
  const message = typeof body.message === "string" ? body.message.trim() : ""
  if (message.length > 0) {
    return message
  }

  return body.ok === true ? successFallback : errorFallback
}

export async function fetchTrainingSamplesState(): Promise<TrainingSamplesResponse> {
  const response = await fetch("/api/admin/training/samples", {
    method: "GET",
    cache: "no-store"
  })
  const body = readBody(await response.json())

  return {
    ok: response.ok,
    message: response.ok ? "Data training berhasil dimuat." : readErrorMessage(body, "Gagal memuat data training."),
    samples: Array.isArray(body.samples) ? (body.samples as TrainingSample[]) : [],
    summary: normalizeSummary(body.summary),
    config: normalizeConfig(body.config),
    pipelineState: normalizePipelineState(body.pipelineState)
  }
}

export async function fetchInferenceRuntimeState(): Promise<InferenceRuntimeResponse> {
  const response = await fetch("/api/admin/inference-runtime", {
    method: "GET",
    cache: "no-store"
  })
  const body = readBody(await response.json())
  const runtime = normalizeInferenceRuntime(body.runtime)

  return {
    ok: response.ok,
    message: response.ok
      ? runtime?.health?.message ?? "Status runtime inference berhasil dimuat."
      : "Gagal memuat status runtime inference.",
    runtime
  }
}

export async function createTrainingSampleRequest(input: CreateTrainingSampleInput): Promise<MessageResult> {
  const response = await fetch("/api/admin/training/samples", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  })
  const body = readBody(await response.json())

  return {
    ok: response.ok && body.ok === true,
    message:
      response.ok && body.ok === true
        ? readResponseMessage(body, "Sample training berhasil disimpan.", "")
        : readErrorMessage(body, "Gagal menyimpan sample training.")
  }
}

export async function deleteTrainingSampleRequest(sampleId: string): Promise<MessageResult> {
  const response = await fetch(`/api/admin/training/samples?id=${encodeURIComponent(sampleId)}`, {
    method: "DELETE"
  })
  const body = readBody(await response.json())

  return {
    ok: response.ok && body.ok === true,
    message:
      response.ok && body.ok === true
        ? "Sample training berhasil dihapus."
        : readErrorMessage(body, "Gagal menghapus sample.")
  }
}

export async function updateTrainingAnnotationsRequest(
  sampleId: string,
  annotations: TrainingAnnotation[]
): Promise<MessageResult> {
  const response = await fetch("/api/admin/training/samples", {
    method: "PATCH",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      id: sampleId,
      annotations
    })
  })
  const body = readBody(await response.json())

  return {
    ok: response.ok && body.ok === true,
    message:
      response.ok && body.ok === true
        ? "Anotasi sample berhasil diperbarui."
        : readErrorMessage(body, "Gagal memperbarui anotasi.")
  }
}

export async function runTrainingPipelineRequest(
  action:
    | "upload_pending"
    | "retry_failed"
    | "trigger_training"
    | "sync_training_status"
    | "set_inference_target"
    | "resume_deployment"
    | "check_deployment_status",
  payload?: Record<string, unknown>
): Promise<MessageResult> {
  const response = await fetch("/api/admin/training/pipeline", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      action,
      ...(payload ?? {})
    })
  })
  const body = readBody(await response.json())

  return {
    ok: response.ok,
    message: readResponseMessage(body, "Pipeline action selesai.", "Pipeline action gagal.")
  }
}
