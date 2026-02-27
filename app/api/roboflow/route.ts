import { NextResponse } from "next/server"
import {
  ParsedPrediction,
  SeverityLevel,
  DominantSeverity,
  normalizePredictions,
  classifySeverity,
  buildDamageSummary,
} from "../../../lib/roboflow-utils"
import { toFiniteNumber, readString, normalizeImageInput, parseDetectedAt, parseLocation, extractMimeFromDataUrl } from "../../../lib/common-utils"
import { parseVisualEvidence } from "../../../lib/roboflow-utils"
import { extractUpstreamMessage, translateUpstreamMessage } from "../../../lib/roboflow-client"

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
// API key validation TTL (ms). Can be overridden with env `ROBOFLOW_API_KEY_VALIDATION_TTL_MS`.
const API_KEY_VALIDATION_TTL_MS = Number(process.env.ROBOFLOW_API_KEY_VALIDATION_TTL_MS) || 60_000 // default 1 minute
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

// `extractUpstreamMessage` and `translateUpstreamMessage` are implemented
// in `lib/roboflow-client.ts` and imported above for reuse.

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
    // Normalize host and compare hostname (strip possible port from host header)
    const hostOnly = host.split(":")[0]
    if (originUrl.hostname === hostOnly || originUrl.host === host) {
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

// cache validation result in-memory to avoid frequent validation calls
declare global {
  var __roboflowApiKeyValidation: {
    key: string
    ok: boolean
    expiresAt: number
    info?: unknown
  } | undefined

  // simple in-memory stats for key validation failures
  var __roboflowApiKeyValidationStats: {
    invalidCount: number
    lastInvalidAt?: number
  } | undefined
}

async function validateApiKey(apiKey: string): Promise<{ ok: boolean; info?: unknown }> {
  const now = Date.now()
  const store = globalThis.__roboflowApiKeyValidation
  if (store && store.key === apiKey && store.expiresAt > now) {
    return { ok: store.ok, info: store.info }
  }

  try {
    const url = `https://api.roboflow.com/?api_key=${encodeURIComponent(apiKey)}`
    const resp = await fetch(url, { method: "GET", cache: "no-store" })
    const text = await resp.text()
    let body: unknown = { raw: text }
    try {
      body = JSON.parse(text)
    } catch {
      body = { raw: text }
    }

    const ok = resp.ok
    globalThis.__roboflowApiKeyValidation = {
      key: apiKey,
      ok,
      expiresAt: now + API_KEY_VALIDATION_TTL_MS,
      info: { status: resp.status, body }
    }

    if (!ok) {
      // increment simple in-memory metric
      globalThis.__roboflowApiKeyValidationStats = globalThis.__roboflowApiKeyValidationStats ?? { invalidCount: 0 }
      globalThis.__roboflowApiKeyValidationStats.invalidCount += 1
      globalThis.__roboflowApiKeyValidationStats.lastInvalidAt = now
      console.warn("Roboflow API key validation failed", { status: resp.status, body })
    }

    return { ok, info: { status: resp.status, body } }
  } catch (err) {
    // network/other error when validating key - treat as invalid but include info
    const info = { error: err instanceof Error ? err.message : String(err) }
    globalThis.__roboflowApiKeyValidation = {
      key: apiKey,
      ok: false,
      expiresAt: now + API_KEY_VALIDATION_TTL_MS,
      info
    }
    globalThis.__roboflowApiKeyValidationStats = globalThis.__roboflowApiKeyValidationStats ?? { invalidCount: 0 }
    globalThis.__roboflowApiKeyValidationStats.invalidCount += 1
    globalThis.__roboflowApiKeyValidationStats.lastInvalidAt = now
    console.warn("Roboflow API key validation error", info)
    return { ok: false, info }
  }
}

// `parseDetectedAt` implemented in lib/common-utils

// parseLocation and parseVisualEvidence are centralized in lib/common-utils and lib/roboflow-utils
  // prediction normalization and damage-summary helpers are provided by lib/roboflow-utils

export async function POST(request: Request) {
  const startedAt = Date.now()
  const apiKey = process.env.ROBOFLOW_API_KEY
  if (!apiKey) {
    return jsonError(500, "ENV_MISSING", "ROBOFLOW_API_KEY belum diset di environment server.")
  }

  // Option to skip API key validation via env (set to 'true' to skip)
  const skipValidationEnv = readString(process.env.ROBOFLOW_SKIP_KEY_VALIDATION)
  const skipKeyValidation = skipValidationEnv === "true"

  if (!skipKeyValidation) {
    // validate API key with upstream Roboflow before attempting inference
    const keyValidation = await validateApiKey(apiKey)
    if (!keyValidation.ok) {
      const upstreamMessage = keyValidation.info ?? null
      // record quick metric available on global
      globalThis.__roboflowApiKeyValidationStats = globalThis.__roboflowApiKeyValidationStats ?? { invalidCount: 0 }
      globalThis.__roboflowApiKeyValidationStats.invalidCount += 1

      return jsonError(
        401,
        "INVALID_API_KEY",
        "ROBOFLOW_API_KEY tidak valid atau tidak dapat diverifikasi.",
        {
          upstream: upstreamMessage
        }
      )
    }
  } else {
    console.info("Skipping Roboflow API key validation via ROBOFLOW_SKIP_KEY_VALIDATION")
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
  const cleanedBase64 = normalizedImage.replace(/\s+/g, "")
  if (cleanedBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    return jsonError(413, "PAYLOAD_TOO_LARGE", "Ukuran gambar terlalu besar untuk diproses.", {
      maxBase64Length: MAX_IMAGE_BASE64_LENGTH
    })
  }

  // Validate base64 payload early to provide clearer error messages
  try {
    const buf = Buffer.from(cleanedBase64, "base64")
    // round-trip check (ignore padding differences)
    const reencoded = buf.toString("base64").replace(/=+$/, "")
    const originalNoPad = cleanedBase64.replace(/=+$/, "")
    if (buf.length === 0 || reencoded !== originalNoPad) {
      throw new Error("invalid base64 payload")
    }
  } catch (err) {
    console.error("Invalid base64 image for Roboflow request", {
      length: cleanedBase64.length,
      head: cleanedBase64.slice(0, 50),
      tail: cleanedBase64.slice(-50)
    })

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

  // use multipart/form-data to avoid issues with url-encoding of base64
  // build FormData at time of request so it is only created when needed

  try {
    const form = new FormData()
    const mime = extractMimeFromDataUrl(imageInput) || "image/jpeg"
    const fileBuffer = Buffer.from(cleanedBase64, "base64")

    // Prefer appending as a binary file in part named 'file' (what Roboflow expects).
    // Try Blob first (Web FormData), fallback to Buffer append for Node runtimes.
    try {
      // @ts-ignore Blob may exist in the runtime
      const blob = new Blob([fileBuffer], { type: mime })
      // append with filename so upstream treats it as a file
      // @ts-ignore some FormData implementations accept third filename arg
      form.append("file", blob, "upload.jpg")
    } catch (err) {
      try {
        // @ts-ignore Node/undici FormData may accept Buffer + filename
        form.append("file", fileBuffer, "upload.jpg")
      } catch (err2) {
        // last resort: append base64 string under field 'file'
        form.append("file", cleanedBase64)
      }
    }

    const roboflowResponse = await fetch(roboflowUrl, {
      method: "POST",
      // intentionally omit Content-Type so the runtime sets multipart boundary
      body: form,
      cache: "no-store"
    })

    let responseText: string = await roboflowResponse.text()
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
          const fallbackUrl = `${roboflowUrl}&image=${encodeURIComponent(cleanedBase64)}`
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
            // lanjut ke pemrosesan sukses setelah if-block
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
