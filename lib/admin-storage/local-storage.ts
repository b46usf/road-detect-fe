export function canUseLocalStorage(): boolean {
  return typeof window !== "undefined"
}

export function readStorageItemWithLegacy(primaryKey: string, legacyKeys: readonly string[]): string | null {
  if (!canUseLocalStorage()) {
    return null
  }

  const primaryValue = window.localStorage.getItem(primaryKey)
  if (primaryValue !== null) {
    return primaryValue
  }

  for (const legacyKey of legacyKeys) {
    const legacyValue = window.localStorage.getItem(legacyKey)
    if (legacyValue === null) {
      continue
    }

    try {
      window.localStorage.setItem(primaryKey, legacyValue)
      window.localStorage.removeItem(legacyKey)
    } catch {
      // Ignore migration write errors and keep returning legacy value.
    }

    return legacyValue
  }

  return null
}

export function removeStorageKeys(keys: readonly string[]): void {
  if (!canUseLocalStorage()) {
    return
  }

  for (const key of keys) {
    window.localStorage.removeItem(key)
  }
}

export function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}
