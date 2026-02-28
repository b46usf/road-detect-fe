import { readString } from "@/lib/common-utils"

interface RateLimitRecord {
  windowStart: number
  count: number
  lastRequestAt: number
}

type RateLimitStore = Map<string, RateLimitRecord>

declare global {
  var __roboflowRateLimitStore: RateLimitStore | undefined
}

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 30
const RATE_LIMIT_MIN_INTERVAL_MS = 1_500
const RATE_LIMIT_MAX_RECORDS = 1_000

const rateLimitStore =
  globalThis.__roboflowRateLimitStore ?? (globalThis.__roboflowRateLimitStore = new Map())

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

export function applyRoboflowRateLimit(
  request: Request
):
  | { ok: true }
  | { ok: false; status: 429; code: string; message: string; details: { retryAfterMs: number } } {
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
      status: 429,
      code: "RATE_LIMIT_THROTTLED",
      message: `Request terlalu cepat. Minimal interval ${RATE_LIMIT_MIN_INTERVAL_MS}ms.`,
      details: {
        retryAfterMs: RATE_LIMIT_MIN_INTERVAL_MS - deltaFromLastRequest
      }
    }
  }

  record.count += 1
  record.lastRequestAt = now

  if (record.count > RATE_LIMIT_MAX_REQUESTS) {
    return {
      ok: false,
      status: 429,
      code: "RATE_LIMIT_EXCEEDED",
      message: `Batas request per menit terlampaui (${RATE_LIMIT_MAX_REQUESTS}/menit).`,
      details: {
        retryAfterMs: Math.max(0, RATE_LIMIT_WINDOW_MS - (now - record.windowStart))
      }
    }
  }

  cleanRateLimitStore(now)
  return { ok: true }
}
