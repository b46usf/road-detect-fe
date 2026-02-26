"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  readIndonesiaGeoJsonCache,
  readWfsGeoJsonCache,
  writeIndonesiaGeoJsonCache,
  writeWfsGeoJsonCache,
  type GisMapSettings,
  type StoredDetectionRecord
} from "@/lib/admin-storage"
import {
  buildDetectionFeatureCollection,
  countGeoJsonFeatures,
  INDONESIA_FALLBACK_GEOJSON,
  isGeoJsonLike
} from "@/lib/gis-pipeline"

interface AdminGisMapPanelProps {
  records: StoredDetectionRecord[]
  settings: GisMapSettings
}

type LeafletModule = typeof import("leaflet")

interface LeafletLayerState {
  base?: import("leaflet").TileLayer
  detection?: import("leaflet").GeoJSON
  indonesia?: import("leaflet").GeoJSON
  wms?: import("leaflet").TileLayer.WMS
  wfs?: import("leaflet").GeoJSON
}

const MAP_DEFAULT_CENTER: [number, number] = [-2.6, 118.0]
const MAP_DEFAULT_ZOOM = 5

function severityColor(severity: string): string {
  if (severity === "berat") {
    return "#fb7185"
  }

  if (severity === "sedang") {
    return "#fbbf24"
  }

  if (severity === "ringan") {
    return "#34d399"
  }

  return "#94a3b8"
}

function removeLayer(
  map: import("leaflet").Map | null,
  layer: import("leaflet").Layer | undefined
) {
  if (map && layer && map.hasLayer(layer)) {
    map.removeLayer(layer)
  }
}

function buildWfsRequestUrl(rawUrl: string): string {
  const input = rawUrl.trim()
  if (input.length === 0) {
    return ""
  }

  try {
    const url = new URL(input)
    if (!url.searchParams.has("service")) {
      url.searchParams.set("service", "WFS")
    }
    if (!url.searchParams.has("request")) {
      url.searchParams.set("request", "GetFeature")
    }
    if (!url.searchParams.has("outputFormat")) {
      url.searchParams.set("outputFormat", "application/json")
    }
    if (!url.searchParams.has("srsName")) {
      url.searchParams.set("srsName", "EPSG:4326")
    }
    return url.toString()
  } catch {
    return input
  }
}

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

  const detectionGeoJson = useMemo(
    () => buildDetectionFeatureCollection(records),
    [records]
  )

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

  useEffect(() => {
    const map = mapRef.current
    const L = leafletRef.current
    if (!map || !L || !mapReady) {
      return
    }

    removeLayer(map, layersRef.current.detection)
    layersRef.current.detection = undefined

    if (!settings.showDetectionPoints) {
      setBaseStatus(`Titik deteksi disembunyikan. CRS ${settings.crs}.`)
      return
    }

    if (detectionGeoJson.features.length === 0) {
      setBaseStatus(`Tidak ada titik deteksi GPS. CRS ${settings.crs}.`)
      return
    }

    const detectionLayer = L.geoJSON(detectionGeoJson as never, {
      pointToLayer: (feature, latlng) => {
        const source = feature as unknown as { properties?: { tingkatKerusakan?: string } }
        const severity = source.properties?.tingkatKerusakan ?? "tidak-terdeteksi"
        return L.circleMarker(latlng, {
          radius: 6,
          color: severityColor(severity),
          fillColor: severityColor(severity),
          fillOpacity: 0.65,
          weight: 1.5
        })
      },
      onEachFeature: (feature, layer) => {
        const source = feature as unknown as {
          properties?: {
            id?: string
            tingkatKerusakan?: string
            luasanKerusakanPercent?: number
            dominantClass?: string | null
            waktuDeteksi?: string
          }
        }

        const properties = source.properties
        const severity = properties?.tingkatKerusakan ?? "tidak-terdeteksi"
        const luasanValue =
          typeof properties?.luasanKerusakanPercent === "number"
            ? properties.luasanKerusakanPercent
            : null
        const luasan = luasanValue !== null ? `${luasanValue.toFixed(1)}%` : "n/a"

        layer.bindPopup(
          [
            `<b>Deteksi #${properties?.id ?? "-"}</b>`,
            `Severity: ${severity}`,
            `Luasan: ${luasan}`,
            `Kelas Dominan: ${properties?.dominantClass ?? "n/a"}`,
            `Waktu: ${properties?.waktuDeteksi ? new Date(properties.waktuDeteksi).toLocaleString("id-ID") : "n/a"}`
          ].join("<br/>")
        )
      }
    })

    detectionLayer.addTo(map)
    layersRef.current.detection = detectionLayer

    if (!autoFitRef.current) {
      const bounds = detectionLayer.getBounds()
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [20, 20], maxZoom: 16 })
        autoFitRef.current = true
      }
    }

    setBaseStatus(
      `Layer deteksi aktif (${detectionGeoJson.features.length} titik) pada CRS ${settings.crs}.`
    )
  }, [detectionGeoJson, mapReady, settings.crs, settings.showDetectionPoints])

  useEffect(() => {
    let cancelled = false

    const map = mapRef.current
    const L = leafletRef.current
    if (!map || !L || !mapReady) {
      return
    }

    const applyBoundaryLayer = (geojsonObject: unknown) => {
      removeLayer(map, layersRef.current.indonesia)
      layersRef.current.indonesia = undefined

      const boundaryLayer = L.geoJSON(geojsonObject as never, {
        style: {
          color: "#60a5fa",
          weight: 1.4,
          fillColor: "#38bdf8",
          fillOpacity: 0.08
        }
      })

      boundaryLayer.addTo(map)
      layersRef.current.indonesia = boundaryLayer
    }

    const loadBoundary = async () => {
      if (!settings.showIndonesiaBoundary) {
        removeLayer(map, layersRef.current.indonesia)
        layersRef.current.indonesia = undefined
        setIndonesiaStatus("Boundary Indonesia dimatikan.")
        return
      }

      const sourceUrl = settings.indonesiaGeoJsonUrl.trim() || "/geo/indonesia-simplified.geojson"
      setIndonesiaStatus(`Memuat boundary dari ${sourceUrl}...`)

      try {
        const response = await fetch(sourceUrl, { cache: "no-store" })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const responseJson: unknown = await response.json()
        if (!isGeoJsonLike(responseJson)) {
          throw new Error("Payload bukan GeoJSON valid.")
        }

        if (cancelled) {
          return
        }

        applyBoundaryLayer(responseJson)
        writeIndonesiaGeoJsonCache({
          sourceUrl,
          fetchedAt: new Date().toISOString(),
          data: responseJson
        })
        setIndonesiaStatus(`Boundary Indonesia aktif (${sourceUrl}).`)
      } catch {
        const cached = readIndonesiaGeoJsonCache()
        if (cached && isGeoJsonLike(cached.data)) {
          applyBoundaryLayer(cached.data)
          setIndonesiaStatus(
            `Boundary dari cache lokal (${new Date(cached.fetchedAt).toLocaleString("id-ID")}).`
          )
          return
        }

        applyBoundaryLayer(INDONESIA_FALLBACK_GEOJSON)
        setIndonesiaStatus("Boundary fallback lokal aktif.")
      }
    }

    void loadBoundary()

    return () => {
      cancelled = true
    }
  }, [mapReady, settings.indonesiaGeoJsonUrl, settings.showIndonesiaBoundary])

  useEffect(() => {
    const map = mapRef.current
    const L = leafletRef.current
    if (!map || !L || !mapReady) {
      return
    }

    removeLayer(map, layersRef.current.wms)
    layersRef.current.wms = undefined

    if (!settings.wmsEnabled) {
      setWmsStatus("WMS nonaktif.")
      return
    }

    if (!settings.wmsUrl.trim() || !settings.wmsLayers.trim()) {
      setWmsStatus("WMS aktif tapi URL/layer belum lengkap.")
      return
    }

    try {
      const layer = L.tileLayer.wms(settings.wmsUrl.trim(), {
        layers: settings.wmsLayers.trim(),
        format: settings.wmsFormat.trim() || "image/png",
        transparent: settings.wmsTransparent
      })

      layer.addTo(map)
      layersRef.current.wms = layer
      setWmsStatus(`WMS aktif: ${settings.wmsLayers.trim()}`)
    } catch {
      setWmsStatus("Gagal memuat layer WMS.")
    }
  }, [
    mapReady,
    settings.wmsEnabled,
    settings.wmsFormat,
    settings.wmsLayers,
    settings.wmsTransparent,
    settings.wmsUrl
  ])

  useEffect(() => {
    let cancelled = false

    const map = mapRef.current
    const L = leafletRef.current
    if (!map || !L || !mapReady) {
      return
    }

    const applyWfsLayer = (geojsonObject: unknown, featureCount: number) => {
      removeLayer(map, layersRef.current.wfs)
      layersRef.current.wfs = undefined

      const layer = L.geoJSON(geojsonObject as never, {
        style: {
          color: "#c084fc",
          weight: 1.2,
          fillColor: "#c084fc",
          fillOpacity: 0.12
        },
        pointToLayer: (_feature, latlng) =>
          L.circleMarker(latlng, {
            radius: 5,
            color: "#c084fc",
            fillColor: "#d8b4fe",
            fillOpacity: 0.55,
            weight: 1
          })
      })

      layer.addTo(map)
      layersRef.current.wfs = layer
      setWfsStatus(`WFS aktif (${featureCount} feature).`)
    }

    const loadWfsLayer = async () => {
      removeLayer(map, layersRef.current.wfs)
      layersRef.current.wfs = undefined

      if (!settings.wfsEnabled) {
        setWfsStatus("WFS nonaktif.")
        return
      }

      if (!settings.wfsUrl.trim()) {
        setWfsStatus("WFS aktif tapi URL belum diisi.")
        return
      }

      const sourceUrl = buildWfsRequestUrl(settings.wfsUrl)
      setWfsStatus(`Memuat WFS: ${sourceUrl}`)

      try {
        const response = await fetch(sourceUrl, { cache: "no-store" })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const responseJson: unknown = await response.json()
        if (!isGeoJsonLike(responseJson)) {
          throw new Error("Payload WFS bukan GeoJSON valid.")
        }

        if (cancelled) {
          return
        }

        const featureCount = countGeoJsonFeatures(responseJson)
        applyWfsLayer(responseJson, featureCount)
        writeWfsGeoJsonCache({
          sourceUrl,
          fetchedAt: new Date().toISOString(),
          data: responseJson
        })
      } catch {
        const cached = readWfsGeoJsonCache()
        if (cached && isGeoJsonLike(cached.data)) {
          const featureCount = countGeoJsonFeatures(cached.data)
          applyWfsLayer(cached.data, featureCount)
          setWfsStatus(
            `WFS dari cache (${new Date(cached.fetchedAt).toLocaleString("id-ID")}) (${featureCount} feature).`
          )
          return
        }

        setWfsStatus("Gagal memuat WFS (cek URL/CORS/outputFormat).")
      }
    }

    void loadWfsLayer()

    return () => {
      cancelled = true
    }
  }, [mapReady, settings.wfsEnabled, settings.wfsUrl])

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
