import { beforeEach, describe, expect, it } from "vitest"
import {
  ADMIN_SESSION_STORAGE_KEY,
  ADMIN_SESSION_STORAGE_KEY_LEGACY,
  DETECTION_HISTORY_STORAGE_KEY,
  DETECTION_HISTORY_STORAGE_KEY_LEGACY,
  GIS_MAP_SETTINGS_STORAGE_KEY,
  GIS_MAP_SETTINGS_STORAGE_KEY_LEGACY,
  ROBOFLOW_ADMIN_STATS_STORAGE_KEY,
  ROBOFLOW_ADMIN_STATS_STORAGE_KEY_LEGACY
} from "@/lib/admin-storage/constants"
import {
  readAdminSession,
  readDetectionHistory,
  readGisMapSettings,
  readRoboflowAdminStats
} from "@/lib/admin-storage"

describe("legacy localStorage migration", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("migrates admin session key from legacy prefix", () => {
    const payload = JSON.stringify({
      username: "admin",
      loggedInAt: "2026-03-01T00:00:00.000Z"
    })
    window.localStorage.setItem(ADMIN_SESSION_STORAGE_KEY_LEGACY, payload)

    const result = readAdminSession()

    expect(result).not.toBeNull()
    expect(result?.username).toBe("admin")
    expect(window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY)).toBe(payload)
    expect(window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY_LEGACY)).toBeNull()
  })

  it("migrates detection history key from legacy prefix", () => {
    const payload = JSON.stringify([
      {
        id: "r-1",
        createdAt: "2026-03-01T00:00:00.000Z",
        modelId: "model-a",
        modelVersion: "1",
        apiMessage: "ok",
        luasanKerusakanPercent: 12.5,
        tingkatKerusakan: "ringan",
        totalDeteksi: 1,
        waktuDeteksi: "2026-03-01T00:00:00.000Z"
      }
    ])
    window.localStorage.setItem(DETECTION_HISTORY_STORAGE_KEY_LEGACY, payload)

    const result = readDetectionHistory()

    expect(result.length).toBe(1)
    expect(window.localStorage.getItem(DETECTION_HISTORY_STORAGE_KEY)).toBe(payload)
    expect(window.localStorage.getItem(DETECTION_HISTORY_STORAGE_KEY_LEGACY)).toBeNull()
  })

  it("migrates GIS settings key from legacy prefix", () => {
    const payload = JSON.stringify({
      crs: "EPSG:4326",
      showDetectionPoints: false,
      showIndonesiaBoundary: false
    })
    window.localStorage.setItem(GIS_MAP_SETTINGS_STORAGE_KEY_LEGACY, payload)

    const result = readGisMapSettings()

    expect(result.crs).toBe("EPSG:4326")
    expect(result.showDetectionPoints).toBe(false)
    expect(result.showIndonesiaBoundary).toBe(false)
    expect(window.localStorage.getItem(GIS_MAP_SETTINGS_STORAGE_KEY)).toBe(payload)
    expect(window.localStorage.getItem(GIS_MAP_SETTINGS_STORAGE_KEY_LEGACY)).toBeNull()
  })

  it("migrates roboflow admin stats key from legacy prefix", () => {
    const payload = JSON.stringify({
      stats: {
        invalidCount: 3,
        lastInvalidAt: 1760000000000
      },
      cache: null,
      updatedAt: "2026-03-01T00:00:00.000Z"
    })
    window.localStorage.setItem(ROBOFLOW_ADMIN_STATS_STORAGE_KEY_LEGACY, payload)

    const result = readRoboflowAdminStats()

    expect(result?.stats?.invalidCount).toBe(3)
    expect(window.localStorage.getItem(ROBOFLOW_ADMIN_STATS_STORAGE_KEY)).toBe(payload)
    expect(window.localStorage.getItem(ROBOFLOW_ADMIN_STATS_STORAGE_KEY_LEGACY)).toBeNull()
  })
})
