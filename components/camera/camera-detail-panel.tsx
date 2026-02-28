import Image from "next/image"
import {
  LIGHT_SEVERITY_MAX_PERCENT,
  MEDIUM_SEVERITY_MAX_PERCENT
} from "@/lib/roboflow-utils"
import { dominantSeverityLabel, formatPercent, severityLabel } from "@/lib/ui-utils"
import {
  CAPTURE_JPEG_QUALITY,
  MAX_CAPTURE_HEIGHT,
  MAX_CAPTURE_WIDTH
} from "./constants"
import type { ApiStatus, DetectionApiReport, GpsLocation, SeverityAssessment } from "./types"

interface CameraDetailPanelProps {
  snapshotUrl: string | null
  onDownloadSnapshot: () => void
  severityAssessment: SeverityAssessment
  gpsLocation: GpsLocation | null
  gpsError: string | null
  lastDetectionReport: DetectionApiReport | null
  lastSnapshotAt: Date | null
  lastInferenceAt: Date | null
  lastInferenceDurationMs: number | null
  lastApiStatus: ApiStatus
  lastApiMessage: string | null
  lastApiCode: string | null
  storageMessage: string | null
  lastStoredAt: Date | null
  inferenceError: string | null
}

export default function CameraDetailPanel(props: CameraDetailPanelProps) {
  const {
    snapshotUrl,
    onDownloadSnapshot,
    severityAssessment,
    gpsLocation,
    gpsError,
    lastDetectionReport,
    lastSnapshotAt,
    lastInferenceAt,
    lastInferenceDurationMs,
    lastApiStatus,
    lastApiMessage,
    lastApiCode,
    storageMessage,
    lastStoredAt,
    inferenceError
  } = props

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold sm:text-base">Snapshot Frame</h2>
          <span className="text-xs text-slate-400">Auto update ~1 detik (inferensi ~2.5 detik)</span>
        </div>

        <button
          type="button"
          onClick={onDownloadSnapshot}
          disabled={!snapshotUrl}
          className="rounded-lg bg-emerald-300 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-slate-700"
        >
          Simpan Snapshot
        </button>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/60">
        <div className="relative aspect-[16/9] w-full">
          {snapshotUrl ? (
            <Image
              src={snapshotUrl}
              alt="Snapshot frame dari video kamera"
              fill
              unoptimized
              sizes="(max-width: 768px) 100vw, 70vw"
              className="object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center p-4 text-sm text-slate-400">
              Menunggu frame dari kamera...
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <article className="rounded-xl border border-white/10 bg-black/35 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Estimasi Kerusakan</p>
          <p className="mt-1 text-lg font-semibold text-slate-100">
            {formatPercent(severityAssessment.totalDamagePercent)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {severityAssessment.dominantSeverity
              ? `Dominan: ${severityLabel(severityAssessment.dominantSeverity)}`
              : "Menunggu hasil deteksi."}
          </p>
        </article>

        <article className="rounded-xl border border-white/10 bg-black/35 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Distribusi Severity</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
            <div className="rounded-lg border border-emerald-300/35 bg-emerald-400/10 p-2 text-center">
              <p className="font-semibold text-emerald-200">Ringan</p>
              <p className="text-emerald-100">{formatPercent(severityAssessment.distributionPercent.ringan)}</p>
              <p className="text-emerald-200/80">{severityAssessment.counts.ringan} box</p>
            </div>
            <div className="rounded-lg border border-amber-300/35 bg-amber-400/10 p-2 text-center">
              <p className="font-semibold text-amber-200">Sedang</p>
              <p className="text-amber-100">{formatPercent(severityAssessment.distributionPercent.sedang)}</p>
              <p className="text-amber-200/80">{severityAssessment.counts.sedang} box</p>
            </div>
            <div className="rounded-lg border border-rose-300/35 bg-rose-400/10 p-2 text-center">
              <p className="font-semibold text-rose-200">Berat</p>
              <p className="text-rose-100">{formatPercent(severityAssessment.distributionPercent.berat)}</p>
              <p className="text-rose-200/80">{severityAssessment.counts.berat} box</p>
            </div>
          </div>
        </article>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <article className="rounded-xl border border-white/10 bg-black/35 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Lokasi Realtime (GPS/GNSS)</p>
          {gpsLocation ? (
            <>
              <p className="mt-1 text-sm font-semibold text-slate-100">
                {gpsLocation.latitude.toFixed(6)}, {gpsLocation.longitude.toFixed(6)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Akurasi: {gpsLocation.accuracy !== null ? `${Math.round(gpsLocation.accuracy)} m` : "n/a"}
              </p>
              <p className="text-xs text-slate-400">
                Update: {new Date(gpsLocation.timestamp).toLocaleTimeString("id-ID")}
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs text-slate-400">Menunggu data GPS...</p>
          )}
          {gpsError && <p className="mt-2 text-xs text-rose-300">{gpsError}</p>}
        </article>

        <article className="rounded-xl border border-white/10 bg-black/35 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Ringkasan Response API</p>
          <p className="mt-1 text-xs text-slate-300">
            Luasan: {lastDetectionReport ? formatPercent(lastDetectionReport.luasanKerusakan.totalPersentase) : "n/a"}
          </p>
          <p className="text-xs text-slate-300">
            Level: {lastDetectionReport ? dominantSeverityLabel(lastDetectionReport.tingkatKerusakan.dominan) : "n/a"}
          </p>
          <p className="text-xs text-slate-300">
            Kelas dominan: {lastDetectionReport?.breakdownKelas?.dominanKelas ?? "n/a"}
          </p>
          <p className="text-xs text-slate-300">
            Multi-class: {lastDetectionReport ? `pothole ${lastDetectionReport.breakdownKelas?.counts?.pothole ?? 0}, crack ${lastDetectionReport.breakdownKelas?.counts?.crack ?? 0}, rutting ${lastDetectionReport.breakdownKelas?.counts?.rutting ?? 0}, lainnya ${lastDetectionReport.breakdownKelas?.counts?.lainnya ?? 0}` : "n/a"}
          </p>
          <p className="text-xs text-slate-300">
            Distribusi kelas: {lastDetectionReport ? `pothole ${formatPercent(lastDetectionReport.breakdownKelas?.distribusiPersentase?.pothole ?? 0)}, crack ${formatPercent(lastDetectionReport.breakdownKelas?.distribusiPersentase?.crack ?? 0)}, rutting ${formatPercent(lastDetectionReport.breakdownKelas?.distribusiPersentase?.rutting ?? 0)}` : "n/a"}
          </p>
          <p className="text-xs text-slate-300">
            Waktu: {lastDetectionReport?.waktuDeteksi ? new Date(lastDetectionReport.waktuDeteksi).toLocaleString("id-ID") : "n/a"}
          </p>
          <p className="text-xs text-slate-300">
            Lokasi: {lastDetectionReport?.lokasi ? `${lastDetectionReport.lokasi.latitude.toFixed(6)}, ${lastDetectionReport.lokasi.longitude.toFixed(6)}` : "n/a"}
          </p>
          <p className="text-xs text-slate-300">
            Visual: {lastDetectionReport ? `${lastDetectionReport.visualBukti?.resolusiCapture?.width ?? "?"}x${lastDetectionReport.visualBukti?.resolusiCapture?.height ?? "?"} | Source FHD: ${lastDetectionReport.visualBukti?.isFhdSource ? "Ya" : "Tidak"}` : "n/a"}
          </p>
          {lastDetectionReport && lastDetectionReport.breakdownKelas.daftar.length > 0 && (
            <div className="mt-2 rounded-md border border-white/10 bg-black/40 p-2">
              <p className="text-[11px] font-semibold text-slate-300">Detail Kelas (Top 5)</p>
              {lastDetectionReport.breakdownKelas.daftar.slice(0, 5).map((item) => (
                <p key={item.label} className="text-[11px] text-slate-400">
                  {`${item.label}: ${item.jumlah} box | ${formatPercent(item.persentaseJumlah)} | ${dominantSeverityLabel(item.dominanSeverity)}`}
                </p>
              ))}
            </div>
          )}
          {lastDetectionReport?.visualBukti?.imageDataUrl && (
            <div className="relative mt-2 h-20 w-full overflow-hidden rounded-md">
              <Image
                src={lastDetectionReport.visualBukti?.imageDataUrl}
                alt="Visual bukti dari response API"
                fill
                unoptimized
                sizes="100vw"
                className="object-cover"
              />
            </div>
          )}
        </article>
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        Ambang severity: Ringan &lt; {LIGHT_SEVERITY_MAX_PERCENT}% area frame, Sedang &lt; {MEDIUM_SEVERITY_MAX_PERCENT}%, Berat di atasnya.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
        <p>
          {lastSnapshotAt
            ? `Snapshot: ${lastSnapshotAt.toLocaleTimeString("id-ID")}`
            : "Snapshot akan tampil setelah video aktif."}
        </p>
        <p>
          {lastInferenceAt
            ? `Inferensi: ${lastInferenceAt.toLocaleTimeString("id-ID")}`
            : "Inferensi menunggu frame pertama."}
        </p>
        <p>
          {lastInferenceDurationMs !== null
            ? `Durasi API: ${Math.round(lastInferenceDurationMs)} ms`
            : "Durasi API belum tersedia."}
        </p>
        <p>{`Resize: maks ${MAX_CAPTURE_WIDTH}x${MAX_CAPTURE_HEIGHT}, JPEG ${CAPTURE_JPEG_QUALITY}`}</p>
        <p>
          {lastStoredAt
            ? `LocalStorage: ${lastStoredAt.toLocaleTimeString("id-ID")}`
            : "LocalStorage: belum ada data tersimpan."}
        </p>
      </div>

      {lastApiStatus === "success" && lastApiMessage && (
        <p className="mt-2 text-xs text-emerald-300">{lastApiMessage}</p>
      )}
      {storageMessage && (
        <p
          className={`mt-1 text-xs ${
            storageMessage.toLowerCase().includes("tersimpan") ? "text-cyan-300" : "text-amber-300"
          }`}
        >
          {storageMessage}
        </p>
      )}

      {inferenceError && <p className="mt-2 text-xs text-rose-300">{inferenceError}</p>}
      {lastApiStatus === "error" && lastApiCode && (
        <p className="mt-1 text-xs text-rose-300/80">Kode error: {lastApiCode}</p>
      )}
    </div>
  )
}
