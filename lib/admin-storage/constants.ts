import type { GisMapSettings } from "./types"

export const ADMIN_DEFAULT_USERNAME = "admin"
export const ADMIN_DEFAULT_PASSWORD = "Adm1n@321"

export const ADMIN_SESSION_STORAGE_KEY = "road-detect:admin-session:v1"
export const DETECTION_HISTORY_STORAGE_KEY = "road-detect:detection-history:v1"
export const DETECTION_HISTORY_MAX_ITEMS = 120

export const GIS_MAP_SETTINGS_STORAGE_KEY = "road-detect:gismap-settings:v1"
export const GIS_INDONESIA_GEOJSON_STORAGE_KEY = "road-detect:gismap-indonesia:v1"
export const GIS_WFS_GEOJSON_STORAGE_KEY = "road-detect:gismap-wfs:v1"

export const ROBOFLOW_ADMIN_STATS_STORAGE_KEY = "road-detect:roboflow-admin-stats:v1"
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
