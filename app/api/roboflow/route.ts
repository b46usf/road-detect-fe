import { NextResponse } from "next/server"

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

type SeverityLevel = "ringan" | "sedang" | "berat"
type DominantSeverity = SeverityLevel | "tidak-terdeteksi"

interface ParsedPrediction {
  label: string
  width: number
  height: number
}

interface ClassSummaryAccumulator {
  label: string
  count: number
  totalAreaPercent: number
  severityArea: {
    ringan: number
    sedang: number
    berat: number
  }
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

const LIGHT_SEVERITY_MAX_PERCENT = 1.5
const MEDIUM_SEVERITY_MAX_PERCENT = 4

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

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function normalizeImageInput(rawImage: string): string {
  const input = rawImage.trim()
  if (!input.startsWith("data:")) {
    return input
  }

  const base64SeparatorIndex = input.indexOf(",")
  if (base64SeparatorIndex === -1) {
    return input
  }

  return input.slice(base64SeparatorIndex + 1)
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
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

function parseDetectedAt(value: unknown): string {
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString()
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString()
  }

  return new Date().toISOString()
}

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

function extractMimeFromDataUrl(rawImageInput: string): string | null {
  const input = rawImageInput.trim()
  if (!input.startsWith("data:")) {
    return null
  }

  const end = input.indexOf(";")
  if (end === -1) {
    return null
  }

  const mime = input.slice(5, end).trim()
  return mime.length > 0 ? mime : null
}

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

function normalizePredictions(rawPredictions: unknown): ParsedPrediction[] {
  if (!Array.isArray(rawPredictions)) {
    return []
  }

  const results: ParsedPrediction[] = []

  for (const item of rawPredictions) {
    if (!item || typeof item !== "object") {
      continue
    }

    const source = item as Record<string, unknown>
    const rawLabel = readString(source.class)
    const label = rawLabel.length > 0 ? rawLabel : "objek"
    const width = toFiniteNumber(source.width)
    const height = toFiniteNumber(source.height)

    if (width === null || height === null || width <= 0 || height <= 0) {
      continue
    }

    results.push({
      label,
      width,
      height
    })
  }

  return results
}

function classifySeverity(areaPercent: number): SeverityLevel {
  if (areaPercent < LIGHT_SEVERITY_MAX_PERCENT) {
    return "ringan"
  }

  if (areaPercent < MEDIUM_SEVERITY_MAX_PERCENT) {
    return "sedang"
  }

  return "berat"
}

function classifyClassBucket(label: string): "pothole" | "crack" | "rutting" | "lainnya" {
  const normalized = label.toLowerCase()

  if (normalized.includes("pothole")) {
    return "pothole"
  }

  if (normalized.includes("crack")) {
    return "crack"
  }

  if (normalized.includes("rutting")) {
    return "rutting"
  }

  return "lainnya"
}

function dominantSeverityFromArea(severityArea: {
  ringan: number
  sedang: number
  berat: number
}): DominantSeverity {
  const total = severityArea.ringan + severityArea.sedang + severityArea.berat
  if (total <= 0) {
    return "tidak-terdeteksi"
  }

  if (severityArea.berat >= severityArea.sedang && severityArea.berat >= severityArea.ringan) {
    return "berat"
  }

  if (severityArea.sedang >= severityArea.ringan) {
    return "sedang"
  }

  return "ringan"
}

function buildDamageSummary(
  predictions: ParsedPrediction[],
  frameWidth: number | null,
  frameHeight: number | null
): {
  totalDamagePercent: number
  totalBoxAreaPx: number
  frameAreaPx: number
  counts: { ringan: number; sedang: number; berat: number }
  distributionPercent: { ringan: number; sedang: number; berat: number }
  dominantSeverity: DominantSeverity
  breakdownKelas: {
    counts: {
      pothole: number
      crack: number
      rutting: number
      lainnya: number
      totalDeteksi: number
    }
    distribusiPersentase: {
      pothole: number
      crack: number
      rutting: number
      lainnya: number
    }
    dominanKelas: string | null
    daftar: Array<{
      label: string
      jumlah: number
      persentaseJumlah: number
      totalPersentaseArea: number
      dominanSeverity: DominantSeverity
    }>
  }
} {
  const frameAreaPx =
    frameWidth !== null && frameHeight !== null && frameWidth > 0 && frameHeight > 0
      ? frameWidth * frameHeight
      : 0

  const counts = { ringan: 0, sedang: 0, berat: 0 }
  const areaBySeverity = { ringan: 0, sedang: 0, berat: 0 }
  const classMap = new Map<string, ClassSummaryAccumulator>()
  const classBucketCounts = { pothole: 0, crack: 0, rutting: 0, lainnya: 0 }

  let totalBoxAreaPx = 0
  for (const prediction of predictions) {
    const areaPx = prediction.width * prediction.height
    totalBoxAreaPx += areaPx

    const areaPercent = frameAreaPx > 0 ? (areaPx * 100) / frameAreaPx : 0
    const severity = classifySeverity(areaPercent)
    counts[severity] += 1
    areaBySeverity[severity] += areaPercent

    const normalizedLabel = prediction.label.trim().toLowerCase() || "objek"
    const existing = classMap.get(normalizedLabel)
    if (existing) {
      existing.count += 1
      existing.totalAreaPercent += areaPercent
      existing.severityArea[severity] += areaPercent
    } else {
      classMap.set(normalizedLabel, {
        label: normalizedLabel,
        count: 1,
        totalAreaPercent: areaPercent,
        severityArea: {
          ringan: severity === "ringan" ? areaPercent : 0,
          sedang: severity === "sedang" ? areaPercent : 0,
          berat: severity === "berat" ? areaPercent : 0
        }
      })
    }

    const bucket = classifyClassBucket(normalizedLabel)
    classBucketCounts[bucket] += 1
  }

  const totalDamagePercent = frameAreaPx > 0 ? Math.min(100, (totalBoxAreaPx * 100) / frameAreaPx) : 0
  const distributionBase = Math.max(0.0001, areaBySeverity.ringan + areaBySeverity.sedang + areaBySeverity.berat)
  const distributionPercent = {
    ringan: (areaBySeverity.ringan * 100) / distributionBase,
    sedang: (areaBySeverity.sedang * 100) / distributionBase,
    berat: (areaBySeverity.berat * 100) / distributionBase
  }

  const totalDetections = counts.ringan + counts.sedang + counts.berat
  const dominantSeverity: DominantSeverity =
    totalDetections === 0
      ? "tidak-terdeteksi"
      : areaBySeverity.berat >= areaBySeverity.sedang && areaBySeverity.berat >= areaBySeverity.ringan
        ? "berat"
        : areaBySeverity.sedang >= areaBySeverity.ringan
          ? "sedang"
          : "ringan"

  const daftar = Array.from(classMap.values())
    .map((item) => ({
      label: item.label,
      jumlah: item.count,
      persentaseJumlah: totalDetections > 0 ? (item.count * 100) / totalDetections : 0,
      totalPersentaseArea: item.totalAreaPercent,
      dominanSeverity: dominantSeverityFromArea(item.severityArea)
    }))
    .sort((a, b) => b.jumlah - a.jumlah)

  const distribusiPersentase = {
    pothole: totalDetections > 0 ? (classBucketCounts.pothole * 100) / totalDetections : 0,
    crack: totalDetections > 0 ? (classBucketCounts.crack * 100) / totalDetections : 0,
    rutting: totalDetections > 0 ? (classBucketCounts.rutting * 100) / totalDetections : 0,
    lainnya: totalDetections > 0 ? (classBucketCounts.lainnya * 100) / totalDetections : 0
  }

  const dominanKelas = daftar.length > 0 ? daftar[0].label : null

  return {
    totalDamagePercent,
    totalBoxAreaPx,
    frameAreaPx,
    counts,
    distributionPercent,
    dominantSeverity,
    breakdownKelas: {
      counts: {
        ...classBucketCounts,
        totalDeteksi: totalDetections
      },
      distribusiPersentase,
      dominanKelas,
      daftar
    }
  }
}

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

  const roboflowUrl =
    `https://detect.roboflow.com/${encodeURIComponent(modelId)}/${encodeURIComponent(modelVersion)}` +
    `?${query.toString()}`

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
      return jsonError(roboflowResponse.status, "UPSTREAM_HTTP_ERROR", "Request ke Roboflow gagal.", {
        upstreamStatus: roboflowResponse.status,
        upstreamBody: responseData
      })
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
        modelId,
        modelVersion,
        durationMs: Date.now() - startedAt
      }
    )
  } catch {
    return jsonError(502, "UPSTREAM_NETWORK_ERROR", "Tidak dapat terhubung ke layanan Roboflow.")
  }
}
