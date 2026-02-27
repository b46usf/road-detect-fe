export const ADMIN_DEFAULT_USERNAME = "admin"
export const ADMIN_DEFAULT_PASSWORD = "Adm1n@321"

export const ADMIN_SESSION_STORAGE_KEY = "road-detect:admin-session:v1"
export const DETECTION_HISTORY_STORAGE_KEY = "road-detect:detection-history:v1"
export const DETECTION_HISTORY_MAX_ITEMS = 120

export const GIS_MAP_SETTINGS_STORAGE_KEY = "road-detect:gismap-settings:v1"
export const GIS_INDONESIA_GEOJSON_STORAGE_KEY = "road-detect:gismap-indonesia:v1"
export const GIS_WFS_GEOJSON_STORAGE_KEY = "road-detect:gismap-wfs:v1"

export type StoredSeverityLevel = "ringan" | "sedang" | "berat" | "tidak-terdeteksi"
export type GisCrs = "EPSG:3857" | "EPSG:4326"

export interface AdminSession {
  username: string
  loggedInAt: string
}

export interface DetectionSpatialRecord {
  sourceCrs: "EPSG:4326"
  postgis: {
    srid: 4326
    wkt: string
    ewkt: string
    geojson: {
      type: "Point"
      coordinates: [number, number]
    }
  }
  feature: {
    type: "Feature"
    geometry: {
      type: "Point"
      coordinates: [number, number]
    }
    properties: {
      id: string
      waktuDeteksi: string
      createdAt: string
      tingkatKerusakan: StoredSeverityLevel
      luasanKerusakanPercent: number
      dominantClass: string | null
      modelId: string
      modelVersion: string
    }
  }
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
  spatial: DetectionSpatialRecord | null
}

export interface GisMapSettings {
  crs: GisCrs
  showDetectionPoints: boolean
  showIndonesiaBoundary: boolean
  indonesiaGeoJsonUrl: string
  wmsEnabled: boolean
  wmsUrl: string
  wmsLayers: string
  wmsFormat: string
  wmsTransparent: boolean
  wfsEnabled: boolean
  wfsUrl: string
}

export interface GeoJsonCacheEntry {
  sourceUrl: string
  fetchedAt: string
  data: unknown
}

const DEFAULT_GIS_MAP_SETTINGS: GisMapSettings = {
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

function readString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback
  }
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : fallback
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function normalizeSeverity(value: unknown): StoredSeverityLevel {
  if (value === "ringan" || value === "sedang" || value === "berat") {
    return value
  }

  return "tidak-terdeteksi"
}

function normalizeDetectionLocation(
  value: unknown
): StoredDetectionRecord["lokasi"] {
  if (!value || typeof value !== "object") {
    return null
  }

  const source = value as Record<string, unknown>
  const latitude = toFiniteNumber(source.latitude)
  const longitude = toFiniteNumber(source.longitude)
  if (latitude === null || longitude === null) {
    return null
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null
  }

  return {
    latitude,
    longitude,
    accuracy: toFiniteNumber(source.accuracy),
    timestamp: typeof source.timestamp === "string" ? source.timestamp : null,
    source: readString(source.source, "gps")
  }
}

function formatCoordinate(value: number): string {
  return value.toFixed(8)
}

export function createSpatialRecord(params: {
  id: string
  createdAt: string
  waktuDeteksi: string
  tingkatKerusakan: StoredSeverityLevel
  luasanKerusakanPercent: number
  dominantClass: string | null
  modelId: string
  modelVersion: string
  lokasi: StoredDetectionRecord["lokasi"]
}): DetectionSpatialRecord | null {
  const { lokasi } = params
  if (!lokasi) {
    return null
  }

  const latitude = toFiniteNumber(lokasi.latitude)
  const longitude = toFiniteNumber(lokasi.longitude)
  if (latitude === null || longitude === null) {
    return null
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null
  }

  const lonText = formatCoordinate(longitude)
  const latText = formatCoordinate(latitude)
  const wkt = `POINT(${lonText} ${latText})`

  return {
    sourceCrs: "EPSG:4326",
    postgis: {
      srid: 4326,
      wkt,
      ewkt: `SRID=4326;${wkt}`,
      geojson: {
        type: "Point",
        coordinates: [longitude, latitude]
      }
    },
    feature: {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [longitude, latitude]
      },
      properties: {
        id: params.id,
        waktuDeteksi: params.waktuDeteksi,
        createdAt: params.createdAt,
        tingkatKerusakan: params.tingkatKerusakan,
        luasanKerusakanPercent: params.luasanKerusakanPercent,
        dominantClass: params.dominantClass,
        modelId: params.modelId,
        modelVersion: params.modelVersion
      }
    }
  }
}

export function createStoredDetectionRecord(params: {
  report: any
  modelId: string
  modelVersion: string
  apiMessage: string
  apiDurationMs: number | null
}): StoredDetectionRecord {
  const { report, modelId, modelVersion, apiMessage, apiDurationMs } = params
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const createdAt = new Date().toISOString()
  const location = report?.lokasi
    ? {
        latitude: report.lokasi.latitude,
        longitude: report.lokasi.longitude,
        accuracy: report.lokasi.accuracy ?? null,
        timestamp: report.lokasi.timestamp ?? null,
        source: report.lokasi.source ?? "gps"
      }
    : null

  const luasan = Math.max(0, Number(report?.luasanKerusakan?.totalPersentase) || 0)
  const tingkat = (report?.tingkatKerusakan?.dominan as StoredSeverityLevel) || "tidak-terdeteksi"
  const totalDeteksi = Math.max(0, Number(report?.tingkatKerusakan?.jumlah?.totalDeteksi) || 0)
  const dominantClass = report?.breakdownKelas?.dominanKelas || null

  return {
    id,
    createdAt,
    modelId,
    modelVersion,
    apiMessage,
    apiDurationMs,
    luasanKerusakanPercent: luasan,
    tingkatKerusakan: normalizeSeverity(tingkat),
    totalDeteksi,
    dominantClass,
    classCounts: {
      pothole: Math.max(0, Number(report?.breakdownKelas?.counts?.pothole) || 0),
      crack: Math.max(0, Number(report?.breakdownKelas?.counts?.crack) || 0),
      rutting: Math.max(0, Number(report?.breakdownKelas?.counts?.rutting) || 0),
      lainnya: Math.max(0, Number(report?.breakdownKelas?.counts?.lainnya) || 0),
      totalDeteksi: Math.max(0, Number(report?.breakdownKelas?.counts?.totalDeteksi) || totalDeteksi)
    },
    classDistribution: {
      pothole: Math.max(0, Number(report?.breakdownKelas?.distribusiPersentase?.pothole) || 0),
      crack: Math.max(0, Number(report?.breakdownKelas?.distribusiPersentase?.crack) || 0),
      rutting: Math.max(0, Number(report?.breakdownKelas?.distribusiPersentase?.rutting) || 0),
      lainnya: Math.max(0, Number(report?.breakdownKelas?.distribusiPersentase?.lainnya) || 0)
    },
    lokasi: location,
    waktuDeteksi: report?.waktuDeteksi || createdAt,
    visualBukti: {
      mime: report?.visualBukti?.mime || "image/jpeg",
      quality: report?.visualBukti?.quality ?? null,
      captureWidth: report?.visualBukti?.resolusiCapture?.width ?? null,
      captureHeight: report?.visualBukti?.resolusiCapture?.height ?? null,
      sourceWidth: report?.visualBukti?.resolusiSource?.width ?? null,
      sourceHeight: report?.visualBukti?.resolusiSource?.height ?? null,
      isFhdSource: typeof report?.visualBukti?.isFhdSource === "boolean" ? report.visualBukti.isFhdSource : null
    },
    spatial: createSpatialRecord({
      id,
      createdAt,
      waktuDeteksi: report?.waktuDeteksi || createdAt,
      tingkatKerusakan: normalizeSeverity(tingkat),
      luasanKerusakanPercent: luasan,
      dominantClass,
      modelId,
      modelVersion,
      lokasi: location
    })
  }
}

function isSpatialRecord(value: unknown): value is DetectionSpatialRecord {
  if (!value || typeof value !== "object") {
    return false
  }

  const source = value as Record<string, unknown>
  if (source.sourceCrs !== "EPSG:4326") {
    return false
  }

  const postgis = source.postgis
  if (!postgis || typeof postgis !== "object") {
    return false
  }

  const postgisObject = postgis as Record<string, unknown>
  if (postgisObject.srid !== 4326) {
    return false
  }

  if (typeof postgisObject.ewkt !== "string" || postgisObject.ewkt.trim().length === 0) {
    return false
  }

  return true
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

function normalizeRecord(
  value: unknown,
  index: number
): StoredDetectionRecord | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const source = value as Record<string, unknown>

  const id = readString(source.id, `${Date.now()}-${index}`)
  const createdAt = readString(source.createdAt, new Date().toISOString())
  const modelId = readString(source.modelId, "unknown-model")
  const modelVersion = readString(source.modelVersion, "unknown")
  const apiMessage = readString(source.apiMessage, "Deteksi berhasil diproses.")
  const apiDurationMs = toFiniteNumber(source.apiDurationMs)
  const luasanKerusakanPercent = Math.max(0, toFiniteNumber(source.luasanKerusakanPercent) ?? 0)
  const tingkatKerusakan = normalizeSeverity(source.tingkatKerusakan)
  const totalDeteksi = Math.max(0, toFiniteNumber(source.totalDeteksi) ?? 0)
  const dominantClass = readString(source.dominantClass, "") || null
  const lokasi = normalizeDetectionLocation(source.lokasi)
  const waktuDeteksi = readString(source.waktuDeteksi, createdAt)

  const classCountsRaw =
    source.classCounts && typeof source.classCounts === "object"
      ? (source.classCounts as Record<string, unknown>)
      : {}

  const classDistributionRaw =
    source.classDistribution && typeof source.classDistribution === "object"
      ? (source.classDistribution as Record<string, unknown>)
      : {}

  const visualRaw =
    source.visualBukti && typeof source.visualBukti === "object"
      ? (source.visualBukti as Record<string, unknown>)
      : {}

  const spatialInput = source.spatial
  const fallbackSpatial = createSpatialRecord({
    id,
    createdAt,
    waktuDeteksi,
    tingkatKerusakan,
    luasanKerusakanPercent,
    dominantClass,
    modelId,
    modelVersion,
    lokasi
  })

  return {
    id,
    createdAt,
    modelId,
    modelVersion,
    apiMessage,
    apiDurationMs,
    luasanKerusakanPercent,
    tingkatKerusakan,
    totalDeteksi,
    dominantClass,
    classCounts: {
      pothole: Math.max(0, toFiniteNumber(classCountsRaw.pothole) ?? 0),
      crack: Math.max(0, toFiniteNumber(classCountsRaw.crack) ?? 0),
      rutting: Math.max(0, toFiniteNumber(classCountsRaw.rutting) ?? 0),
      lainnya: Math.max(0, toFiniteNumber(classCountsRaw.lainnya) ?? 0),
      totalDeteksi: Math.max(0, toFiniteNumber(classCountsRaw.totalDeteksi) ?? totalDeteksi)
    },
    classDistribution: {
      pothole: Math.max(0, toFiniteNumber(classDistributionRaw.pothole) ?? 0),
      crack: Math.max(0, toFiniteNumber(classDistributionRaw.crack) ?? 0),
      rutting: Math.max(0, toFiniteNumber(classDistributionRaw.rutting) ?? 0),
      lainnya: Math.max(0, toFiniteNumber(classDistributionRaw.lainnya) ?? 0)
    },
    lokasi,
    waktuDeteksi,
    visualBukti: {
      mime: readString(visualRaw.mime, "image/jpeg"),
      quality: toFiniteNumber(visualRaw.quality),
      captureWidth: toFiniteNumber(visualRaw.captureWidth),
      captureHeight: toFiniteNumber(visualRaw.captureHeight),
      sourceWidth: toFiniteNumber(visualRaw.sourceWidth),
      sourceHeight: toFiniteNumber(visualRaw.sourceHeight),
      isFhdSource: typeof visualRaw.isFhdSource === "boolean" ? visualRaw.isFhdSource : null
    },
    spatial: isSpatialRecord(spatialInput) ? spatialInput : fallbackSpatial
  }
}

export function readDetectionHistory(): StoredDetectionRecord[] {
  if (typeof window === "undefined") {
    return []
  }

  const raw = window.localStorage.getItem(DETECTION_HISTORY_STORAGE_KEY)
  const parsed = parseJson<unknown>(raw, [])
  if (!Array.isArray(parsed)) {
    return []
  }

  return parsed
    .map((item, index) => normalizeRecord(item, index))
    .filter((item): item is StoredDetectionRecord => item !== null)
    .slice(0, DETECTION_HISTORY_MAX_ITEMS)
}

export function appendDetectionHistory(
  record: StoredDetectionRecord
): { ok: true; total: number } | { ok: false; message: string } {
  if (typeof window === "undefined") {
    return { ok: false, message: "localStorage tidak tersedia di server." }
  }

  try {
    const normalizedRecord: StoredDetectionRecord = {
      ...record,
      spatial:
        record.spatial ??
        createSpatialRecord({
          id: record.id,
          createdAt: record.createdAt,
          waktuDeteksi: record.waktuDeteksi,
          tingkatKerusakan: record.tingkatKerusakan,
          luasanKerusakanPercent: record.luasanKerusakanPercent,
          dominantClass: record.dominantClass,
          modelId: record.modelId,
          modelVersion: record.modelVersion,
          lokasi: record.lokasi
        })
    }

    const current = readDetectionHistory()
    const next = [normalizedRecord, ...current].slice(0, DETECTION_HISTORY_MAX_ITEMS)
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

export function getDefaultGisMapSettings(): GisMapSettings {
  return {
    ...DEFAULT_GIS_MAP_SETTINGS
  }
}

export function readGisMapSettings(): GisMapSettings {
  if (typeof window === "undefined") {
    return getDefaultGisMapSettings()
  }

  const raw = window.localStorage.getItem(GIS_MAP_SETTINGS_STORAGE_KEY)
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
    indonesiaGeoJsonUrl: readString(source.indonesiaGeoJsonUrl, DEFAULT_GIS_MAP_SETTINGS.indonesiaGeoJsonUrl),
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
  if (typeof window === "undefined") {
    return { ok: false, message: "localStorage tidak tersedia di server." }
  }

  try {
    window.localStorage.setItem(GIS_MAP_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
    return { ok: true }
  } catch {
    return { ok: false, message: "Gagal menyimpan konfigurasi GIS ke localStorage." }
  }
}

function readGeoJsonCacheByKey(key: string): GeoJsonCacheEntry | null {
  if (typeof window === "undefined") {
    return null
  }

  const raw = window.localStorage.getItem(key)
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
  if (typeof window === "undefined") {
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
  return readGeoJsonCacheByKey(GIS_INDONESIA_GEOJSON_STORAGE_KEY)
}

export function writeIndonesiaGeoJsonCache(
  payload: GeoJsonCacheEntry
): { ok: true } | { ok: false; message: string } {
  return writeGeoJsonCacheByKey(GIS_INDONESIA_GEOJSON_STORAGE_KEY, payload)
}

export function readWfsGeoJsonCache(): GeoJsonCacheEntry | null {
  return readGeoJsonCacheByKey(GIS_WFS_GEOJSON_STORAGE_KEY)
}

export function writeWfsGeoJsonCache(
  payload: GeoJsonCacheEntry
): { ok: true } | { ok: false; message: string } {
  return writeGeoJsonCacheByKey(GIS_WFS_GEOJSON_STORAGE_KEY, payload)
}
