import type { GisMapSettings } from "./types"

export const ADMIN_DEFAULT_USERNAME = "admin"
export const ADMIN_DEFAULT_PASSWORD = "Adm1n@321"

const STORAGE_KEY_PREFIX = "roadster"
const LEGACY_STORAGE_KEY_PREFIX = "road-detect"
const STORAGE_KEY_VERSION = "v1"

function makeStorageKey(prefix: string, suffix: string): string {
  return `${prefix}:${suffix}:${STORAGE_KEY_VERSION}`
}

export const ADMIN_SESSION_STORAGE_KEY = makeStorageKey(STORAGE_KEY_PREFIX, "admin-session")
export const ADMIN_SESSION_STORAGE_KEY_LEGACY = makeStorageKey(
  LEGACY_STORAGE_KEY_PREFIX,
  "admin-session"
)
export const DETECTION_HISTORY_STORAGE_KEY = makeStorageKey(STORAGE_KEY_PREFIX, "detection-history")
export const DETECTION_HISTORY_STORAGE_KEY_LEGACY = makeStorageKey(
  LEGACY_STORAGE_KEY_PREFIX,
  "detection-history"
)
export const DETECTION_HISTORY_MAX_ITEMS = 120

export const GIS_MAP_SETTINGS_STORAGE_KEY = makeStorageKey(STORAGE_KEY_PREFIX, "gismap-settings")
export const GIS_MAP_SETTINGS_STORAGE_KEY_LEGACY = makeStorageKey(
  LEGACY_STORAGE_KEY_PREFIX,
  "gismap-settings"
)
export const GIS_INDONESIA_GEOJSON_STORAGE_KEY = makeStorageKey(
  STORAGE_KEY_PREFIX,
  "gismap-indonesia"
)
export const GIS_INDONESIA_GEOJSON_STORAGE_KEY_LEGACY = makeStorageKey(
  LEGACY_STORAGE_KEY_PREFIX,
  "gismap-indonesia"
)
export const GIS_WFS_GEOJSON_STORAGE_KEY = makeStorageKey(STORAGE_KEY_PREFIX, "gismap-wfs")
export const GIS_WFS_GEOJSON_STORAGE_KEY_LEGACY = makeStorageKey(
  LEGACY_STORAGE_KEY_PREFIX,
  "gismap-wfs"
)

export const ROBOFLOW_ADMIN_STATS_STORAGE_KEY = makeStorageKey(
  STORAGE_KEY_PREFIX,
  "roboflow-admin-stats"
)
export const ROBOFLOW_ADMIN_STATS_STORAGE_KEY_LEGACY = makeStorageKey(
  LEGACY_STORAGE_KEY_PREFIX,
  "roboflow-admin-stats"
)
export const ROBOFLOW_WRITE_DEBOUNCE_MS = 2000

export const DEFAULT_GIS_MAP_SETTINGS: GisMapSettings = {
  crs: "EPSG:3857",
  showDetectionPoints: true,
  showIndonesiaBoundary: true,
  indonesiaGeoJsonUrl: "/geo/indonesia-simplified.geojson",
  wmsEnabled: false,
  wmsUrl: "",
  wmsLayers: "",
  wmsFormat: "image/png",
  wmsTransparent: true,
  wfsEnabled: false,
  wfsUrl: ""
}
