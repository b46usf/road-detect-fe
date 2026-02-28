"use client"

import type { ReactNode } from "react"
import { useAdaptiveDataTable } from "./use-adaptive-data-table"

export interface AdaptiveDataColumn<T> {
  id: string
  header: string
  desktopCell: (row: T) => ReactNode
  mobileCell?: (row: T) => ReactNode
  searchValue?: (row: T) => string
  desktopHeaderClassName?: string
  desktopCellClassName?: string
}

interface AdaptiveDataTableProps<T> {
  rows: T[]
  columns: AdaptiveDataColumn<T>[]
  rowKey: (row: T) => string
  pageSize?: number
  searchPlaceholder?: string
  emptyMessage?: string
  mobileCardTitle?: (row: T) => ReactNode
  mobileCardSubtitle?: (row: T) => ReactNode
  onRowClick?: (row: T) => void
  rowAriaLabel?: (row: T) => string
}

export default function AdaptiveDataTable<T>(props: AdaptiveDataTableProps<T>) {
  const {
    rows,
    columns,
    rowKey,
    pageSize = 20,
    searchPlaceholder = "Cari data...",
    emptyMessage = "Belum ada data.",
    mobileCardTitle,
    mobileCardSubtitle,
    onRowClick,
    rowAriaLabel
  } = props

  const {
    query,
    setQuery,
    visibleRows,
    filteredRows,
    loadedPages,
    totalPages,
    hasMore,
    isLoadingMore,
    loadMore,
    loadPrevious,
    resetToFirstPage,
    sentinelRef
  } = useAdaptiveDataTable({
    rows,
    columns,
    rowKey,
    pageSize
  })

  const hasRows = filteredRows.length > 0

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              resetToFirstPage()
            }}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300/70"
          />
        </div>
        <p className="text-xs text-slate-400">
          Tampil {visibleRows.length}/{filteredRows.length} data
        </p>
      </div>

      {!hasRows ? (
        <div className="rounded-xl border border-white/10 bg-black/35 p-4 text-sm text-slate-300">
          {emptyMessage}
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-white/10 md:block">
            <table className="min-w-full divide-y divide-white/10 text-xs sm:text-sm">
              <thead className="bg-black/35 text-left text-slate-300">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.id}
                      className={`px-3 py-2 font-medium ${column.desktopHeaderClassName ?? ""}`}
                    >
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-black/20">
                {visibleRows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    className={
                      onRowClick
                        ? "cursor-pointer transition hover:bg-cyan-400/5 focus-visible:bg-cyan-400/10"
                        : undefined
                    }
                    tabIndex={onRowClick ? 0 : undefined}
                    aria-label={onRowClick ? rowAriaLabel?.(row) ?? "Buka detail data" : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={
                      onRowClick
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              onRowClick(row)
                            }
                          }
                        : undefined
                    }
                  >
                    {columns.map((column) => (
                      <td
                        key={`${rowKey(row)}:${column.id}`}
                        className={`px-3 py-2 align-top text-slate-200 ${column.desktopCellClassName ?? ""}`}
                      >
                        {column.desktopCell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
                {isLoadingMore && (
                  <tr>
                    <td colSpan={columns.length} className="px-3 py-4 text-center text-slate-400">
                      Memuat lebih banyak...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {visibleRows.map((row) => (
              <article
                key={rowKey(row)}
                className={`rounded-xl border border-white/10 bg-black/30 p-3 ${
                  onRowClick ? "cursor-pointer transition hover:border-cyan-300/40 hover:bg-cyan-400/5" : ""
                }`}
                tabIndex={onRowClick ? 0 : undefined}
                aria-label={onRowClick ? rowAriaLabel?.(row) ?? "Buka detail data" : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          onRowClick(row)
                        }
                      }
                    : undefined
                }
              >
                {(mobileCardTitle || mobileCardSubtitle) && (
                  <header className="mb-2 border-b border-white/10 pb-2">
                    {mobileCardTitle && (
                      <p className="text-sm font-semibold text-slate-100">{mobileCardTitle(row)}</p>
                    )}
                    {mobileCardSubtitle && (
                      <p className="text-xs text-slate-400">{mobileCardSubtitle(row)}</p>
                    )}
                  </header>
                )}

                <div className="space-y-2 text-xs">
                  {columns.map((column) => (
                    <div key={`${rowKey(row)}:mobile:${column.id}`}>
                      <p className="text-slate-400">{column.header}</p>
                      <div className="mt-0.5 text-slate-200">
                        {(column.mobileCell ?? column.desktopCell)(row)}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div ref={sentinelRef} className="h-1 w-full" />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-400">
              Halaman termuat {loadedPages} dari {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={loadPrevious}
                disabled={loadedPages <= 1 || isLoadingMore}
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Sebelumnya
              </button>
              <button
                type="button"
                onClick={loadMore}
                disabled={!hasMore || isLoadingMore}
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoadingMore ? "Memuat..." : hasMore ? "Berikutnya" : "Selesai"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
