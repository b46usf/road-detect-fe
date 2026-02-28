import { readString, toFiniteNumber } from "@/lib/common-utils"
import type {
  DetectionSpatialRecord,
  StoredDetectionRecord,
  StoredSeverityLevel
} from "./types"

function formatCoordinate(value: number): string {
  return value.toFixed(8)
}

export function normalizeSeverity(value: unknown): StoredSeverityLevel {
  if (value === "ringan" || value === "sedang" || value === "berat") {
    return value
  }

  return "tidak-terdeteksi"
}

export function normalizeDetectionLocation(value: unknown): StoredDetectionRecord["lokasi"] {
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

export function isSpatialRecord(value: unknown): value is DetectionSpatialRecord {
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
