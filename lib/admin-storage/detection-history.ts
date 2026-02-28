import { readString, toFiniteNumber } from "@/lib/common-utils"
import type { DetectionReport } from "@/lib/roboflow-client"
import {
  DETECTION_HISTORY_MAX_ITEMS,
  DETECTION_HISTORY_STORAGE_KEY,
  DETECTION_HISTORY_STORAGE_KEY_LEGACY
} from "./constants"
import {
  canUseLocalStorage,
  parseJson,
  readStorageItemWithLegacy,
  removeStorageKeys
} from "./local-storage"
import {
  createSpatialRecord,
  isSpatialRecord,
  normalizeDetectionLocation,
  normalizeSeverity
} from "./spatial"
import type { StoredDetectionRecord, StoredSeverityLevel } from "./types"

export function createStoredDetectionRecord(params: {
  report: DetectionReport | null
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
      totalDeteksi: Math.max(
        0,
        Number(report?.breakdownKelas?.counts?.totalDeteksi) || totalDeteksi
      )
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
      isFhdSource:
        typeof report?.visualBukti?.isFhdSource === "boolean" ? report.visualBukti.isFhdSource : null
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

function normalizeRecord(value: unknown, index: number): StoredDetectionRecord | null {
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
  if (!canUseLocalStorage()) {
    return []
  }

  const raw = readStorageItemWithLegacy(DETECTION_HISTORY_STORAGE_KEY, [
    DETECTION_HISTORY_STORAGE_KEY_LEGACY
  ])
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
  if (!canUseLocalStorage()) {
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
  if (!canUseLocalStorage()) {
    return
  }

  removeStorageKeys([DETECTION_HISTORY_STORAGE_KEY, DETECTION_HISTORY_STORAGE_KEY_LEGACY])
}
