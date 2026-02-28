import { readString } from "@/lib/common-utils"
import {
  DEFAULT_GIS_MAP_SETTINGS,
  GIS_MAP_SETTINGS_STORAGE_KEY,
  GIS_MAP_SETTINGS_STORAGE_KEY_LEGACY
} from "./constants"
import { canUseLocalStorage, parseJson, readStorageItemWithLegacy } from "./local-storage"
import type { GisMapSettings } from "./types"

export function getDefaultGisMapSettings(): GisMapSettings {
  return {
    ...DEFAULT_GIS_MAP_SETTINGS
  }
}

export function readGisMapSettings(): GisMapSettings {
  if (!canUseLocalStorage()) {
    return getDefaultGisMapSettings()
  }

  const raw = readStorageItemWithLegacy(GIS_MAP_SETTINGS_STORAGE_KEY, [GIS_MAP_SETTINGS_STORAGE_KEY_LEGACY])
  const parsed = parseJson<unknown>(raw, {})
  const source = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}

  return {
    crs: source.crs === "EPSG:4326" ? "EPSG:4326" : "EPSG:3857",
    showDetectionPoints:
      typeof source.showDetectionPoints === "boolean"
        ? source.showDetectionPoints
        : DEFAULT_GIS_MAP_SETTINGS.showDetectionPoints,
    showIndonesiaBoundary:
      typeof source.showIndonesiaBoundary === "boolean"
        ? source.showIndonesiaBoundary
        : DEFAULT_GIS_MAP_SETTINGS.showIndonesiaBoundary,
    indonesiaGeoJsonUrl: readString(
      source.indonesiaGeoJsonUrl,
      DEFAULT_GIS_MAP_SETTINGS.indonesiaGeoJsonUrl
    ),
    wmsEnabled:
      typeof source.wmsEnabled === "boolean"
        ? source.wmsEnabled
        : DEFAULT_GIS_MAP_SETTINGS.wmsEnabled,
    wmsUrl: readString(source.wmsUrl, DEFAULT_GIS_MAP_SETTINGS.wmsUrl),
    wmsLayers: readString(source.wmsLayers, DEFAULT_GIS_MAP_SETTINGS.wmsLayers),
    wmsFormat: readString(source.wmsFormat, DEFAULT_GIS_MAP_SETTINGS.wmsFormat),
    wmsTransparent:
      typeof source.wmsTransparent === "boolean"
        ? source.wmsTransparent
        : DEFAULT_GIS_MAP_SETTINGS.wmsTransparent,
    wfsEnabled:
      typeof source.wfsEnabled === "boolean"
        ? source.wfsEnabled
        : DEFAULT_GIS_MAP_SETTINGS.wfsEnabled,
    wfsUrl: readString(source.wfsUrl, DEFAULT_GIS_MAP_SETTINGS.wfsUrl)
  }
}

export function writeGisMapSettings(
  settings: GisMapSettings
): { ok: true } | { ok: false; message: string } {
  if (!canUseLocalStorage()) {
    return { ok: false, message: "localStorage tidak tersedia di server." }
  }

  try {
    window.localStorage.setItem(GIS_MAP_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
    return { ok: true }
  } catch {
    return { ok: false, message: "Gagal menyimpan konfigurasi GIS ke localStorage." }
  }
}
