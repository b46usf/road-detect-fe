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

export interface RoboflowAdminPersist {
  stats: { invalidCount: number; lastInvalidAt?: number } | null
  cache: unknown | null
  updatedAt: string
}
