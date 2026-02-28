import { useEffect, type MutableRefObject } from "react"
import {
  readWfsGeoJsonCache,
  writeWfsGeoJsonCache,
  type GisMapSettings
} from "@/lib/admin-storage"
import { countGeoJsonFeatures, isGeoJsonLike } from "@/lib/gis-pipeline"
import {
  buildWfsRequestUrl,
  removeLayer,
  type LeafletLayerState,
  type LeafletModule
} from "@/components/admin/gis-map-layer-shared"

interface UseGisWfsLayerEffectArgs {
  mapReady: boolean
  settings: GisMapSettings
  mapRef: MutableRefObject<import("leaflet").Map | null>
  leafletRef: MutableRefObject<LeafletModule | null>
  layersRef: MutableRefObject<LeafletLayerState>
  setWfsStatus: (value: string) => void
}

export function useGisWfsLayerEffect(args: UseGisWfsLayerEffectArgs) {
  const { mapReady, settings, mapRef, leafletRef, layersRef, setWfsStatus } = args

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
  }, [layersRef, leafletRef, mapReady, mapRef, setWfsStatus, settings.wfsEnabled, settings.wfsUrl])
}
