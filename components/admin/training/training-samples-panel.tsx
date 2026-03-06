"use client"

import Image from "next/image"
import { useMemo } from "react"
import AdaptiveDataTable, { type AdaptiveDataColumn } from "@/components/ui/adaptive-data-table"
import {
  getTrainingStatusLabel,
  getTrainingStatusTone
} from "@/components/admin/training/training-shared"
import type { TrainingSample } from "@/lib/training-types"

interface TrainingSamplesPanelProps {
  samples: TrainingSample[]
  deletingId: string | null
  onDelete: (sampleId: string) => Promise<void>
}

export default function TrainingSamplesPanel(props: TrainingSamplesPanelProps) {
  const { samples, deletingId, onDelete } = props

  const columns = useMemo<AdaptiveDataColumn<TrainingSample>[]>(
    () => [
      {
        id: "image",
        header: "Image",
        searchValue: (row) => `${row.filename} ${row.label} ${row.severity}`,
        desktopCell: (row) => (
          <div className="flex items-center gap-2">
            <Image
              src={row.publicImagePath}
              alt={row.filename}
              width={54}
              height={54}
              unoptimized
              className="h-12 w-12 rounded-md border border-white/10 object-cover"
            />
            <div>
              <p className="max-w-40 truncate">{row.filename}</p>
              <p className="text-[11px] text-slate-400">{Math.round(row.sizeBytes / 1024)} KB</p>
            </div>
          </div>
        ),
        mobileCell: (row) => (
          <div className="flex items-center gap-2">
            <Image
              src={row.publicImagePath}
              alt={row.filename}
              width={48}
              height={48}
              unoptimized
              className="h-11 w-11 rounded-md border border-white/10 object-cover"
            />
            <p className="truncate text-xs">{row.filename}</p>
          </div>
        )
      },
      {
        id: "target",
        header: "Target",
        searchValue: (row) => `${row.label} ${row.severity}`,
        desktopCell: (row) => (
          <div>
            <p>{row.label}</p>
            <p className="text-[11px] text-slate-400">{row.severity}</p>
          </div>
        )
      },
      {
        id: "status",
        header: "Status",
        searchValue: (row) => `${row.status} ${row.lastError ?? ""}`,
        desktopCell: (row) => (
          <div>
            <span
              className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium ${getTrainingStatusTone(row.status)}`}
            >
              {getTrainingStatusLabel(row.status)}
            </span>
            {row.lastError && <p className="mt-1 max-w-xs text-[11px] text-rose-200">{row.lastError}</p>}
          </div>
        ),
        desktopCellClassName: "max-w-xs"
      },
      {
        id: "timestamp",
        header: "Timestamp",
        searchValue: (row) => `${row.createdAt} ${row.uploadedAt ?? ""}`,
        desktopCell: (row) => (
          <div>
            <p>{new Date(row.createdAt).toLocaleString("id-ID")}</p>
            <p className="text-[11px] text-slate-400">
              Upload: {row.uploadedAt ? new Date(row.uploadedAt).toLocaleString("id-ID") : "-"}
            </p>
          </div>
        )
      },
      {
        id: "notes",
        header: "Notes",
        searchValue: (row) => row.notes,
        desktopCell: (row) =>
          row.notes ? <p className="max-w-xs whitespace-pre-wrap">{row.notes}</p> : <p className="text-slate-400">-</p>,
        desktopCellClassName: "max-w-xs"
      },
      {
        id: "action",
        header: "Aksi",
        desktopCell: (row) => (
          <button
            type="button"
            disabled={deletingId === row.id}
            onClick={(event) => {
              event.stopPropagation()
              void onDelete(row.id)
            }}
            className="rounded-lg border border-rose-300/40 bg-rose-400/15 px-3 py-1.5 text-[11px] font-semibold text-rose-100 transition hover:bg-rose-400/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deletingId === row.id ? "Menghapus..." : "Hapus"}
          </button>
        )
      }
    ],
    [deletingId, onDelete]
  )

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:p-5">
      <h2 className="text-lg font-semibold text-slate-100">Daftar Sample Training</h2>
      <p className="mt-1 text-sm text-slate-300">
        Sample tersimpan di folder `public/img/training` dengan metadata state di file JSON server.
      </p>

      <div className="mt-4">
        <AdaptiveDataTable
          rows={samples}
          columns={columns}
          rowKey={(row) => row.id}
          pageSize={20}
          searchPlaceholder="Cari filename, label, severity, status..."
          emptyMessage="Belum ada sample training tersimpan."
          mobileCardTitle={(row) => `${row.label} • ${getTrainingStatusLabel(row.status)}`}
          mobileCardSubtitle={(row) => new Date(row.createdAt).toLocaleString("id-ID")}
        />
      </div>
    </section>
  )
}
