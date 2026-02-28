"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import lazyWithSkeleton from "@/components/ui/lazyWithSkeleton"
import DashboardHeader from "@/components/admin/dashboard/dashboard-header"
import GisSettingsPanel from "@/components/admin/dashboard/gis-settings-panel"
import DetectionHistoryPanel from "@/components/admin/dashboard/detection-history-panel"
import {
  clearAdminSession,
  clearDetectionHistory,
  getDefaultGisMapSettings,
  readAdminSession,
  readDetectionHistory,
  readGisMapSettings,
  readRoboflowAdminStats,
  type AdminSession,
  type GisMapSettings,
  type RoboflowAdminPersist,
  type StoredDetectionRecord,
  updateRoboflowAdminStats,
  writeGisMapSettings
} from "@/lib/admin-storage"
import { confirmRoadsterAction } from "@/lib/ui/roadster-swal"

const AdminGisMapPanel = lazyWithSkeleton(() => import("@/components/admin/gis-map-panel"), {
  height: 320
})

function calculateStats(records: StoredDetectionRecord[]) {
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
}

export default function AdminDashboardPage() {
  const router = useRouter()

  const [session, setSession] = useState<AdminSession | null>(null)
  const [allRecords, setAllRecords] = useState<StoredDetectionRecord[]>([])
  const [ready, setReady] = useState(false)

  const [rfStats, setRfStats] = useState<{ invalidCount: number; lastInvalidAt?: number } | null>(null)

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
    setAllRecords(loadedRecords)
    setGisSettings(loadedGisSettings)
    setGisDraft(loadedGisSettings)
    setReady(true)
  }, [router])

  const fetchRfStats = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/roboflow-stats", { cache: "no-store" })
      if (!response.ok) {
        const persisted = readRoboflowAdminStats()
        setRfStats(persisted?.stats ?? null)
        return
      }

      const json: unknown = await response.json()
      const payload = json && typeof json === "object" ? (json as Record<string, unknown>) : null
      if (payload?.ok !== true) {
        return
      }

      setRfStats((payload.stats as { invalidCount: number; lastInvalidAt?: number } | null) ?? null)

      try {
        updateRoboflowAdminStats(
          () =>
            ({
              stats: payload.stats ?? null,
              cache: payload.cache ?? null,
              updatedAt: new Date().toISOString()
            }) as RoboflowAdminPersist
        )
      } catch {
        // ignore client persistence failures
      }
    } catch {
      const persisted = readRoboflowAdminStats()
      setRfStats(persisted?.stats ?? null)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadData()
      void fetchRfStats()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [fetchRfStats, loadData])

  useEffect(() => {
    const handleStorage = () => {
      loadData()
    }

    window.addEventListener("storage", handleStorage)
    return () => {
      window.removeEventListener("storage", handleStorage)
    }
  }, [loadData])

  const stats = useMemo(() => calculateStats(allRecords), [allRecords])

  const handleLogout = useCallback(() => {
    clearAdminSession()
    router.replace("/admin/login")
  }, [router])

  const handleClearHistory = useCallback(async () => {
    const confirmed = await confirmRoadsterAction({
      title: "Hapus seluruh riwayat deteksi?",
      text: "Data riwayat lokal di browser ini akan dihapus permanen dan tidak bisa dikembalikan.",
      confirmButtonText: "Ya, Hapus"
    })
    if (!confirmed) {
      return
    }

    clearDetectionHistory()
    setAllRecords([])
  }, [])

  const updateGisDraft = useCallback(
    (key: keyof GisMapSettings, value: GisMapSettings[keyof GisMapSettings]) => {
      setGisDraft((previous) => ({
        ...previous,
        [key]: value
      }))
    },
    []
  )

  const applyGisSettings = useCallback(() => {
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
  }, [gisDraft])

  const resetGisSettings = useCallback(async () => {
    const confirmed = await confirmRoadsterAction({
      title: "Reset konfigurasi GIS ke default?",
      text: "Pengaturan CRS, layer WMS/WFS, dan boundary akan kembali ke konfigurasi bawaan.",
      confirmButtonText: "Ya, Reset"
    })
    if (!confirmed) {
      return
    }

    const defaults = getDefaultGisMapSettings()
    setGisDraft(defaults)
    setGisSettings(defaults)
    writeGisMapSettings(defaults)
    setGisSaveStatus("Konfigurasi GIS dikembalikan ke default.")
  }, [])

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
        <DashboardHeader
          username={session?.username}
          stats={stats}
          rfStats={rfStats}
          onRefresh={loadData}
          onClearHistory={handleClearHistory}
          onLogout={handleLogout}
        />

        <GisSettingsPanel
          settings={gisSettings}
          draft={gisDraft}
          saveStatus={gisSaveStatus}
          onDraftChange={updateGisDraft}
          onApply={applyGisSettings}
          onReset={resetGisSettings}
        />

        <AdminGisMapPanel records={allRecords} settings={gisSettings} />

        <DetectionHistoryPanel records={allRecords} />
      </section>
    </main>
  )
}
