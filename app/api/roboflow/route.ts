import { NextResponse } from "next/server"
import {
  normalizePredictions,
  buildDamageSummary
} from "@/lib/roboflow-utils"
import {
  toFiniteNumber,
  readString,
  normalizeImageInput,
  extractMimeFromDataUrl,
  parseDetectedAt
} from "@/lib/common-utils"

/* ===============================
   CONFIG
================================ */
export const runtime = "nodejs"

const MAX_IMAGE_BASE64_LENGTH = 1_500_000
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 30
const RATE_LIMIT_MIN_INTERVAL_MS = 1_500

/* ===============================
   TYPES
================================ */
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

/* ===============================
   RATE LIMIT (IN-MEMORY)
================================ */
declare global {
  // eslint-disable-next-line no-var
  var __rfRateLimit: Map<string, RateLimitRecord> | undefined
}

const rateLimitStore =
  globalThis.__rfRateLimit ?? (globalThis.__rfRateLimit = new Map())

function rateLimitKey(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  const ua = readString(req.headers.get("user-agent")).slice(0, 80)
  return `${ip}:${ua}`
}

function applyRateLimit(req: Request) {
  const now = Date.now()
  const key = rateLimitKey(req)
  const record = rateLimitStore.get(key)

  if (!record) {
    rateLimitStore.set(key, {
      windowStart: now,
      count: 1,
      lastRequestAt: now
    })
    return null
  }

  if (now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    record.windowStart = now
    record.count = 0
  }

  if (now - record.lastRequestAt < RATE_LIMIT_MIN_INTERVAL_MS) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "RATE_LIMIT_THROTTLED",
          message: "Request terlalu cepat."
        }
      },
      { status: 429 }
    )
  }

  record.count++
  record.lastRequestAt = now

  if (record.count > RATE_LIMIT_MAX_REQUESTS) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Batas request per menit terlampaui."
        }
      },
      { status: 429 }
    )
  }

  return null
}

/* ===============================
   UTIL
================================ */
function splitModelId(raw: string): string[] {
  return raw
    .replace(/^https?:\/\/detect\.roboflow\.com\//i, "")
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean)
}

function buildRoboflowPath(modelId: string, version: string) {
  const parts = splitModelId(modelId)
  if (parts.at(-1) === version) parts.pop()
  if (!parts.length || !version) return null

  return `${parts.map(encodeURIComponent).join("/")}/${encodeURIComponent(version)}`
}

function jsonError(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: { code, message, details } },
    { status }
  )
}

/* ===============================
   HANDLER
================================ */
export async function POST(request: Request) {
  const startedAt = Date.now()

  /* ---------- ENV ---------- */
  const apiKey = process.env.ROBOFLOW_API_KEY
  if (!apiKey) {
    return jsonError(500, "ENV_MISSING", "ROBOFLOW_API_KEY belum diset.")
  }

  /* ---------- RATE LIMIT ---------- */
  const rl = applyRateLimit(request)
  if (rl) return rl

  /* ---------- PARSE BODY ---------- */
  let payload: InferRequestBody
  try {
    payload = await request.json()
  } catch {
    return jsonError(400, "INVALID_JSON", "Body harus JSON.")
  }

  const imageInput = readString(payload.image)
  const modelId = readString(payload.modelId)
  const modelVersion = readString(payload.modelVersion)

  if (!imageInput) {
    return jsonError(400, "IMAGE_REQUIRED", "Field image wajib diisi.")
  }
  if (!modelId || !modelVersion) {
    return jsonError(400, "MODEL_REQUIRED", "modelId dan modelVersion wajib diisi.")
  }

  /* ---------- NORMALIZE IMAGE ---------- */
  const base64Image = normalizeImageInput(imageInput)
  if (base64Image.length > MAX_IMAGE_BASE64_LENGTH) {
    return jsonError(413, "PAYLOAD_TOO_LARGE", "Ukuran gambar terlalu besar.")
  }

  /* ---------- BUILD URL ---------- */
  const path = buildRoboflowPath(modelId, modelVersion)
  if (!path) {
    return jsonError(400, "INVALID_MODEL_PATH", "Format modelId / modelVersion salah.")
  }

  const qs = new URLSearchParams({ api_key: apiKey })
  if (payload.confidence != null) qs.set("confidence", String(payload.confidence))
  if (payload.overlap != null) qs.set("overlap", String(payload.overlap))

  const roboflowUrl = `https://detect.roboflow.com/${path}?${qs.toString()}`

  /* ---------- AUDIT LOG (AMAN) ---------- */
  console.log("[RF] modelId:", modelId)
  console.log("[RF] modelVersion:", modelVersion)
  console.log("[RF] url:", roboflowUrl.replace(apiKey, "***"))

  /* ---------- CALL ROBOFLOW ---------- */
  let rfText = ""
  try {
    const rfRes = await fetch(roboflowUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: base64Image, // ⬅️ KUNCI UTAMA
      cache: "no-store"
    })

    rfText = await rfRes.text()

    if (!rfRes.ok) {
      return jsonError(
        rfRes.status,
        "UPSTREAM_HTTP_ERROR",
        "Request ke Roboflow gagal.",
        { status: rfRes.status, body: rfText }
      )
    }
  } catch {
    return jsonError(502, "UPSTREAM_NETWORK_ERROR", "Tidak bisa terhubung ke Roboflow.")
  }

  /* ---------- PARSE RESPONSE ---------- */
  let rfData: any
  try {
    rfData = JSON.parse(rfText)
  } catch {
    rfData = {}
  }

  const frameWidth = toFiniteNumber(rfData?.image?.width)
  const frameHeight = toFiniteNumber(rfData?.image?.height)

  const predictions = normalizePredictions(rfData?.predictions)
  const damage = buildDamageSummary(predictions, frameWidth, frameHeight)

  /* ---------- RESPONSE ---------- */
  return NextResponse.json({
    ok: true,
    message: "Deteksi berhasil diproses.",
    data: {
      ...rfData,
      report: {
        luasanKerusakan: damage,
        waktuDeteksi: parseDetectedAt(payload.detectedAt),
        visualBukti: {
          mime: extractMimeFromDataUrl(imageInput),
          imageDataUrl: imageInput.startsWith("data:") ? imageInput : null
        }
      }
    },
    meta: {
      modelId,
      modelVersion,
      durationMs: Date.now() - startedAt
    }
  })
}