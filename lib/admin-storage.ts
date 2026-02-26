export const ADMIN_DEFAULT_USERNAME = "admin"
export const ADMIN_DEFAULT_PASSWORD = "Adm1n@321"

export const ADMIN_SESSION_STORAGE_KEY = "road-detect:admin-session:v1"
export const DETECTION_HISTORY_STORAGE_KEY = "road-detect:detection-history:v1"
export const DETECTION_HISTORY_MAX_ITEMS = 120

export type StoredSeverityLevel = "ringan" | "sedang" | "berat" | "tidak-terdeteksi"

export interface AdminSession {
  username: string
  loggedInAt: string
}

export interface StoredDetectionRecord {
  id: string
  createdAt: string
  modelId: string
  modelVersion: string
  apiMessage: string
  apiDurationMs: number | null
  luasanKerusakanPercent: number
  tingkatKerusakan: StoredSeverityLevel
  totalDeteksi: number
  dominantClass: string | null
  classCounts: {
    pothole: number
    crack: number
    rutting: number
    lainnya: number
    totalDeteksi: number
  }
  classDistribution: {
    pothole: number
    crack: number
    rutting: number
    lainnya: number
  }
  lokasi: {
    latitude: number
    longitude: number
    accuracy: number | null
    timestamp: string | null
    source: string
  } | null
  waktuDeteksi: string
  visualBukti: {
    mime: string
    quality: number | null
    captureWidth: number | null
    captureHeight: number | null
    sourceWidth: number | null
    sourceHeight: number | null
    isFhdSource: boolean | null
  }
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function validateAdminCredentials(username: string, password: string): boolean {
  return username.trim().toLowerCase() === ADMIN_DEFAULT_USERNAME && password === ADMIN_DEFAULT_PASSWORD
}

export function readAdminSession(): AdminSession | null {
  if (typeof window === "undefined") {
    return null
  }

  const raw = window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY)
  const parsed = parseJson<AdminSession | null>(raw, null)

  if (!parsed || typeof parsed !== "object") {
    return null
  }

  if (typeof parsed.username !== "string" || parsed.username.trim().length === 0) {
    return null
  }

  if (typeof parsed.loggedInAt !== "string" || parsed.loggedInAt.trim().length === 0) {
    return null
  }

  return parsed
}

export function writeAdminSession(username: string): void {
  if (typeof window === "undefined") {
    return
  }

  const session: AdminSession = {
    username: username.trim().toLowerCase(),
    loggedInAt: new Date().toISOString()
  }

  window.localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(session))
}

export function clearAdminSession(): void {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY)
}

export function readDetectionHistory(): StoredDetectionRecord[] {
  if (typeof window === "undefined") {
    return []
  }

  const raw = window.localStorage.getItem(DETECTION_HISTORY_STORAGE_KEY)
  const parsed = parseJson<StoredDetectionRecord[]>(raw, [])
  return Array.isArray(parsed) ? parsed : []
}

export function appendDetectionHistory(
  record: StoredDetectionRecord
): { ok: true; total: number } | { ok: false; message: string } {
  if (typeof window === "undefined") {
    return { ok: false, message: "localStorage tidak tersedia di server." }
  }

  try {
    const current = readDetectionHistory()
    const next = [record, ...current].slice(0, DETECTION_HISTORY_MAX_ITEMS)
    window.localStorage.setItem(DETECTION_HISTORY_STORAGE_KEY, JSON.stringify(next))
    return { ok: true, total: next.length }
  } catch (error) {
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      return { ok: false, message: "Penyimpanan browser penuh. Hapus sebagian riwayat admin." }
    }

    return { ok: false, message: "Gagal menyimpan riwayat deteksi ke localStorage." }
  }
}

export function clearDetectionHistory(): void {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.removeItem(DETECTION_HISTORY_STORAGE_KEY)
}
