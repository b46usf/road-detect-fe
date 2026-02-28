export type LeafletModule = typeof import("leaflet")

export interface LeafletLayerState {
  base?: import("leaflet").TileLayer
  detection?: import("leaflet").GeoJSON
  indonesia?: import("leaflet").GeoJSON
  wms?: import("leaflet").TileLayer.WMS
  wfs?: import("leaflet").GeoJSON
}

export function severityColor(severity: string): string {
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

export function removeLayer(
  map: import("leaflet").Map | null,
  layer: import("leaflet").Layer | undefined
) {
  if (map && layer && map.hasLayer(layer)) {
    map.removeLayer(layer)
  }
}

export function buildWfsRequestUrl(rawUrl: string): string {
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
