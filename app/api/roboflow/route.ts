import { NextResponse } from "next/server"
import {
  ParsedPrediction,
  SeverityLevel,
  DominantSeverity,
  normalizePredictions,
  classifySeverity,
  buildDamageSummary,
} from "../../../lib/roboflow-utils"
import { toFiniteNumber, readString, normalizeImageInput, extractMimeFromDataUrl, parseDetectedAt } from "../../../lib/common-utils"

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

interface RateLimitRecord {
  windowStart: number
  count: number
  lastRequestAt: number
}

interface ReportLocation {
  latitude: number
  longitude: number
  accuracy: number | null
  altitude: number | null
  heading: number | null
  speed: number | null
  timestamp: string | null
  source: string
}

interface ReportVisualEvidence {
  imageDataUrl: string | null
  mime: string
  quality: number | null
  resolusiCapture: {
    width: number | null
    height: number | null
  }
  resolusiSource: {
    width: number | null
    height: number | null
  }
  isFhdSource: boolean | null
}

declare global {
  var __roboflowRateLimitStore: Map<string, RateLimitRecord> | undefined
}

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 30
const RATE_LIMIT_MIN_INTERVAL_MS = 1_500
const RATE_LIMIT_MAX_RECORDS = 1_000
const MAX_IMAGE_BASE64_LENGTH = 1_500_000
const VALID_FETCH_SITES = new Set(["same-origin", "same-site", "none"])

// severity thresholds are defined in lib/roboflow-utils

const rateLimitStore =
  globalThis.__roboflowRateLimitStore ?? (globalThis.__roboflowRateLimitStore = new Map())

function parseOptionalNumber(value: unknown): string | null | "invalid" {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "invalid"
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? String(parsed) : "invalid"
  }

  return "invalid"
}

// primitive helpers (toFiniteNumber, normalizeImageInput, readString)
// are imported from lib/common-utils

function splitModelIdSegments(rawModelId: string): string[] {
  const normalized = rawModelId
    .trim()
    .replace(/^https?:\/\/detect\.roboflow\.com\//i, "")
    .replace(/^\/+|\/+$/g, "")

  if (!normalized) {
    return []
  }

  return normalized
    .split("/")
    .map((segment) => {
      const cleaned = segment.trim()
      if (!cleaned) {
        return ""
      }

      try {
        return decodeURIComponent(cleaned).trim()
      } catch {
        return cleaned
      }
    })
    .filter((segment) => segment.length > 0)
}

function buildRoboflowPath(
  modelId: string,
  modelVersion: string
): { path: string; normalizedModelId: string } | null {
  const normalizedVersion = modelVersion.trim()
  if (!normalizedVersion) {
    return null
  }

  const segments = splitModelIdSegments(modelId)
  if (segments.length === 0) {
    return null
  }

  const lastSegment = segments[segments.length - 1]
  if (lastSegment === normalizedVersion) {
    segments.pop()
  }

  if (segments.length === 0) {
    return null
  }

  const encodedPath = [...segments.map((segment) => encodeURIComponent(segment)), encodeURIComponent(normalizedVersion)].join("/")
  return {
    path: encodedPath,
    normalizedModelId: segments.join("/")
  }
}

function extractUpstreamMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const source = payload as Record<string, unknown>

  const candidates = [source.error, source.message, source.detail, source.reason]
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim()
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

// Roboflow biasanya mengembalikan pesan dalam bahasa Inggris. untuk
// pengalaman pengguna bahasa Indonesia, kita terjemahkan beberapa pesan
// umum sebelum menampilkannya ke front‑end.
function translateUpstreamMessage(raw: string): string {
  const map: Record<string, string> = {
    "Method Not Allowed": "Metode tidak diizinkan",
    "Not Found": "Tidak ditemukan",
    "Bad Request": "Permintaan tidak valid",
    "Unauthorized": "Tidak terautentikasi",
    "Internal Server Error": "Kesalahan server",
    // tambahkan bila diperlukan
  }

  return map[raw] || raw
}

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

function buildClientKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")
  const ipFromForwarded = forwardedFor ? forwardedFor.split(",")[0]?.trim() : ""
  const ip = ipFromForwarded || readString(request.headers.get("x-real-ip")) || "unknown"
  const userAgent = readString(request.headers.get("user-agent")).slice(0, 100) || "ua"
  return `${ip}:${userAgent}`
}

function cleanRateLimitStore(now: number) {
  if (rateLimitStore.size <= RATE_LIMIT_MAX_RECORDS) {
    return
  }

  for (const [key, record] of rateLimitStore.entries()) {
    if (now - record.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitStore.delete(key)
    }
  }
}

function applyRateLimit(request: Request):
  | { ok: true }
  | { ok: false; response: ReturnType<typeof jsonError> } {
  const now = Date.now()
  const key = buildClientKey(request)
  const record = rateLimitStore.get(key)

  if (!record) {
    rateLimitStore.set(key, {
      windowStart: now,
      count: 1,
      lastRequestAt: now
    })
    cleanRateLimitStore(now)
    return { ok: true }
  }

  if (now - record.windowStart >= RATE_LIMIT_WINDOW_MS) {
    record.windowStart = now
    record.count = 0
  }

  const deltaFromLastRequest = now - record.lastRequestAt
  if (deltaFromLastRequest < RATE_LIMIT_MIN_INTERVAL_MS) {
    return {
      ok: false,
      response: jsonError(
        429,
        "RATE_LIMIT_THROTTLED",
        `Request terlalu cepat. Minimal interval ${RATE_LIMIT_MIN_INTERVAL_MS}ms.`,
        {
          retryAfterMs: RATE_LIMIT_MIN_INTERVAL_MS - deltaFromLastRequest
        }
      )
    }
  }

  record.count += 1
  record.lastRequestAt = now

  if (record.count > RATE_LIMIT_MAX_REQUESTS) {
    return {
      ok: false,
      response: jsonError(
        429,
        "RATE_LIMIT_EXCEEDED",
        `Batas request per menit terlampaui (${RATE_LIMIT_MAX_REQUESTS}/menit).`,
        {
          retryAfterMs: Math.max(0, RATE_LIMIT_WINDOW_MS - (now - record.windowStart))
        }
      )
    }
  }

  cleanRateLimitStore(now)
  return { ok: true }
}

function isOriginAllowed(request: Request): boolean {
  const origin = readString(request.headers.get("origin"))
  if (!origin) {
    return true
  }

  const host = readString(request.headers.get("host"))
  if (!host) {
    return false
  }

  try {
    const originUrl = new URL(origin)
    if (originUrl.host === host) {
      return true
    }
  } catch {
    return false
  }

  const rawAllowedOrigins = readString(process.env.ROBOFLOW_ALLOWED_ORIGINS)
  if (!rawAllowedOrigins) {
    return false
  }

  const allowedOrigins = rawAllowedOrigins
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

  return allowedOrigins.includes(origin)
}

// `parseDetectedAt` implemented in lib/common-utils

function parseLocation(value: unknown): ReportLocation | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const source = value as Record<string, unknown>
  const latitude = toFiniteNumber(source.latitude ?? source.lat)
  const longitude = toFiniteNumber(source.longitude ?? source.lng ?? source.lon)

  if (latitude === null || longitude === null) {
    return null
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null
  }

  const rawTimestamp = source.timestamp
  const timestamp =
    typeof rawTimestamp === "string" && rawTimestamp.trim().length > 0
      ? parseDetectedAt(rawTimestamp)
      : typeof rawTimestamp === "number" && Number.isFinite(rawTimestamp)
        ? new Date(rawTimestamp).toISOString()
        : null

  const sourceLabel = readString(source.source ?? source.provider) || "gps"

  return {
    latitude,
    longitude,
    accuracy: toFiniteNumber(source.accuracy),
    altitude: toFiniteNumber(source.altitude),
    heading: toFiniteNumber(source.heading),
    speed: toFiniteNumber(source.speed),
    timestamp,
    source: sourceLabel
  }
}

// `extractMimeFromDataUrl` implemented in lib/common-utils

function parseVisualEvidence(
  evidenceValue: unknown,
  rawImageInput: string,
  fallbackCaptureWidth: number | null,
  fallbackCaptureHeight: number | null
): ReportVisualEvidence {
  const source = evidenceValue && typeof evidenceValue === "object" ? (evidenceValue as Record<string, unknown>) : {}

  const captureWidth = toFiniteNumber(source.captureWidth ?? source.frameWidth) ?? fallbackCaptureWidth
  const captureHeight = toFiniteNumber(source.captureHeight ?? source.frameHeight) ?? fallbackCaptureHeight
  const sourceWidth = toFiniteNumber(source.sourceWidth) ?? captureWidth
  const sourceHeight = toFiniteNumber(source.sourceHeight) ?? captureHeight

  const mime = readString(source.mime) || extractMimeFromDataUrl(rawImageInput) || "image/jpeg"
  const quality = toFiniteNumber(source.quality)
  const imageDataUrl = rawImageInput.startsWith("data:") ? rawImageInput : null

  const isFhdSource =
    sourceWidth !== null && sourceHeight !== null
      ? Math.max(sourceWidth, sourceHeight) >= 1920 && Math.min(sourceWidth, sourceHeight) >= 1080
      : null

  return {
    imageDataUrl,
    mime,
    quality,
    resolusiCapture: {
      width: captureWidth,
      height: captureHeight
    },
    resolusiSource: {
      width: sourceWidth,
      height: sourceHeight
    },
    isFhdSource
  }
}
  // prediction normalization and damage-summary helpers are provided by lib/roboflow-utils

export async function POST(request: Request) {
  const startedAt = Date.now()
  const apiKey = process.env.ROBOFLOW_API_KEY
  if (!apiKey) {
    return jsonError(500, "ENV_MISSING", "ROBOFLOW_API_KEY belum diset di environment server.")
  }

  const endpointSecret = readString(process.env.ROBOFLOW_ENDPOINT_SECRET)
  if (endpointSecret) {
    const incomingSecret = readString(request.headers.get("x-roboflow-endpoint-secret"))
    if (!incomingSecret || incomingSecret !== endpointSecret) {
      return jsonError(401, "UNAUTHORIZED", "Akses endpoint ditolak.")
    }
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

  const rateLimitResult = applyRateLimit(request)
  if (!rateLimitResult.ok) {
    return rateLimitResult.response
  }

  let payload: InferRequestBody
  try {
    payload = (await request.json()) as InferRequestBody
  } catch {
    return jsonError(400, "INVALID_JSON", "Body request harus berupa JSON yang valid.")
  }

  const imageInput = readString(payload.image)
  const modelId = readString(payload.modelId) || readString(process.env.ROBOFLOW_MODEL_ID)
  const modelVersion =
    readString(payload.modelVersion) || readString(process.env.ROBOFLOW_MODEL_VERSION)

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
  if (normalizedImage.length > MAX_IMAGE_BASE64_LENGTH) {
    return jsonError(413, "PAYLOAD_TOO_LARGE", "Ukuran gambar terlalu besar untuk diproses.", {
      maxBase64Length: MAX_IMAGE_BASE64_LENGTH
    })
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
      "Format `modelId` atau `modelVersion` tidak valid. Pastikan `modelId` menggunakan format 'workspace/model'."
    )
  }

  const roboflowUrl = `https://detect.roboflow.com/${builtPath.path}?${query.toString()}`

  const body = new URLSearchParams({
    image: normalizedImage
  })

  try {
    const roboflowResponse = await fetch(roboflowUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body,
      cache: "no-store"
    })

    const responseText = await roboflowResponse.text()
    let responseData: unknown = { raw: responseText }
    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = { raw: responseText }
    }

    if (!roboflowResponse.ok) {
      // coba fallback GET apabila server mengatakan method tidak diijinkan.
      if (roboflowResponse.status === 405) {
        try {
          const fallbackUrl = `${roboflowUrl}&image=${encodeURIComponent(normalizedImage)}`
          const getResp = await fetch(fallbackUrl, { method: "GET", cache: "no-store" })
          if (getResp.ok) {
            // berhasil pada GET, gunakan respons ini sebagai hasil akhir
            responseText = await getResp.text()
            responseData = (() => {
              try {
                return JSON.parse(responseText)
              } catch {
                return { raw: responseText }
              }
            })()
            // terus ke pemrosesan sukses di bawah
          } else {
            // tetap 405 atau error lain, teruskan penanganan normal
            const upstreamMessageRaw = extractUpstreamMessage(responseData)
            const upstreamMessage = upstreamMessageRaw
              ? translateUpstreamMessage(upstreamMessageRaw)
              : null

            return jsonError(
              getResp.status,
              "UPSTREAM_HTTP_ERROR",
              upstreamMessage
                ? `Request ke Roboflow gagal: ${upstreamMessage}`
                : "Request ke Roboflow gagal.",
              {
                upstreamStatus: getResp.status,
                upstreamMessage: upstreamMessageRaw ?? null,
                upstreamBody: responseData
              }
            )
          }
        } catch {
          // jatuhkan ke blok bawah untuk melaporkan 405 asli
        }
      }

      const upstreamMessageRaw = extractUpstreamMessage(responseData)
      const upstreamMessage = upstreamMessageRaw
        ? translateUpstreamMessage(upstreamMessageRaw)
        : null

      return jsonError(
        roboflowResponse.status,
        "UPSTREAM_HTTP_ERROR",
        upstreamMessage
          ? `Request ke Roboflow gagal: ${upstreamMessage}`
          : "Request ke Roboflow gagal.",
        {
          upstreamStatus: roboflowResponse.status,
          upstreamMessage: upstreamMessageRaw ?? null,
          upstreamBody: responseData
        }
      )
    }

    const inferenceObject =
      responseData && typeof responseData === "object"
        ? (responseData as Record<string, unknown>)
        : ({ raw: responseData } as Record<string, unknown>)

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
