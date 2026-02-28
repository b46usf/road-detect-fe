import {
  GIS_INDONESIA_GEOJSON_STORAGE_KEY,
  GIS_INDONESIA_GEOJSON_STORAGE_KEY_LEGACY,
  GIS_WFS_GEOJSON_STORAGE_KEY,
  GIS_WFS_GEOJSON_STORAGE_KEY_LEGACY
} from "./constants"
import { canUseLocalStorage, parseJson, readStorageItemWithLegacy } from "./local-storage"
import type { GeoJsonCacheEntry } from "./types"
import { readString } from "@/lib/common-utils"

function readGeoJsonCacheByKey(key: string, legacyKey: string): GeoJsonCacheEntry | null {
  if (!canUseLocalStorage()) {
    return null
  }

  const raw = readStorageItemWithLegacy(key, [legacyKey])
  const parsed = parseJson<unknown>(raw, null)
  if (!parsed || typeof parsed !== "object") {
    return null
  }

  const source = parsed as Record<string, unknown>
  const sourceUrl = readString(source.sourceUrl)
  const fetchedAt = readString(source.fetchedAt)
  if (!sourceUrl || !fetchedAt) {
    return null
  }

  return {
    sourceUrl,
    fetchedAt,
    data: source.data
  }
}

function writeGeoJsonCacheByKey(
  key: string,
  payload: GeoJsonCacheEntry
): { ok: true } | { ok: false; message: string } {
  if (!canUseLocalStorage()) {
    return { ok: false, message: "localStorage tidak tersedia di server." }
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(payload))
    return { ok: true }
  } catch {
    return { ok: false, message: "Gagal menyimpan cache GeoJSON." }
  }
}

export function readIndonesiaGeoJsonCache(): GeoJsonCacheEntry | null {
  return readGeoJsonCacheByKey(
    GIS_INDONESIA_GEOJSON_STORAGE_KEY,
    GIS_INDONESIA_GEOJSON_STORAGE_KEY_LEGACY
  )
}

export function writeIndonesiaGeoJsonCache(
  payload: GeoJsonCacheEntry
): { ok: true } | { ok: false; message: string } {
  return writeGeoJsonCacheByKey(GIS_INDONESIA_GEOJSON_STORAGE_KEY, payload)
}

export function readWfsGeoJsonCache(): GeoJsonCacheEntry | null {
  return readGeoJsonCacheByKey(GIS_WFS_GEOJSON_STORAGE_KEY, GIS_WFS_GEOJSON_STORAGE_KEY_LEGACY)
}

export function writeWfsGeoJsonCache(
  payload: GeoJsonCacheEntry
): { ok: true } | { ok: false; message: string } {
  return writeGeoJsonCacheByKey(GIS_WFS_GEOJSON_STORAGE_KEY, payload)
}
