import { toFiniteNumber } from "./common-utils"
import {
  extractDetectionReport,
  type DetectionReport,
  type InferenceDataPayload,
  type DominantSeverity
} from "./roboflow-report-parser"

export type { DetectionReport, InferenceDataPayload, DominantSeverity }

export interface ApiErrorInfo {
  code: string | null
  message: string
}

export interface ParsedInferenceResponse {
  data: InferenceDataPayload
  report: DetectionReport | null
  message: string
  durationMs: number | null
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

export function extractApiErrorInfo(payload: unknown): ApiErrorInfo | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const source = payload as Record<string, unknown>

  if (source.ok === true) {
    return null
  }

  if (source.ok === false) {
    const envelopeError = readObject(source.error)

    const code =
      typeof envelopeError.code === "string" && envelopeError.code.trim().length > 0
        ? envelopeError.code
        : null

    const message =
      (typeof envelopeError.message === "string" && envelopeError.message.trim().length > 0
        ? envelopeError.message
        : "") ||
      (typeof source.message === "string" && source.message.trim().length > 0 ? source.message : "") ||
      "Request API gagal diproses."

    return { code, message }
  }

  if (typeof source.error === "string" && source.error.trim().length > 0) {
    return { code: null, message: source.error }
  }

  return null
}

export function parseInferenceResponse(payload: unknown): ParsedInferenceResponse {
  if (!payload || typeof payload !== "object") {
    return {
      data: {},
      report: null,
      message: "Deteksi berhasil diproses.",
      durationMs: null
    }
  }

  const source = payload as Record<string, unknown>

  if (source.ok === true) {
    const message =
      typeof source.message === "string" && source.message.trim().length > 0
        ? source.message
        : "Deteksi berhasil diproses."

    const rawData = readObject(source.data)
    const nestedInference = rawData.inference
    const hasNestedInference = nestedInference && typeof nestedInference === "object"

    const data = (hasNestedInference ? nestedInference : rawData) as InferenceDataPayload
    const report = extractDetectionReport(rawData.report)
    const durationMs =
      source.meta && typeof source.meta === "object"
        ? toFiniteNumber((source.meta as Record<string, unknown>).durationMs)
        : null

    return { data, report, message, durationMs }
  }

  return {
    data: source as InferenceDataPayload,
    report: extractDetectionReport(source.report),
    message: "Deteksi berhasil diproses.",
    durationMs: null
  }
}

export function extractUpstreamMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const source = payload as Record<string, unknown>

  const candidates = [source.error, source.message, source.reason, source.inner_error_message]
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }

  if (Array.isArray(source.detail) && source.detail.length > 0) {
    const firstDetail = source.detail[0]
    if (typeof firstDetail === "string" && firstDetail.trim().length > 0) {
      return firstDetail.trim()
    }

    if (firstDetail && typeof firstDetail === "object") {
      const firstDetailObject = firstDetail as Record<string, unknown>
      const detailMessage =
        typeof firstDetailObject.msg === "string" && firstDetailObject.msg.trim().length > 0
          ? firstDetailObject.msg.trim()
          : null

      const detailLocation = Array.isArray(firstDetailObject.loc)
        ? firstDetailObject.loc
            .filter((segment): segment is string => typeof segment === "string" && segment.length > 0)
            .join(".")
        : ""

      if (detailMessage && detailLocation) {
        return `${detailMessage} (${detailLocation})`
      }

      if (detailMessage) {
        return detailMessage
      }
    }
  }

  if (source.error && typeof source.error === "object") {
    const errorObject = source.error as Record<string, unknown>
    const message =
      (typeof errorObject.message === "string" && errorObject.message.trim()) ||
      (typeof errorObject.error === "string" && errorObject.error.trim())
    if (message) {
      return message
    }
  }

  if (Array.isArray(source.errors) && source.errors.length > 0) {
    const first = source.errors[0]
    if (typeof first === "string" && first.trim().length > 0) {
      return first.trim()
    }
    if (first && typeof first === "object") {
      const firstObject = first as Record<string, unknown>
      const message =
        (typeof firstObject.message === "string" && firstObject.message.trim()) ||
        (typeof firstObject.error === "string" && firstObject.error.trim())
      if (message) {
        return message
      }
    }
  }

  return null
}

export function translateUpstreamMessage(raw: string): string {
  const map: Record<string, string> = {
    "Method Not Allowed": "Metode tidak diizinkan",
    "Not Found": "Tidak ditemukan",
    "Bad Request": "Permintaan tidak valid",
    Unauthorized: "Tidak terautentikasi",
    "Internal Server Error": "Kesalahan server"
  }

  return map[raw] || raw
}
