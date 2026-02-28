"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { type GisMapSettings, type StoredDetectionRecord } from "@/lib/admin-storage"
import { buildDetectionFeatureCollection } from "@/lib/gis-pipeline"
import {
  useGisMapLayerEffects
} from "@/components/admin/gis-map-layer-effects"
import { type LeafletLayerState, type LeafletModule } from "@/components/admin/gis-map-layer-shared"

interface AdminGisMapPanelProps {
  records: StoredDetectionRecord[]
  settings: GisMapSettings
}

const MAP_DEFAULT_CENTER: [number, number] = [-2.6, 118.0]
const MAP_DEFAULT_ZOOM = 5

export default function AdminGisMapPanel(props: AdminGisMapPanelProps) {
  const { records, settings } = props

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const leafletRef = useRef<LeafletModule | null>(null)
  const mapRef = useRef<import("leaflet").Map | null>(null)
  const layersRef = useRef<LeafletLayerState>({})
  const autoFitRef = useRef(false)

  const [mapReady, setMapReady] = useState(false)
  const [baseStatus, setBaseStatus] = useState("Map belum dimuat.")
  const [indonesiaStatus, setIndonesiaStatus] = useState("Boundary Indonesia belum dimuat.")
  const [wmsStatus, setWmsStatus] = useState("WMS nonaktif.")
  const [wfsStatus, setWfsStatus] = useState("WFS nonaktif.")

  const detectionGeoJson = useMemo(() => buildDetectionFeatureCollection(records), [records])

  useEffect(() => {
    let cancelled = false

    const initializeMap = async () => {
      if (!mapContainerRef.current) {
        return
      }

      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        layersRef.current = {}
      }

      const L = await import("leaflet")
      if (cancelled || !mapContainerRef.current) {
        return
      }

      const crs = settings.crs === "EPSG:4326" ? L.CRS.EPSG4326 : L.CRS.EPSG3857
      const map = L.map(mapContainerRef.current, {
        center: MAP_DEFAULT_CENTER,
        zoom: MAP_DEFAULT_ZOOM,
        crs,
        preferCanvas: true,
        zoomControl: true
      })

      const baseLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      })

      baseLayer.addTo(map)
      leafletRef.current = L
      mapRef.current = map
      layersRef.current.base = baseLayer
      autoFitRef.current = false
      setMapReady(true)
      setBaseStatus(`Map aktif dengan CRS ${settings.crs}.`)
    }

    void initializeMap()

    return () => {
      cancelled = true
      setMapReady(false)
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      layersRef.current = {}
    }
  }, [settings.crs])

  useGisMapLayerEffects({
    mapReady,
    settings,
    detectionGeoJson,
    mapRef,
    leafletRef,
    layersRef,
    autoFitRef,
    setBaseStatus,
    setIndonesiaStatus,
    setWmsStatus,
    setWfsStatus
  })

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold sm:text-base">GIS Layer Map (Leaflet)</h2>
          <p className="text-xs text-slate-400">
            Pipeline: {detectionGeoJson.features.length} titik deteksi siap dipetakan.
          </p>
        </div>
        <span className="rounded-full border border-cyan-300/35 bg-cyan-400/15 px-3 py-1 text-[11px] font-medium text-cyan-100">
          CRS {settings.crs}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900">
        <div ref={mapContainerRef} className="h-[360px] w-full sm:h-[460px]" />
      </div>

      <div className="mt-3 grid gap-2 text-[11px] text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
        <p className="rounded-lg border border-white/10 bg-black/30 px-2 py-1">Map: {baseStatus}</p>
        <p className="rounded-lg border border-white/10 bg-black/30 px-2 py-1">
          Indonesia: {indonesiaStatus}
        </p>
        <p className="rounded-lg border border-white/10 bg-black/30 px-2 py-1">WMS: {wmsStatus}</p>
        <p className="rounded-lg border border-white/10 bg-black/30 px-2 py-1">WFS: {wfsStatus}</p>
      </div>
    </section>
  )
}
