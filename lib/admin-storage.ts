export type {
  AdminSession,
  DetectionSpatialRecord,
  GeoJsonCacheEntry,
  GisCrs,
  GisMapSettings,
  RoboflowAdminPersist,
  StoredDetectionRecord,
  StoredSeverityLevel
} from "./admin-storage/types"

export {
  ADMIN_DEFAULT_PASSWORD,
  ADMIN_DEFAULT_USERNAME,
  ADMIN_SESSION_STORAGE_KEY,
  DEFAULT_GIS_MAP_SETTINGS,
  DETECTION_HISTORY_MAX_ITEMS,
  DETECTION_HISTORY_STORAGE_KEY,
  GIS_INDONESIA_GEOJSON_STORAGE_KEY,
  GIS_MAP_SETTINGS_STORAGE_KEY,
  GIS_WFS_GEOJSON_STORAGE_KEY,
  ROBOFLOW_ADMIN_STATS_STORAGE_KEY,
  ROBOFLOW_WRITE_DEBOUNCE_MS
} from "./admin-storage/constants"

export { clearAdminSession, readAdminSession, validateAdminCredentials, writeAdminSession } from "./admin-storage/session"

export {
  appendDetectionHistory,
  clearDetectionHistory,
  createStoredDetectionRecord,
  readDetectionHistory
} from "./admin-storage/detection-history"

export { createSpatialRecord } from "./admin-storage/spatial"

export {
  getDefaultGisMapSettings,
  readGisMapSettings,
  writeGisMapSettings
} from "./admin-storage/gis-settings"

export {
  readIndonesiaGeoJsonCache,
  readWfsGeoJsonCache,
  writeIndonesiaGeoJsonCache,
  writeWfsGeoJsonCache
} from "./admin-storage/geojson-cache"

export {
  flushRoboflowAdminStatsToStorage,
  readRoboflowAdminStats,
  updateRoboflowAdminStats,
  writeRoboflowAdminStats
} from "./admin-storage/roboflow-admin-stats"
