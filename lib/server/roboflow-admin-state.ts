import { promises as fs } from "fs"
import path from "path"
import { toFiniteNumber, readString } from "@/lib/common-utils"

export interface RoboflowApiKeyValidationCache {
  key: string
  ok: boolean
  expiresAt: number
  info?: unknown
}

export interface RoboflowApiKeyValidationStats {
  invalidCount: number
  lastInvalidAt?: number
}

export interface RoboflowAdminStateSnapshot {
  stats: RoboflowApiKeyValidationStats | null
  cache: RoboflowApiKeyValidationCache | null
  updatedAt: number
}

declare global {
  var __roboflowApiKeyValidation: RoboflowApiKeyValidationCache | undefined
  var __roboflowApiKeyValidationStats: RoboflowApiKeyValidationStats | undefined
}

function getStatsFilePath(): string {
  return path.join(process.cwd(), ".data", "roboflow-admin-stats.json")
}

function normalizeStats(value: unknown): RoboflowApiKeyValidationStats | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const source = value as Record<string, unknown>
  const invalidCount = Math.max(0, toFiniteNumber(source.invalidCount) ?? 0)
  const lastInvalidAt = toFiniteNumber(source.lastInvalidAt) ?? undefined

  return {
    invalidCount,
    ...(lastInvalidAt ? { lastInvalidAt } : {})
  }
}

function normalizeCache(value: unknown): RoboflowApiKeyValidationCache | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const source = value as Record<string, unknown>
  const key = readString(source.key)
  const expiresAt = toFiniteNumber(source.expiresAt)
  const ok = source.ok

  if (!key || expiresAt === null || typeof ok !== "boolean") {
    return null
  }

  return {
    key,
    ok,
    expiresAt,
    info: source.info
  }
}

export function getInMemoryRoboflowAdminState(): RoboflowAdminStateSnapshot {
  return {
    stats: globalThis.__roboflowApiKeyValidationStats ?? { invalidCount: 0 },
    cache: globalThis.__roboflowApiKeyValidation ?? null,
    updatedAt: Date.now()
  }
}

export function setInMemoryRoboflowAdminState(payload: {
  stats?: unknown
  cache?: unknown
}): RoboflowAdminStateSnapshot {
  const normalizedStats = normalizeStats(payload.stats)
  const normalizedCache = normalizeCache(payload.cache)

  if (normalizedStats) {
    globalThis.__roboflowApiKeyValidationStats = normalizedStats
  }

  if (normalizedCache) {
    globalThis.__roboflowApiKeyValidation = normalizedCache
  }

  return {
    stats: globalThis.__roboflowApiKeyValidationStats ?? { invalidCount: 0 },
    cache: globalThis.__roboflowApiKeyValidation ?? null,
    updatedAt: Date.now()
  }
}

export function setRoboflowApiKeyValidationCache(payload: RoboflowApiKeyValidationCache): void {
  globalThis.__roboflowApiKeyValidation = payload
}

export function getRoboflowApiKeyValidationCache(): RoboflowApiKeyValidationCache | undefined {
  return globalThis.__roboflowApiKeyValidation
}

export function incrementRoboflowInvalidCount(at = Date.now()): RoboflowApiKeyValidationStats {
  const current = globalThis.__roboflowApiKeyValidationStats ?? { invalidCount: 0 }
  current.invalidCount += 1
  current.lastInvalidAt = at
  globalThis.__roboflowApiKeyValidationStats = current
  return current
}

export function getRoboflowInvalidStats(): RoboflowApiKeyValidationStats {
  return globalThis.__roboflowApiKeyValidationStats ?? { invalidCount: 0 }
}

export async function readPersistedRoboflowAdminState(): Promise<RoboflowAdminStateSnapshot | null> {
  try {
    const raw = await fs.readFile(getStatsFilePath(), "utf8")
    const parsed: unknown = JSON.parse(raw)

    if (!parsed || typeof parsed !== "object") {
      return null
    }

    const source = parsed as Record<string, unknown>
    const stats = normalizeStats(source.stats)
    const cache = normalizeCache(source.cache)
    const updatedAt = toFiniteNumber(source.updatedAt) ?? Date.now()

    return {
      stats: stats ?? { invalidCount: 0 },
      cache,
      updatedAt
    }
  } catch {
    return null
  }
}

export async function persistRoboflowAdminState(snapshot?: {
  stats?: unknown
  cache?: unknown
}): Promise<RoboflowAdminStateSnapshot> {
  const inMemory = setInMemoryRoboflowAdminState(snapshot ?? {})
  const payload: RoboflowAdminStateSnapshot = {
    stats: inMemory.stats,
    cache: inMemory.cache,
    updatedAt: Date.now()
  }

  await fs.mkdir(path.dirname(getStatsFilePath()), { recursive: true })
  await fs.writeFile(getStatsFilePath(), JSON.stringify(payload, null, 2), "utf8")

  return payload
}
