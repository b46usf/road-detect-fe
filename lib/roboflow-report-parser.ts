import { toFiniteNumber } from "./common-utils"

export type DominantSeverity = "ringan" | "sedang" | "berat" | "tidak-terdeteksi"

export interface DetectionReport {
  luasanKerusakan: {
    totalPersentase: number
    totalBoxAreaPx: number
    frameAreaPx: number
  }
  tingkatKerusakan: {
    dominan: DominantSeverity
    jumlah: {
      ringan: number
      sedang: number
      berat: number
      totalDeteksi: number
    }
    distribusiPersentase: {
      ringan: number
      sedang: number
      berat: number
    }
  }
  breakdownKelas: {
    counts: {
      pothole: number
      crack: number
      rutting: number
      lainnya: number
      totalDeteksi: number
    }
    distribusiPersentase: {
      pothole: number
      crack: number
      rutting: number
      lainnya: number
    }
    dominanKelas: string | null
    daftar: Array<{
      label: string
      jumlah: number
      persentaseJumlah: number
      totalPersentaseArea: number
      dominanSeverity: DominantSeverity
    }>
  }
  lokasi: {
    latitude: number
    longitude: number
    accuracy: number | null
    altitude: number | null
    heading: number | null
    speed: number | null
    timestamp: string | null
    source: string
  } | null
  waktuDeteksi: string
  visualBukti: {
    imageDataUrl: string | null
    mime: string
    quality: number | null
    resolusiCapture: {
      width: number | null
      height: number | null
    }
    resolusiSource: {
      width: number | null
      height: number | null
    }
    isFhdSource: boolean | null
  }
}

export interface InferenceDataPayload {
  predictions?: unknown
  image?: {
    width?: unknown
    height?: unknown
  }
  [key: string]: unknown
}

function toNonNegativeNumber(value: unknown): number {
  return Math.max(0, Number(value) || 0)
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function parseReportLocation(value: unknown): DetectionReport["lokasi"] {
  const source = readObject(value)
  const latitude = toFiniteNumber(source.latitude)
  const longitude = toFiniteNumber(source.longitude)

  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null
  }

  const sourceLabel =
    typeof source.source === "string" && source.source.trim().length > 0 ? source.source : "gps"

  return {
    latitude,
    longitude,
    accuracy: toFiniteNumber(source.accuracy),
    altitude: toFiniteNumber(source.altitude),
    heading: toFiniteNumber(source.heading),
    speed: toFiniteNumber(source.speed),
    timestamp: typeof source.timestamp === "string" ? source.timestamp : null,
    source: sourceLabel
  }
}

export function extractDetectionReport(value: unknown): DetectionReport | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const source = value as Record<string, unknown>
  const areaObject = readObject(source.luasanKerusakan)
  const levelObject = readObject(source.tingkatKerusakan)
  const visualObject = readObject(source.visualBukti)

  if (
    Object.keys(areaObject).length === 0 ||
    Object.keys(levelObject).length === 0 ||
    Object.keys(visualObject).length === 0
  ) {
    return null
  }

  const countsObject = readObject(levelObject.jumlah)
  const distObject = readObject(levelObject.distribusiPersentase)

  const breakdownObject = readObject(source.breakdownKelas)
  const breakdownCounts = readObject(breakdownObject.counts)
  const breakdownDistribution = readObject(breakdownObject.distribusiPersentase)
  const rawDaftar = Array.isArray(breakdownObject.daftar) ? breakdownObject.daftar : []

  const captureRes = readObject(visualObject.resolusiCapture)
  const sourceRes = readObject(visualObject.resolusiSource)

  const dominantRaw =
    typeof levelObject.dominan === "string" ? levelObject.dominan.toLowerCase() : "tidak-terdeteksi"
  const dominant: DominantSeverity =
    dominantRaw === "ringan" || dominantRaw === "sedang" || dominantRaw === "berat"
      ? dominantRaw
      : "tidak-terdeteksi"

  const sourceWidth = toFiniteNumber(sourceRes.width)
  const sourceHeight = toFiniteNumber(sourceRes.height)

  return {
    luasanKerusakan: {
      totalPersentase: toNonNegativeNumber(areaObject.totalPersentase),
      totalBoxAreaPx: toNonNegativeNumber(areaObject.totalBoxAreaPx),
      frameAreaPx: toNonNegativeNumber(areaObject.frameAreaPx)
    },
    tingkatKerusakan: {
      dominan: dominant,
      jumlah: {
        ringan: toNonNegativeNumber(countsObject.ringan),
        sedang: toNonNegativeNumber(countsObject.sedang),
        berat: toNonNegativeNumber(countsObject.berat),
        totalDeteksi: toNonNegativeNumber(countsObject.totalDeteksi)
      },
      distribusiPersentase: {
        ringan: toNonNegativeNumber(distObject.ringan),
        sedang: toNonNegativeNumber(distObject.sedang),
        berat: toNonNegativeNumber(distObject.berat)
      }
    },
    breakdownKelas: {
      counts: {
        pothole: toNonNegativeNumber(breakdownCounts.pothole),
        crack: toNonNegativeNumber(breakdownCounts.crack),
        rutting: toNonNegativeNumber(breakdownCounts.rutting),
        lainnya: toNonNegativeNumber(breakdownCounts.lainnya),
        totalDeteksi: toNonNegativeNumber(breakdownCounts.totalDeteksi)
      },
      distribusiPersentase: {
        pothole: toNonNegativeNumber(breakdownDistribution.pothole),
        crack: toNonNegativeNumber(breakdownDistribution.crack),
        rutting: toNonNegativeNumber(breakdownDistribution.rutting),
        lainnya: toNonNegativeNumber(breakdownDistribution.lainnya)
      },
      dominanKelas:
        typeof breakdownObject.dominanKelas === "string" ? breakdownObject.dominanKelas : null,
      daftar: rawDaftar.map((row) => {
        const rowObject = readObject(row)
        const rowDominant =
          typeof rowObject.dominanSeverity === "string" &&
          ["ringan", "sedang", "berat", "tidak-terdeteksi"].includes(rowObject.dominanSeverity)
            ? (rowObject.dominanSeverity as DominantSeverity)
            : "tidak-terdeteksi"

        return {
          label: typeof rowObject.label === "string" ? rowObject.label : "",
          jumlah: toNonNegativeNumber(rowObject.jumlah),
          persentaseJumlah: toNonNegativeNumber(rowObject.persentaseJumlah),
          totalPersentaseArea: toNonNegativeNumber(rowObject.totalPersentaseArea),
          dominanSeverity: rowDominant
        }
      })
    },
    lokasi: parseReportLocation(source.lokasi),
    waktuDeteksi:
      typeof source.waktuDeteksi === "string" && source.waktuDeteksi.trim().length > 0
        ? source.waktuDeteksi
        : new Date().toISOString(),
    visualBukti: {
      imageDataUrl: typeof visualObject.imageDataUrl === "string" ? visualObject.imageDataUrl : null,
      mime: typeof visualObject.mime === "string" ? visualObject.mime : "image/jpeg",
      quality: toFiniteNumber(visualObject.quality),
      resolusiCapture: {
        width: toFiniteNumber(captureRes.width),
        height: toFiniteNumber(captureRes.height)
      },
      resolusiSource: {
        width: sourceWidth,
        height: sourceHeight
      },
      isFhdSource:
        sourceWidth !== null && sourceHeight !== null
          ? Math.max(sourceWidth, sourceHeight) >= 1920 && Math.min(sourceWidth, sourceHeight) >= 1080
          : null
    }
  }
}
