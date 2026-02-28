import { NextResponse } from "next/server"
import {
  buildDamageSummary,
  normalizePredictions,
  parseVisualEvidence
} from "@/lib/roboflow-utils"
import {
  normalizeImageInput,
  parseDetectedAt,
  parseLocation,
  readString,
  toFiniteNumber
} from "@/lib/common-utils"
import { extractUpstreamMessage, translateUpstreamMessage } from "@/lib/roboflow-client"
import { requireRoboflowEndpointSecret } from "@/lib/server/roboflow-endpoint-auth"
import { buildRoboflowPath } from "@/lib/server/roboflow-model-path"
import { applyRoboflowRateLimit } from "@/lib/server/roboflow-rate-limit"
import { validateRoboflowApiKey } from "@/lib/server/roboflow-api-key-validation"
import {
  forwardInferenceToRoboflow,
  isOriginAllowed,
  parseOptionalNumber
} from "@/lib/server/roboflow-inference-request"

interface InferRequestBody {
  image?: unknown
  modelId?: unknown
  modelVersion?: unknown
  confidence?: unknown
  overlap?: unknown
  frameWidth?: unknown
  frameHeight?: unknown
  detectedAt?: unknown
  location?: unknown
  evidence?: unknown
}

const MAX_IMAGE_BASE64_LENGTH = 1_500_000
const VALID_FETCH_SITES = new Set(["same-origin", "same-site", "none"])

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

function jsonSuccess(data: unknown, message: string, meta?: Record<string, unknown>) {
  return NextResponse.json({
    ok: true,
    message,
    data,
    ...(meta ? { meta } : {})
  })
}

export async function POST(request: Request) {
  const startedAt = Date.now()

  const apiKey = process.env.ROBOFLOW_API_KEY
  if (!apiKey) {
    return jsonError(500, "ENV_MISSING", "ROBOFLOW_API_KEY belum diset di environment server.")
  }

  const unauthorized = requireRoboflowEndpointSecret(request)
  if (unauthorized) {
    return unauthorized
  }

  const contentType = readString(request.headers.get("content-type")).toLowerCase()
  if (!contentType.includes("application/json")) {
    return jsonError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type harus application/json.")
  }

  const fetchSite = readString(request.headers.get("sec-fetch-site")).toLowerCase()
  if (fetchSite && !VALID_FETCH_SITES.has(fetchSite)) {
    return jsonError(403, "FORBIDDEN_ORIGIN", "Permintaan lintas-origin tidak diizinkan.")
  }

  if (!isOriginAllowed(request)) {
    return jsonError(403, "ORIGIN_NOT_ALLOWED", "Origin request tidak diizinkan.")
  }

  const rateLimit = applyRoboflowRateLimit(request)
  if (!rateLimit.ok) {
    return jsonError(rateLimit.status, rateLimit.code, rateLimit.message, rateLimit.details)
  }

  const skipValidationEnv = readString(process.env.ROBOFLOW_SKIP_KEY_VALIDATION)
  if (skipValidationEnv !== "true") {
    const validation = await validateRoboflowApiKey(apiKey)
    if (!validation.ok) {
      return jsonError(
        401,
        "INVALID_API_KEY",
        "ROBOFLOW_API_KEY tidak valid atau tidak dapat diverifikasi.",
        { upstream: validation.info ?? null }
      )
    }
  } else {
    console.info("Skipping Roboflow API key validation via ROBOFLOW_SKIP_KEY_VALIDATION")
  }

  let payload: InferRequestBody
  try {
    payload = (await request.json()) as InferRequestBody
  } catch {
    return jsonError(400, "INVALID_JSON", "Body request harus berupa JSON yang valid.")
  }

  const imageInput = readString(payload.image)
  const modelId = readString(payload.modelId) || readString(process.env.ROBOFLOW_MODEL_ID)
  const modelVersion = readString(payload.modelVersion) || readString(process.env.ROBOFLOW_MODEL_VERSION)

  if (!imageInput) {
    return jsonError(400, "IMAGE_REQUIRED", "Field `image` wajib diisi (base64/data URL).")
  }

  if (!modelId || !modelVersion) {
    return jsonError(
      400,
      "MODEL_REQUIRED",
      "Field `modelId` dan `modelVersion` wajib diisi, atau set env `ROBOFLOW_MODEL_ID` dan `ROBOFLOW_MODEL_VERSION`."
    )
  }

  const confidence = parseOptionalNumber(payload.confidence)
  if (confidence === "invalid") {
    return jsonError(400, "INVALID_CONFIDENCE", "Field `confidence` harus berupa angka jika dikirim.")
  }

  const overlap = parseOptionalNumber(payload.overlap)
  if (overlap === "invalid") {
    return jsonError(400, "INVALID_OVERLAP", "Field `overlap` harus berupa angka jika dikirim.")
  }

  const normalizedImage = normalizeImageInput(imageInput)
  const cleanedBase64 = normalizedImage.replace(/\s+/g, "")
  if (cleanedBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    return jsonError(413, "PAYLOAD_TOO_LARGE", "Ukuran gambar terlalu besar untuk diproses.", {
      maxBase64Length: MAX_IMAGE_BASE64_LENGTH
    })
  }

  try {
    const buffer = Buffer.from(cleanedBase64, "base64")
    const reencoded = buffer.toString("base64").replace(/=+$/, "")
    const originalNoPad = cleanedBase64.replace(/=+$/, "")

    if (buffer.length === 0 || reencoded !== originalNoPad) {
      throw new Error("invalid base64 payload")
    }
  } catch {
    return jsonError(400, "INVALID_BASE64", "Field `image` berisi base64 tidak valid atau korup.")
  }

  const detectedAt = parseDetectedAt(payload.detectedAt)
  const requestLocation = parseLocation(payload.location)
  const requestFrameWidth = toFiniteNumber(payload.frameWidth)
  const requestFrameHeight = toFiniteNumber(payload.frameHeight)

  const query = new URLSearchParams({ api_key: apiKey })
  if (confidence !== null) {
    query.set("confidence", confidence)
  }
  if (overlap !== null) {
    query.set("overlap", overlap)
  }

  const builtPath = buildRoboflowPath(modelId, modelVersion)
  if (!builtPath) {
    return jsonError(
      400,
      "INVALID_MODEL_PATH",
      "Format `modelId` atau `modelVersion` tidak valid. Gunakan nama model yang benar (mis. 'workspace/model' atau hanya 'model')."
    )
  }

  const roboflowUrl = `https://detect.roboflow.com/${builtPath.path}?${query.toString()}`

  try {
    const upstream = await forwardInferenceToRoboflow({
      roboflowUrl,
      cleanedBase64,
      imageInput
    })

    if (!upstream.ok) {
      const upstreamMessageRaw = extractUpstreamMessage(upstream.responseData)
      const upstreamMessage = upstreamMessageRaw ? translateUpstreamMessage(upstreamMessageRaw) : null

      return jsonError(
        upstream.status,
        "UPSTREAM_HTTP_ERROR",
        upstreamMessage
          ? `Request ke Roboflow gagal: ${upstreamMessage}`
          : "Request ke Roboflow gagal.",
        {
          upstreamStatus: upstream.status,
          upstreamMessage: upstreamMessageRaw ?? null,
          upstreamBody: upstream.responseData
        }
      )
    }

    const inferenceObject =
      upstream.responseData && typeof upstream.responseData === "object"
        ? (upstream.responseData as Record<string, unknown>)
        : ({ raw: upstream.responseData } as Record<string, unknown>)

    const responseImage = inferenceObject.image
    const responseImageObject =
      responseImage && typeof responseImage === "object"
        ? (responseImage as Record<string, unknown>)
        : {}

    const frameWidth = toFiniteNumber(responseImageObject.width) ?? requestFrameWidth
    const frameHeight = toFiniteNumber(responseImageObject.height) ?? requestFrameHeight

    const predictions = normalizePredictions(inferenceObject.predictions)
    const damageSummary = buildDamageSummary(predictions, frameWidth, frameHeight)

    const visualEvidence = parseVisualEvidence(
      payload.evidence,
      imageInput,
      requestFrameWidth ?? frameWidth,
      requestFrameHeight ?? frameHeight
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
      lokasi: requestLocation,
      waktuDeteksi: detectedAt,
      visualBukti: visualEvidence
    }

    return jsonSuccess(
      {
        ...inferenceObject,
        report
      },
      "Deteksi berhasil diproses.",
      {
        modelId: builtPath.normalizedModelId || modelId,
        modelVersion,
        durationMs: Date.now() - startedAt
      }
    )
  } catch {
    return jsonError(502, "UPSTREAM_NETWORK_ERROR", "Tidak dapat terhubung ke layanan Roboflow.")
  }
}
