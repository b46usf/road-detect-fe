"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  clearAdminSession,
  clearDetectionHistory,
  readAdminSession,
  readDetectionHistory,
  type AdminSession,
  type StoredDetectionRecord
} from "@/lib/admin-storage"

function formatPercent(value: number): string {
  return `${Math.max(0, Math.min(100, value)).toFixed(1)}%`
}

function severityLabel(value: StoredDetectionRecord["tingkatKerusakan"]): string {
  if (value === "ringan") {
    return "Ringan"
  }

  if (value === "sedang") {
    return "Sedang"
  }

  if (value === "berat") {
    return "Berat"
  }

  return "Tidak Terdeteksi"
}

function severityTone(value: StoredDetectionRecord["tingkatKerusakan"]): string {
  if (value === "berat") {
    return "border-rose-300/45 bg-rose-400/15 text-rose-100"
  }

  if (value === "sedang") {
    return "border-amber-300/45 bg-amber-400/15 text-amber-100"
  }

  if (value === "ringan") {
    return "border-emerald-300/45 bg-emerald-400/15 text-emerald-100"
  }

  return "border-slate-300/35 bg-slate-300/10 text-slate-200"
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const [session, setSession] = useState<AdminSession | null>(null)
  const [records, setRecords] = useState<StoredDetectionRecord[]>([])
  const [ready, setReady] = useState(false)

  const loadData = useCallback(() => {
    const currentSession = readAdminSession()
    if (!currentSession) {
      router.replace("/admin/login")
      return
    }

    setSession(currentSession)
    setRecords(readDetectionHistory())
    setReady(true)
  }, [router])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const handleStorage = () => {
      loadData()
    }

    window.addEventListener("storage", handleStorage)
    return () => {
      window.removeEventListener("storage", handleStorage)
    }
  }, [loadData])

  const stats = useMemo(() => {
    if (records.length === 0) {
      return {
        total: 0,
        avgDamage: 0,
        heavyCount: 0,
        withGps: 0
      }
    }

    const avgDamage =
      records.reduce((sum, item) => sum + item.luasanKerusakanPercent, 0) / records.length
    const heavyCount = records.filter((item) => item.tingkatKerusakan === "berat").length
    const withGps = records.filter((item) => item.lokasi !== null).length

    return {
      total: records.length,
      avgDamage,
      heavyCount,
      withGps
    }
  }, [records])

  const handleLogout = () => {
    clearAdminSession()
    router.replace("/admin/login")
  }

  const handleClearHistory = () => {
    clearDetectionHistory()
    setRecords([])
  }

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-slate-100 [font-family:var(--font-geist-sans)]">
        <p className="text-sm text-slate-300">Memuat dashboard admin...</p>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100 [font-family:var(--font-geist-sans)]">
      <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6">
        <header className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/90">Admin Dashboard</p>
              <h1 className="mt-1 text-2xl font-semibold">Monitoring Riwayat Deteksi</h1>
              <p className="mt-2 text-sm text-slate-300">
                Login aktif: <span className="font-medium text-slate-100">{session?.username}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={loadData}
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-medium transition hover:bg-white/10"
              >
                Refresh Data
              </button>
              <button
                type="button"
                onClick={handleClearHistory}
                className="rounded-lg border border-rose-300/40 bg-rose-400/15 px-3 py-2 text-xs font-medium text-rose-100 transition hover:bg-rose-400/25"
              >
                Hapus Riwayat
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-xl border border-white/10 bg-black/35 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Total Record</p>
              <p className="mt-1 text-xl font-semibold">{stats.total}</p>
            </article>
            <article className="rounded-xl border border-white/10 bg-black/35 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Rata Luasan</p>
              <p className="mt-1 text-xl font-semibold">{formatPercent(stats.avgDamage)}</p>
            </article>
            <article className="rounded-xl border border-white/10 bg-black/35 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Kasus Berat</p>
              <p className="mt-1 text-xl font-semibold">{stats.heavyCount}</p>
            </article>
            <article className="rounded-xl border border-white/10 bg-black/35 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Data Dengan GPS</p>
              <p className="mt-1 text-xl font-semibold">{stats.withGps}</p>
            </article>
          </div>
        </header>

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

          {records.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-black/35 p-4 text-sm text-slate-300">
              Belum ada data tersimpan. Jalankan deteksi di halaman kamera untuk mulai mengisi riwayat.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="min-w-full divide-y divide-white/10 text-xs sm:text-sm">
                <thead className="bg-black/35 text-left text-slate-300">
                  <tr>
                    <th className="px-3 py-2 font-medium">Waktu</th>
                    <th className="px-3 py-2 font-medium">Severity</th>
                    <th className="px-3 py-2 font-medium">Luasan</th>
                    <th className="px-3 py-2 font-medium">Multi-class</th>
                    <th className="px-3 py-2 font-medium">Lokasi</th>
                    <th className="px-3 py-2 font-medium">Model</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-black/20">
                  {records.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 align-top text-slate-200">
                        <p>{new Date(item.waktuDeteksi).toLocaleString("id-ID")}</p>
                        <p className="text-[11px] text-slate-400">
                          Simpan: {new Date(item.createdAt).toLocaleTimeString("id-ID")}
                        </p>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span
                          className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium ${severityTone(item.tingkatKerusakan)}`}
                        >
                          {severityLabel(item.tingkatKerusakan)}
                        </span>
                        <p className="mt-1 text-[11px] text-slate-400">
                          total {item.totalDeteksi} deteksi
                        </p>
                      </td>
                      <td className="px-3 py-2 align-top text-slate-200">
                        <p>{formatPercent(item.luasanKerusakanPercent)}</p>
                        <p className="text-[11px] text-slate-400">
                          API: {item.apiDurationMs !== null ? `${Math.round(item.apiDurationMs)} ms` : "n/a"}
                        </p>
                      </td>
                      <td className="px-3 py-2 align-top text-slate-200">
                        <p>{`pothole ${item.classCounts.pothole}, crack ${item.classCounts.crack}, rutting ${item.classCounts.rutting}`}</p>
                        <p className="text-[11px] text-slate-400">
                          dominan: {item.dominantClass ?? "n/a"}
                        </p>
                      </td>
                      <td className="px-3 py-2 align-top text-slate-200">
                        {item.lokasi ? (
                          <>
                            <p>{`${item.lokasi.latitude.toFixed(6)}, ${item.lokasi.longitude.toFixed(6)}`}</p>
                            <p className="text-[11px] text-slate-400">
                              akurasi {item.lokasi.accuracy !== null ? `${Math.round(item.lokasi.accuracy)} m` : "n/a"}
                            </p>
                          </>
                        ) : (
                          <p className="text-slate-400">n/a</p>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-200">
                        <p>{item.modelId}</p>
                        <p className="text-[11px] text-slate-400">v{item.modelVersion}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  )
}
