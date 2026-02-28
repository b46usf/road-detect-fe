"use client"

import Link from "next/link"
import { useMemo } from "react"
import type { StoredDetectionRecord } from "@/lib/admin-storage"
import AdaptiveDataTable, { type AdaptiveDataColumn } from "@/components/ui/adaptive-data-table"
import { formatPercent, severityLabel, severityTone } from "@/lib/ui-utils"

interface DetectionHistoryPanelProps {
  records: StoredDetectionRecord[]
}

export default function DetectionHistoryPanel(props: DetectionHistoryPanelProps) {
  const { records } = props

  const columns = useMemo<AdaptiveDataColumn<StoredDetectionRecord>[]>(
    () => [
      {
        id: "waktu",
        header: "Waktu",
        searchValue: (row) => `${row.waktuDeteksi} ${row.createdAt}`,
        desktopCell: (row) => (
          <>
            <p>{new Date(row.waktuDeteksi).toLocaleString("id-ID")}</p>
            <p className="text-[11px] text-slate-400">
              Simpan: {new Date(row.createdAt).toLocaleTimeString("id-ID")}
            </p>
          </>
        ),
        mobileCell: (row) => <p>{new Date(row.waktuDeteksi).toLocaleString("id-ID")}</p>
      },
      {
        id: "severity",
        header: "Severity",
        searchValue: (row) => row.tingkatKerusakan,
        desktopCell: (row) => (
          <>
            <span
              className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium ${severityTone(row.tingkatKerusakan)}`}
            >
              {severityLabel(row.tingkatKerusakan)}
            </span>
            <p className="mt-1 text-[11px] text-slate-400">total {row.totalDeteksi} deteksi</p>
          </>
        )
      },
      {
        id: "luasan",
        header: "Luasan",
        searchValue: (row) => `${row.luasanKerusakanPercent} ${row.apiDurationMs ?? ""}`,
        desktopCell: (row) => (
          <>
            <p>{formatPercent(row.luasanKerusakanPercent)}</p>
            <p className="text-[11px] text-slate-400">
              API: {row.apiDurationMs !== null ? `${Math.round(row.apiDurationMs)} ms` : "n/a"}
            </p>
          </>
        )
      },
      {
        id: "multiclass",
        header: "Multi-class",
        searchValue: (row) =>
          `${row.classCounts.pothole} ${row.classCounts.crack} ${row.classCounts.rutting} ${row.dominantClass ?? ""}`,
        desktopCell: (row) => (
          <>
            <p>{`pothole ${row.classCounts.pothole}, crack ${row.classCounts.crack}, rutting ${row.classCounts.rutting}`}</p>
            <p className="text-[11px] text-slate-400">dominan: {row.dominantClass ?? "n/a"}</p>
          </>
        )
      },
      {
        id: "lokasi",
        header: "Lokasi",
        searchValue: (row) =>
          row.lokasi ? `${row.lokasi.latitude} ${row.lokasi.longitude}` : "tanpa lokasi",
        desktopCell: (row) =>
          row.lokasi ? (
            <>
              <p>{`${row.lokasi.latitude.toFixed(6)}, ${row.lokasi.longitude.toFixed(6)}`}</p>
              <p className="text-[11px] text-slate-400">
                akurasi {row.lokasi.accuracy !== null ? `${Math.round(row.lokasi.accuracy)} m` : "n/a"}
              </p>
            </>
          ) : (
            <p className="text-slate-400">n/a</p>
          )
      },
      {
        id: "postgis",
        header: "PostGIS (EWKT)",
        searchValue: (row) => row.spatial?.postgis.ewkt ?? "",
        desktopCell: (row) =>
          row.spatial ? (
            <>
              <p className="break-all font-mono text-[11px]">{row.spatial.postgis.ewkt}</p>
              <p className="text-[11px] text-slate-400">CRS {row.spatial.sourceCrs}</p>
            </>
          ) : (
            <p className="text-slate-400">n/a</p>
          ),
        desktopCellClassName: "max-w-xs"
      },
      {
        id: "model",
        header: "Model",
        searchValue: (row) => `${row.modelId} ${row.modelVersion}`,
        desktopCell: (row) => (
          <>
            <p>{row.modelId}</p>
            <p className="text-[11px] text-slate-400">v{row.modelVersion}</p>
          </>
        )
      }
    ],
    []
  )

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm sm:p-4">
      <div className="mb-3 flex flex-wrap gap-2">
        <Link
          href="/camera"
          className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-medium transition hover:bg-white/10"
        >
          Ke Kamera
        </Link>
        <Link
          href="/admin/login"
          className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-medium transition hover:bg-white/10"
        >
          Ke Login
        </Link>
        <Link
          href="/"
          className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-medium transition hover:bg-white/10"
        >
          Ke Home
        </Link>
      </div>

      <AdaptiveDataTable
        rows={records}
        rowKey={(row) => row.id}
        columns={columns}
        pageSize={25}
        searchPlaceholder="Cari waktu, severity, model, kelas, koordinat..."
        emptyMessage="Belum ada data tersimpan. Jalankan deteksi di halaman kamera untuk mulai mengisi riwayat."
        mobileCardTitle={(row) => `${severityLabel(row.tingkatKerusakan)} • ${formatPercent(row.luasanKerusakanPercent)}`}
        mobileCardSubtitle={(row) => new Date(row.waktuDeteksi).toLocaleString("id-ID")}
      />
    </section>
  )
}
