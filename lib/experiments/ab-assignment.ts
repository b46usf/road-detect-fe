export type AbVariant = "A" | "B"

function normalizeRatio(input: number): number {
  if (!Number.isFinite(input)) {
    return 0.5
  }

  return Math.min(1, Math.max(0, input))
}

function hashSeed(seed: string): number {
  let hash = 2166136261

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

export function assignAbVariant(seed: string, ratioA = 0.5): AbVariant {
  const ratio = normalizeRatio(ratioA)
  const normalizedSeed = seed.trim().toLowerCase()

  if (normalizedSeed.length === 0) {
    return "A"
  }

  const hash = hashSeed(normalizedSeed)
  const bucket = hash / 0xffffffff
  return bucket < ratio ? "A" : "B"
}
