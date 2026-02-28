import {
  getRoboflowApiKeyValidationCache,
  getRoboflowInvalidStats,
  incrementRoboflowInvalidCount,
  persistRoboflowAdminState,
  setRoboflowApiKeyValidationCache
} from "@/lib/server/roboflow-admin-state"

const API_KEY_VALIDATION_TTL_MS = Number(process.env.ROBOFLOW_API_KEY_VALIDATION_TTL_MS) || 60_000

async function persistValidationStateBestEffort(): Promise<void> {
  try {
    await persistRoboflowAdminState({
      stats: getRoboflowInvalidStats(),
      cache: getRoboflowApiKeyValidationCache() ?? null
    })
  } catch {
    // intentionally ignore persistence failures
  }
}

export async function validateRoboflowApiKey(apiKey: string): Promise<{ ok: boolean; info?: unknown }> {
  const now = Date.now()
  const cache = getRoboflowApiKeyValidationCache()

  if (cache && cache.key === apiKey && cache.expiresAt > now) {
    return { ok: cache.ok, info: cache.info }
  }

  try {
    const url = `https://api.roboflow.com/?api_key=${encodeURIComponent(apiKey)}`
    const response = await fetch(url, { method: "GET", cache: "no-store" })
    const text = await response.text()

    let body: unknown = { raw: text }
    try {
      body = JSON.parse(text)
    } catch {
      body = { raw: text }
    }

    const info = { status: response.status, body }
    setRoboflowApiKeyValidationCache({
      key: apiKey,
      ok: response.ok,
      expiresAt: now + API_KEY_VALIDATION_TTL_MS,
      info
    })

    if (!response.ok) {
      incrementRoboflowInvalidCount(now)
      console.warn("Roboflow API key validation failed", info)
      await persistValidationStateBestEffort()
    }

    return { ok: response.ok, info }
  } catch (error) {
    const info = { error: error instanceof Error ? error.message : String(error) }

    setRoboflowApiKeyValidationCache({
      key: apiKey,
      ok: false,
      expiresAt: now + API_KEY_VALIDATION_TTL_MS,
      info
    })

    incrementRoboflowInvalidCount(now)
    console.warn("Roboflow API key validation error", info)
    await persistValidationStateBestEffort()

    return { ok: false, info }
  }
}
