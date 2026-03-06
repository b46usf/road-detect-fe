import { NextResponse } from "next/server"
import { toFiniteNumber } from "@/lib/common-utils"
import {
  buildDamageSummary,
  normalizePredictions,
  parseVisualEvidence
} from "@/lib/roboflow-utils"
import type {
  ExecutedRoboflowInference,
  ParsedRoboflowInferenceRequest
} from "@/lib/server/roboflow-api-types"

export function jsonError(status: number, code: string, message: string, details?: unknown) {
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

function jsonSuccess(data: unknown, message: string, meta?: Record<string, unknown>) {
  return NextResponse.json({
    ok: true,
    message,
    data,
    ...(meta ? { meta } : {})
  })
}

function sanitizeInferenceUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    url.searchParams.delete("api_key")
    return url.toString()
  } catch {
    return rawUrl
  }
}

export function mapRoboflowInferenceSuccess(params: {
  request: ParsedRoboflowInferenceRequest
  execution: ExecutedRoboflowInference
  durationMs: number
}) {
  const { request, execution, durationMs } = params
  const inferenceObject = execution.upstreamData
  const responseImage = inferenceObject.image
  const responseImageObject =
    responseImage && typeof responseImage === "object"
      ? (responseImage as Record<string, unknown>)
      : {}

  const frameWidth = toFiniteNumber(responseImageObject.width) ?? request.requestFrameWidth
  const frameHeight = toFiniteNumber(responseImageObject.height) ?? request.requestFrameHeight
  const predictions = normalizePredictions(inferenceObject.predictions)
  const damageSummary = buildDamageSummary(predictions, frameWidth, frameHeight)

  const visualEvidence = parseVisualEvidence(
    request.evidence,
    request.imageInput,
    request.requestFrameWidth ?? frameWidth,
    request.requestFrameHeight ?? frameHeight
  )

  const report = {
    luasanKerusakan: {
      totalPersentase: damageSummary.totalDamagePercent,
      totalBoxAreaPx: damageSummary.totalBoxAreaPx,
      frameAreaPx: damageSummary.frameAreaPx
    },
    tingkatKerusakan: {
      dominan: damageSummary.dominantSeverity,
      jumlah: {
        ...damageSummary.counts,
        totalDeteksi:
          damageSummary.counts.ringan + damageSummary.counts.sedang + damageSummary.counts.berat
      },
      distribusiPersentase: damageSummary.distributionPercent
    },
    breakdownKelas: damageSummary.breakdownKelas,
    lokasi: request.requestLocation,
    waktuDeteksi: request.detectedAt,
    visualBukti: visualEvidence
  }

  return jsonSuccess(
    {
      ...inferenceObject,
      report
    },
    "Deteksi berhasil diproses.",
    {
      modelId: execution.resolvedEndpoint.modelMeta.modelId ?? (execution.modelId || null),
      modelVersion: execution.resolvedEndpoint.modelMeta.modelVersion ?? (execution.modelVersion || null),
      inferenceTarget: execution.pipelineState.inferenceTarget,
      inferenceEndpoint: sanitizeInferenceUrl(execution.resolvedEndpoint.roboflowUrl),
      durationMs
    }
  )
}
