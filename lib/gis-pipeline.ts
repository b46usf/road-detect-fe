import type { StoredDetectionRecord } from "@/lib/admin-storage"

export interface DetectionPointFeature {
  type: "Feature"
  geometry: {
    type: "Point"
    coordinates: [number, number]
  }
  properties: {
    id: string
    createdAt: string
    waktuDeteksi: string
    tingkatKerusakan: StoredDetectionRecord["tingkatKerusakan"]
    luasanKerusakanPercent: number
    dominantClass: string | null
    modelId: string
    modelVersion: string
    totalDeteksi: number
  }
}

export interface DetectionFeatureCollection {
  type: "FeatureCollection"
  features: DetectionPointFeature[]
}

function validLatLng(latitude: number, longitude: number): boolean {
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
}

function pickCoordinates(record: StoredDetectionRecord): [number, number] | null {
  const spatialCoordinates = record.spatial?.postgis.geojson.coordinates
  if (spatialCoordinates && spatialCoordinates.length === 2) {
    const [longitude, latitude] = spatialCoordinates
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && validLatLng(latitude, longitude)) {
      return [longitude, latitude]
    }
  }

  if (!record.lokasi) {
    return null
  }

  const latitude = record.lokasi.latitude
  const longitude = record.lokasi.longitude
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !validLatLng(latitude, longitude)) {
    return null
  }

  return [longitude, latitude]
}

export function buildDetectionFeatureCollection(records: StoredDetectionRecord[]): DetectionFeatureCollection {
  const features: DetectionPointFeature[] = []

  for (const record of records) {
    const coordinates = pickCoordinates(record)
    if (!coordinates) {
      continue
    }

    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates
      },
      properties: {
        id: record.id,
        createdAt: record.createdAt,
        waktuDeteksi: record.waktuDeteksi,
        tingkatKerusakan: record.tingkatKerusakan,
        luasanKerusakanPercent: record.luasanKerusakanPercent,
        dominantClass: record.dominantClass,
        modelId: record.modelId,
        modelVersion: record.modelVersion,
        totalDeteksi: record.totalDeteksi
      }
    })
  }

  return {
    type: "FeatureCollection",
    features
  }
}

export function isGeoJsonLike(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return false
  }

  const source = value as Record<string, unknown>
  const type = typeof source.type === "string" ? source.type : ""
  return (
    type === "FeatureCollection" ||
    type === "Feature" ||
    type === "Polygon" ||
    type === "MultiPolygon" ||
    type === "GeometryCollection"
  )
}

export function countGeoJsonFeatures(value: unknown): number {
  if (!isGeoJsonLike(value)) {
    return 0
  }

  const source = value as Record<string, unknown>
  if (source.type === "FeatureCollection" && Array.isArray(source.features)) {
    return source.features.length
  }

  if (source.type === "Feature") {
    return 1
  }

  return 0
}

export const INDONESIA_FALLBACK_GEOJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        name: "Indonesia (Fallback Boundary)"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [95.0, -11.5],
            [141.5, -11.5],
            [141.5, 6.5],
            [95.0, 6.5],
            [95.0, -11.5]
          ]
        ]
      }
    }
  ]
} as const
