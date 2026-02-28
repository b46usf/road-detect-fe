import {
  ROBOFLOW_ADMIN_STATS_STORAGE_KEY,
  ROBOFLOW_WRITE_DEBOUNCE_MS
} from "./constants"
import { canUseLocalStorage, parseJson } from "./local-storage"
import type { RoboflowAdminPersist } from "./types"

interface RoboflowStatsWindow extends Window {
  __roboflowAdminStatsPending?: RoboflowAdminPersist | null
  __roboflowAdminStatsTimer?: number
}

function getStatsWindow(): RoboflowStatsWindow | null {
  if (!canUseLocalStorage()) {
    return null
  }

  return window as RoboflowStatsWindow
}

export function readRoboflowAdminStats(): RoboflowAdminPersist | null {
  const statsWindow = getStatsWindow()
  if (!statsWindow) {
    return null
  }

  const raw = statsWindow.localStorage.getItem(ROBOFLOW_ADMIN_STATS_STORAGE_KEY)
  const parsed = parseJson<RoboflowAdminPersist | null>(raw, null)
  if (!parsed || typeof parsed !== "object") {
    return null
  }

  return parsed
}

function immediateWriteRoboflowAdminStats(
  payload: RoboflowAdminPersist | null
): { ok: true } | { ok: false; message: string } {
  const statsWindow = getStatsWindow()
  if (!statsWindow) {
    return { ok: false, message: "localStorage tidak tersedia di server." }
  }

  try {
    if (payload === null) {
      statsWindow.localStorage.removeItem(ROBOFLOW_ADMIN_STATS_STORAGE_KEY)
      return { ok: true }
    }

    statsWindow.localStorage.setItem(ROBOFLOW_ADMIN_STATS_STORAGE_KEY, JSON.stringify(payload))
    return { ok: true }
  } catch {
    return { ok: false, message: "Gagal menyimpan Roboflow admin stats ke localStorage." }
  }
}

function scheduleRoboflowWrite(
  payload: RoboflowAdminPersist | null
): { ok: true } | { ok: false; message: string } {
  const statsWindow = getStatsWindow()
  if (!statsWindow) {
    return { ok: false, message: "localStorage tidak tersedia di server." }
  }

  try {
    statsWindow.__roboflowAdminStatsPending = payload

    if (statsWindow.__roboflowAdminStatsTimer) {
      clearTimeout(statsWindow.__roboflowAdminStatsTimer)
    }

    statsWindow.__roboflowAdminStatsTimer = window.setTimeout(() => {
      try {
        const pending = statsWindow.__roboflowAdminStatsPending ?? null
        immediateWriteRoboflowAdminStats(pending)
      } finally {
        statsWindow.__roboflowAdminStatsPending = null
        statsWindow.__roboflowAdminStatsTimer = undefined
      }
    }, ROBOFLOW_WRITE_DEBOUNCE_MS)

    return { ok: true }
  } catch {
    return { ok: false, message: "Gagal menjadwalkan penulisan Roboflow stats ke localStorage." }
  }
}

export function writeRoboflowAdminStats(
  payload: RoboflowAdminPersist | null
): { ok: true } | { ok: false; message: string } {
  if (!canUseLocalStorage()) {
    return { ok: false, message: "localStorage tidak tersedia di server." }
  }

  return scheduleRoboflowWrite(payload)
}

export function updateRoboflowAdminStats(
  updater: (prev: RoboflowAdminPersist | null) => RoboflowAdminPersist | null
): { ok: true } | { ok: false; message: string } {
  if (!canUseLocalStorage()) {
    return { ok: false, message: "localStorage tidak tersedia di server." }
  }

  try {
    const prev = readRoboflowAdminStats()
    const next = updater(prev)
    return scheduleRoboflowWrite(next)
  } catch {
    return { ok: false, message: "Gagal mengupdate Roboflow admin stats." }
  }
}

export function flushRoboflowAdminStatsToStorage(): { ok: true } | { ok: false; message: string } {
  const statsWindow = getStatsWindow()
  if (!statsWindow) {
    return { ok: false, message: "localStorage tidak tersedia di server." }
  }

  try {
    const pending = statsWindow.__roboflowAdminStatsPending ?? null

    if (statsWindow.__roboflowAdminStatsTimer) {
      clearTimeout(statsWindow.__roboflowAdminStatsTimer)
      statsWindow.__roboflowAdminStatsTimer = undefined
    }

    statsWindow.__roboflowAdminStatsPending = null
    return immediateWriteRoboflowAdminStats(pending)
  } catch {
    return { ok: false, message: "Gagal flush Roboflow admin stats ke storage." }
  }
}
