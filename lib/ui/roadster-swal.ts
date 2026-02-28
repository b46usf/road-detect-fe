import type { SweetAlertOptions } from "sweetalert2"
import type { StoredDetectionRecord } from "@/lib/admin-storage"
import { formatPercent, severityLabel } from "@/lib/ui-utils"

const BASE_SWAL_OPTIONS: SweetAlertOptions = {
  backdrop: "rgba(2, 6, 23, 0.76)",
  allowEscapeKey: true,
  allowOutsideClick: true,
  customClass: {
    popup: "roadster-swal-popup",
    title: "roadster-swal-title",
    htmlContainer: "roadster-swal-html",
    confirmButton: "roadster-swal-confirm",
    cancelButton: "roadster-swal-cancel"
  },
  buttonsStyling: false
}

type SweetAlertModule = typeof import("sweetalert2")

let swalModulePromise: Promise<SweetAlertModule> | null = null

async function getSwal() {
  if (!swalModulePromise) {
    swalModulePromise = import("sweetalert2")
  }

  const swalModule = await swalModulePromise
  return swalModule.default
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function getDamageTypeLabel(record: StoredDetectionRecord): string {
  const classLabelMap: Record<string, string> = {
    pothole: "Aspal Lepas",
    crack: "Retak",
    rutting: "Alur/Rutting",
    lainnya: "Lainnya"
  }

  if (record.dominantClass && classLabelMap[record.dominantClass]) {
    return classLabelMap[record.dominantClass]
  }

  if (record.totalDeteksi <= 0) {
    return "Tidak Terdeteksi"
  }

  const classCounts = [
    { key: "pothole", value: record.classCounts.pothole },
    { key: "crack", value: record.classCounts.crack },
    { key: "rutting", value: record.classCounts.rutting },
    { key: "lainnya", value: record.classCounts.lainnya }
  ]
  const dominant = classCounts.sort((a, b) => b.value - a.value)[0]
  return classLabelMap[dominant.key] ?? "Tidak Terdeteksi"
}

function getAiAccuracyPercent(record: StoredDetectionRecord): number {
  if (record.totalDeteksi <= 0) {
    return 0
  }

  const dominantClass = record.dominantClass
  if (dominantClass === "pothole") return record.classDistribution.pothole
  if (dominantClass === "crack") return record.classDistribution.crack
  if (dominantClass === "rutting") return record.classDistribution.rutting
  if (dominantClass === "lainnya") return record.classDistribution.lainnya

  const classCounts = [
    record.classCounts.pothole,
    record.classCounts.crack,
    record.classCounts.rutting,
    record.classCounts.lainnya
  ]
  const highestCount = Math.max(...classCounts)
  return Math.max(0, Math.min(100, (highestCount / Math.max(1, record.totalDeteksi)) * 100))
}

function getRecommendation(severity: StoredDetectionRecord["tingkatKerusakan"]): string {
  if (severity === "berat") {
    return "Patch struktural + overlay 4-6 cm"
  }
  if (severity === "sedang") {
    return "Overlay tipis (2-3 cm)"
  }
  if (severity === "ringan") {
    return "Seal crack tipis / slurry seal lokal"
  }
  return "Monitoring berkala dan inspeksi ulang"
}

function getSeverityClassName(severity: StoredDetectionRecord["tingkatKerusakan"]): string {
  if (severity === "berat") return "roadster-detection-value roadster-detection-value--heavy"
  if (severity === "sedang") return "roadster-detection-value roadster-detection-value--medium"
  if (severity === "ringan") return "roadster-detection-value roadster-detection-value--light"
  return "roadster-detection-value roadster-detection-value--neutral"
}

function buildDetectionResultHtml(record: StoredDetectionRecord): string {
  const damageTypeLabel = escapeHtml(getDamageTypeLabel(record))
  const aiAccuracy = escapeHtml(formatPercent(getAiAccuracyPercent(record)))
  const severityText = escapeHtml(severityLabel(record.tingkatKerusakan))
  const severityClassName = getSeverityClassName(record.tingkatKerusakan)
  const areaText = escapeHtml(formatPercent(record.luasanKerusakanPercent))
  const recommendation = escapeHtml(getRecommendation(record.tingkatKerusakan))
  const detectedAt = escapeHtml(new Date(record.waktuDeteksi).toLocaleString("id-ID"))
  const modelText = escapeHtml(`${record.modelId} v${record.modelVersion}`)
  const locationText = escapeHtml(
    record.lokasi
      ? `${record.lokasi.latitude.toFixed(6)}, ${record.lokasi.longitude.toFixed(6)}`
      : "tanpa GPS"
  )
  const durationText = escapeHtml(
    record.apiDurationMs !== null ? `${Math.round(record.apiDurationMs)} ms` : "n/a"
  )

  return `
    <section class="roadster-detection-modal">
      <header class="roadster-detection-header">
        <div class="roadster-detection-icon">+</div>
        <div>
          <p class="roadster-detection-heading">AI Detection Result</p>
          <p class="roadster-detection-subheading">Powered by YOLOv8 / Rapid Workflows</p>
        </div>
      </header>

      <div class="roadster-detection-grid">
        <article class="roadster-detection-card">
          <p class="roadster-detection-label">Jenis Kerusakan</p>
          <p class="roadster-detection-value">${damageTypeLabel}</p>
        </article>
        <article class="roadster-detection-card">
          <p class="roadster-detection-label">Akurasi AI</p>
          <p class="roadster-detection-value roadster-detection-value--accuracy">${aiAccuracy}</p>
        </article>
        <article class="roadster-detection-card">
          <p class="roadster-detection-label">Tingkat Kerusakan</p>
          <p class="${severityClassName}">${severityText}</p>
        </article>
        <article class="roadster-detection-card">
          <p class="roadster-detection-label">Area Kerusakan</p>
          <p class="roadster-detection-value roadster-detection-value--area">${areaText}</p>
        </article>
      </div>

      <article class="roadster-detection-card roadster-detection-card--full">
        <p class="roadster-detection-label">Rekomendasi Perbaikan</p>
        <p class="roadster-detection-value roadster-detection-value--recommendation">${recommendation}</p>
      </article>

      <div class="roadster-detection-meta">
        <p>Waktu: ${detectedAt}</p>
        <p>Model: ${modelText}</p>
        <p>Lokasi: ${locationText}</p>
        <p>API: ${durationText}</p>
      </div>
    </section>
  `
}

export async function closeRoadsterSwal(): Promise<void> {
  const Swal = await getSwal()
  Swal.close()
}

export async function fireRoadsterSwal(options: SweetAlertOptions) {
  const mergedOptions = {
    ...BASE_SWAL_OPTIONS,
    ...options,
    customClass: {
      ...BASE_SWAL_OPTIONS.customClass,
      ...options.customClass
    }
  } as SweetAlertOptions

  const Swal = await getSwal()
  return Swal.fire(mergedOptions)
}

export async function showDetectionResultSwal(record: StoredDetectionRecord): Promise<void> {
  await fireRoadsterSwal({
    title: "ROADSTER Detection Detail",
    html: buildDetectionResultHtml(record),
    showConfirmButton: true,
    confirmButtonText: "Tutup"
  })
}

export async function confirmRoadsterAction(params: {
  title: string
  text: string
  confirmButtonText: string
  cancelButtonText?: string
}): Promise<boolean> {
  const result = await fireRoadsterSwal({
    icon: "warning",
    title: params.title,
    text: params.text,
    showCancelButton: true,
    reverseButtons: true,
    confirmButtonText: params.confirmButtonText,
    cancelButtonText: params.cancelButtonText ?? "Batal"
  })

  return result.isConfirmed
}
