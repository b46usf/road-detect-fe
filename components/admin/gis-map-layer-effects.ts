import { useEffect, type MutableRefObject } from "react"
import {
  readIndonesiaGeoJsonCache,
  writeIndonesiaGeoJsonCache,
  type GisMapSettings
} from "@/lib/admin-storage"
import {
  INDONESIA_FALLBACK_GEOJSON,
  isGeoJsonLike,
  type DetectionFeatureCollection
} from "@/lib/gis-pipeline"
import {
  removeLayer,
  severityColor,
  type LeafletLayerState,
  type LeafletModule
} from "@/components/admin/gis-map-layer-shared"
import { useGisWfsLayerEffect } from "@/components/admin/use-gis-wfs-layer-effect"

interface UseGisMapLayerEffectsArgs {
  mapReady: boolean
  settings: GisMapSettings
  detectionGeoJson: DetectionFeatureCollection
  mapRef: MutableRefObject<import("leaflet").Map | null>
  leafletRef: MutableRefObject<LeafletModule | null>
  layersRef: MutableRefObject<LeafletLayerState>
  autoFitRef: MutableRefObject<boolean>
  setBaseStatus: (value: string) => void
  setIndonesiaStatus: (value: string) => void
  setWmsStatus: (value: string) => void
  setWfsStatus: (value: string) => void
}

export function useGisMapLayerEffects(args: UseGisMapLayerEffectsArgs) {
  const {
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
  } = args

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
  }, [
    autoFitRef,
    detectionGeoJson,
    layersRef,
    leafletRef,
    mapReady,
    mapRef,
    setBaseStatus,
    settings.crs,
    settings.showDetectionPoints
  ])

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
  }, [
    layersRef,
    leafletRef,
    mapReady,
    mapRef,
    setIndonesiaStatus,
    settings.indonesiaGeoJsonUrl,
    settings.showIndonesiaBoundary
  ])

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
    layersRef,
    leafletRef,
    mapReady,
    mapRef,
    setWmsStatus,
    settings.wmsEnabled,
    settings.wmsFormat,
    settings.wmsLayers,
    settings.wmsTransparent,
    settings.wmsUrl
  ])

  useGisWfsLayerEffect({
    mapReady,
    settings,
    mapRef,
    leafletRef,
    layersRef,
    setWfsStatus
  })
}
