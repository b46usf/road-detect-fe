export type LeafletModule = typeof import("leaflet")

export interface LeafletLayerState {
  base?: import("leaflet").TileLayer
  detection?: import("leaflet").GeoJSON
  indonesia?: import("leaflet").GeoJSON
  wms?: import("leaflet").TileLayer.WMS
  wfs?: import("leaflet").GeoJSON
}

function severityToneClass(severity: string): string {
  if (severity === "berat") {
    return "road-detect-pin--heavy"
  }

  if (severity === "sedang") {
    return "road-detect-pin--medium"
  }

  if (severity === "ringan") {
    return "road-detect-pin--light"
  }

  return "road-detect-pin--unknown"
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export function buildDetectionPinIcon(
  L: LeafletModule,
  params: {
    severity: string
    label: string
  }
) {
  const { severity, label } = params
  const safeLabel = escapeHtml(label)

  return L.divIcon({
    className: "road-detect-pin-wrapper",
    html: `
      <div class="road-detect-pin ${severityToneClass(severity)}">
        <span class="road-detect-pin__dot"></span>
      </div>
      <span class="road-detect-pin__label">${safeLabel}</span>
    `,
    iconSize: [30, 40],
    iconAnchor: [15, 34],
    tooltipAnchor: [0, -30],
    popupAnchor: [0, -30]
  })
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
