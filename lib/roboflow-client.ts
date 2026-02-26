export function extractApiErrorInfo(payload: unknown): { code: string | null; message: string } | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const source = payload as Record<string, unknown>

  if (source.ok === true) {
    return null
  }

  if (source.ok === false) {
    const envelopeError =
      source.error && typeof source.error === "object"
        ? (source.error as Record<string, unknown>)
        : null

    const code =
      envelopeError && typeof envelopeError.code === "string" && envelopeError.code.trim().length > 0
        ? envelopeError.code
        : null

    const message =
      (envelopeError &&
        typeof envelopeError.message === "string" &&
        envelopeError.message.trim().length > 0 &&
        envelopeError.message) ||
      (typeof source.message === "string" && source.message.trim().length > 0 && source.message) ||
      "Request API gagal diproses."

    return { code, message }
  }

  if (typeof source.error === "string" && source.error.trim().length > 0) {
    return { code: null, message: source.error }
  }

  return null
}

export function extractDetectionReport(value: unknown): any | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const source = value as Record<string, unknown>
  const area = source.luasanKerusakan
  const level = source.tingkatKerusakan
  const visual = source.visualBukti

  if (!area || typeof area !== "object" || !level || typeof level !== "object" || !visual || typeof visual !== "object") {
    return null
  }

  const areaObject = area as Record<string, unknown>
  const levelObject = level as Record<string, unknown>
  const countsObject =
    levelObject.jumlah && typeof levelObject.jumlah === "object"
      ? (levelObject.jumlah as Record<string, unknown>)
      : {}
  const distObject =
    levelObject.distribusiPersentase && typeof levelObject.distribusiPersentase === "object"
      ? (levelObject.distribusiPersentase as Record<string, unknown>)
      : {}
  const visualObject = visual as Record<string, unknown>
  const captureRes =
    visualObject.resolusiCapture && typeof visualObject.resolusiCapture === "object"
      ? (visualObject.resolusiCapture as Record<string, unknown>)
      : {}
  const sourceRes =
    visualObject.resolusiSource && typeof visualObject.resolusiSource === "object"
      ? (visualObject.resolusiSource as Record<string, unknown>)
      : {}

  const dominantRaw = typeof levelObject.dominan === "string" ? levelObject.dominan.toLowerCase() : "tidak-terdeteksi"
  const dominant =
    dominantRaw === "ringan" || dominantRaw === "sedang" || dominantRaw === "berat"
      ? dominantRaw
      : "tidak-terdeteksi"

  const counts = {
    ringan: Math.max(0, (countsObject.ringan as number) ?? 0),
    sedang: Math.max(0, (countsObject.sedang as number) ?? 0),
    berat: Math.max(0, (countsObject.berat as number) ?? 0)
  }

  const distribusi = {
    ringan: Math.max(0, (distObject.ringan as number) ?? 0),
    sedang: Math.max(0, (distObject.sedang as number) ?? 0),
    berat: Math.max(0, (distObject.berat as number) ?? 0)
  }

  const breakdownCounts =
    levelObject.breakdownKelas && typeof levelObject.breakdownKelas === "object"
      ? ((levelObject.breakdownKelas as Record<string, unknown>).counts as Record<string, unknown>)
      : {}
  const breakdownDistribution =
    levelObject.breakdownKelas && typeof levelObject.breakdownKelas === "object"
      ? ((levelObject.breakdownKelas as Record<string, unknown>).distribusiPersentase as Record<string, unknown>)
      : {}

  const daftar =
    levelObject.breakdownKelas && Array.isArray((levelObject.breakdownKelas as Record<string, unknown>).daftar)
      ? (((levelObject.breakdownKelas as Record<string, unknown>).daftar as unknown[]) as Record<string, unknown>[])
      : []

  const visualInfo = {
    imageDataUrl: typeof visualObject.imageDataUrl === "string" ? visualObject.imageDataUrl : null,
    mime: typeof visualObject.mime === "string" ? visualObject.mime : "image/jpeg",
    quality: typeof (visualObject.quality as number) === "number" ? (visualObject.quality as number) : null,
    resolusiCapture: {
      width: typeof captureRes.width === "number" ? (captureRes.width as number) : null,
      height: typeof captureRes.height === "number" ? (captureRes.height as number) : null
    },
    resolusiSource: {
      width: typeof sourceRes.width === "number" ? (sourceRes.width as number) : null,
      height: typeof sourceRes.height === "number" ? (sourceRes.height as number) : null
    },
    isFhdSource:
      (typeof sourceRes.width === "number" && typeof sourceRes.height === "number")
        ? Math.max(sourceRes.width as number, sourceRes.height as number) >= 1920 && Math.min(sourceRes.width as number, sourceRes.height as number) >= 1080
        : null
  }

  return {
    luasanKerusakan: {
      totalPersentase: Math.max(0, (areaObject.totalPersentase as number) ?? 0),
      totalBoxAreaPx: Math.max(0, (areaObject.totalBoxAreaPx as number) ?? 0),
      frameAreaPx: Math.max(0, (areaObject.frameAreaPx as number) ?? 0)
    },
    tingkatKerusakan: {
      dominan: dominant,
      jumlah: {
        ...counts,
        totalDeteksi: Math.max(0, (countsObject.totalDeteksi as number) ?? 0)
      },
      distribusiPersentase: distribusi
    },
    breakdownKelas: {
      counts: {
        pothole: Math.max(0, (breakdownCounts.pothole as number) ?? 0),
        crack: Math.max(0, (breakdownCounts.crack as number) ?? 0),
        rutting: Math.max(0, (breakdownCounts.rutting as number) ?? 0),
        lainnya: Math.max(0, (breakdownCounts.lainnya as number) ?? 0),
        totalDeteksi: Math.max(0, (breakdownCounts.totalDeteksi as number) ?? 0)
      },
      distribusiPersentase: {
        pothole: Math.max(0, (breakdownDistribution.pothole as number) ?? 0),
        crack: Math.max(0, (breakdownDistribution.crack as number) ?? 0),
        rutting: Math.max(0, (breakdownDistribution.rutting as number) ?? 0),
        lainnya: Math.max(0, (breakdownDistribution.lainnya as number) ?? 0)
      },
      dominanKelas:
        typeof ((levelObject.breakdownKelas as Record<string, unknown>)?.dominanKelas) === "string"
          ? ((levelObject.breakdownKelas as Record<string, unknown>)?.dominanKelas as string)
          : null,
    daftar: daftar.map((row) => ({
      label: typeof row.label === "string" ? row.label : "",
      jumlah: Math.max(0, Number(row.jumlah) || 0),
      persentaseJumlah: Math.max(0, Number(row.persentaseJumlah) || 0),
      totalPersentaseArea: Math.max(0, Number(row.totalPersentaseArea) || 0),
      dominanSeverity: typeof row.dominanSeverity === "string" ? row.dominanSeverity : "tidak-terdeteksi"
    }))
  }
}
