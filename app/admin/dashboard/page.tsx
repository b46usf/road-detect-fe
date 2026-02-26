"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import AdminGisMapPanel from "@/components/admin/gis-map-panel"
import {
  clearAdminSession,
  clearDetectionHistory,
  getDefaultGisMapSettings,
  readAdminSession,
  readDetectionHistory,
  readGisMapSettings,
  writeGisMapSettings,
  type AdminSession,
  type GisMapSettings,
  type StoredDetectionRecord
} from "@/lib/admin-storage"
import { formatPercent, severityLabel, severityTone, boolLabel } from "@/lib/ui-utils"

// formatPercent, severityLabel, severityTone, boolLabel moved to lib/ui-utils

export default function AdminDashboardPage() {
  const router = useRouter()
  const [session, setSession] = useState<AdminSession | null>(null)
  const [records, setRecords] = useState<StoredDetectionRecord[]>([])
  const [ready, setReady] = useState(false)
  const [gisSettings, setGisSettings] = useState<GisMapSettings>(getDefaultGisMapSettings())
  const [gisDraft, setGisDraft] = useState<GisMapSettings>(getDefaultGisMapSettings())
  const [gisSaveStatus, setGisSaveStatus] = useState<string | null>(null)

  const loadData = useCallback(() => {
    const currentSession = readAdminSession()
    if (!currentSession) {
      router.replace("/admin/login")
      return
    }

    const loadedRecords = readDetectionHistory()
    const loadedGisSettings = readGisMapSettings()

    setSession(currentSession)
    setRecords(loadedRecords)
    setGisSettings(loadedGisSettings)
    setGisDraft(loadedGisSettings)
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

  const updateGisDraft = useCallback(function updateGisDraft<K extends keyof GisMapSettings>(
    key: K,
    value: GisMapSettings[K]
  ) {
    setGisDraft((previous) => ({
      ...previous,
      [key]: value
    }))
  }, [])

  const applyGisSettings = () => {
    const nextSettings: GisMapSettings = {
      ...gisDraft,
      indonesiaGeoJsonUrl: gisDraft.indonesiaGeoJsonUrl.trim() || "/geo/indonesia-simplified.geojson",
      wmsUrl: gisDraft.wmsUrl.trim(),
      wmsLayers: gisDraft.wmsLayers.trim(),
      wmsFormat: gisDraft.wmsFormat.trim() || "image/png",
      wfsUrl: gisDraft.wfsUrl.trim()
    }

    const saved = writeGisMapSettings(nextSettings)
    if (!saved.ok) {
      setGisSaveStatus(saved.message)
      return
    }

    setGisSettings(nextSettings)
    setGisSaveStatus(`Konfigurasi GIS tersimpan (${new Date().toLocaleTimeString("id-ID")}).`)
  }

  const resetGisSettings = () => {
    const defaults = getDefaultGisMapSettings()
    setGisDraft(defaults)
    setGisSettings(defaults)
    writeGisMapSettings(defaults)
    setGisSaveStatus("Konfigurasi GIS dikembalikan ke default.")
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
              <h1 className="mt-1 text-2xl font-semibold">Monitoring Riwayat Deteksi + GIS</h1>
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

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-semibold sm:text-base">Konfigurasi GIS Formal</h2>
              <p className="text-xs text-slate-400">
                Leaflet + CRS + layer WMS/WFS + pipeline Indonesia GeoJSON + penyimpanan spasial PostGIS-like.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full border border-white/15 bg-black/30 px-2 py-1">
                Deteksi: {boolLabel(gisSettings.showDetectionPoints)}
              </span>
              <span className="rounded-full border border-white/15 bg-black/30 px-2 py-1">
                Indonesia: {boolLabel(gisSettings.showIndonesiaBoundary)}
              </span>
              <span className="rounded-full border border-white/15 bg-black/30 px-2 py-1">
                WMS: {boolLabel(gisSettings.wmsEnabled)}
              </span>
              <span className="rounded-full border border-white/15 bg-black/30 px-2 py-1">
                WFS: {boolLabel(gisSettings.wfsEnabled)}
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-300">CRS</span>
              <select
                value={gisDraft.crs}
                onChange={(event) => updateGisDraft("crs", event.target.value as GisMapSettings["crs"])}
                className="w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300/70"
              >
                <option value="EPSG:3857">EPSG:3857 (Web Mercator)</option>
                <option value="EPSG:4326">EPSG:4326 (Geographic)</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-slate-300">Indonesia GeoJSON URL</span>
              <input
                value={gisDraft.indonesiaGeoJsonUrl}
                onChange={(event) => updateGisDraft("indonesiaGeoJsonUrl", event.target.value)}
                placeholder="/geo/indonesia-simplified.geojson"
                className="w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300/70"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-slate-300">WMS URL</span>
              <input
                value={gisDraft.wmsUrl}
                onChange={(event) => updateGisDraft("wmsUrl", event.target.value)}
                placeholder="https://your-geoserver/wms"
                className="w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300/70"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-slate-300">WMS Layer Name</span>
              <input
                value={gisDraft.wmsLayers}
                onChange={(event) => updateGisDraft("wmsLayers", event.target.value)}
                placeholder="road-damage-ai atau workspace/model"
                className="w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300/70"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-slate-300">WMS Format</span>
              <input
                value={gisDraft.wmsFormat}
                onChange={(event) => updateGisDraft("wmsFormat", event.target.value)}
                placeholder="image/png"
                className="w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300/70"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-slate-300">WFS URL</span>
              <input
                value={gisDraft.wfsUrl}
                onChange={(event) => updateGisDraft("wfsUrl", event.target.value)}
                placeholder="https://your-geoserver/wfs?typename=..."
                className="w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300/70"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-slate-200">
              <input
                type="checkbox"
                checked={gisDraft.showDetectionPoints}
                onChange={(event) => updateGisDraft("showDetectionPoints", event.target.checked)}
              />
              Tampilkan titik deteksi
            </label>
            <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-slate-200">
              <input
                type="checkbox"
                checked={gisDraft.showIndonesiaBoundary}
                onChange={(event) => updateGisDraft("showIndonesiaBoundary", event.target.checked)}
              />
              Tampilkan boundary Indonesia
            </label>
            <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-slate-200">
              <input
                type="checkbox"
                checked={gisDraft.wmsEnabled}
                onChange={(event) => updateGisDraft("wmsEnabled", event.target.checked)}
              />
              Aktifkan layer WMS
            </label>
            <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-slate-200">
              <input
                type="checkbox"
                checked={gisDraft.wmsTransparent}
                onChange={(event) => updateGisDraft("wmsTransparent", event.target.checked)}
              />
              WMS transparan
            </label>
            <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-slate-200">
              <input
                type="checkbox"
                checked={gisDraft.wfsEnabled}
                onChange={(event) => updateGisDraft("wfsEnabled", event.target.checked)}
              />
              Aktifkan layer WFS
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={applyGisSettings}
              className="rounded-lg bg-cyan-300 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Terapkan Konfigurasi GIS
            </button>
            <button
              type="button"
              onClick={resetGisSettings}
              className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-xs font-medium transition hover:bg-white/10"
            >
              Reset Default GIS
            </button>
          </div>

          {gisSaveStatus && (
            <p className="mt-2 text-xs text-cyan-300">{gisSaveStatus}</p>
          )}
        </section>

        <AdminGisMapPanel records={records} settings={gisSettings} />

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
                    <th className="px-3 py-2 font-medium">PostGIS (EWKT)</th>
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
                        {item.spatial ? (
                          <>
                            <p className="break-all font-mono text-[11px]">{item.spatial.postgis.ewkt}</p>
                            <p className="text-[11px] text-slate-400">CRS {item.spatial.sourceCrs}</p>
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
