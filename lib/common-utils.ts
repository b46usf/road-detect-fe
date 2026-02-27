export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback
}

export function normalizeImageInput(rawImage: string): string {
  const input = rawImage.trim()
  // If not a data URL, still remove any whitespace/newlines introduced
  // during transport which may corrupt base64 payloads.
  if (!input.startsWith("data:")) {
    return input.replace(/\s+/g, "")
  }

  const base64SeparatorIndex = input.indexOf(",")
  if (base64SeparatorIndex === -1) {
    return input.replace(/\s+/g, "")
  }

  // strip header and remove whitespace/newlines from the base64 payload
  return input.slice(base64SeparatorIndex + 1).replace(/\s+/g, "")
}

export function extractMimeFromDataUrl(rawImageInput: string): string | null {
  const input = rawImageInput.trim()
  if (!input.startsWith("data:")) {
    return null
  }

  const end = input.indexOf(";")
  if (end === -1) {
    return null
  }

  const mime = input.slice(5, end).trim()
  return mime.length > 0 ? mime : null
}

export function parseDetectedAt(value: unknown): string {
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString()
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString()
  }

  return new Date().toISOString()
}

export function parseLocation(value: unknown) {
  if (!value || typeof value !== "object") {
    return null
  }

  const source = value as Record<string, unknown>
  const latitude = toFiniteNumber(source.latitude ?? source.lat)
  const longitude = toFiniteNumber(source.longitude ?? source.lng ?? source.lon)

  if (latitude === null || longitude === null) {
    return null
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null
  }

  const rawTimestamp = source.timestamp
  const timestamp =
    typeof rawTimestamp === "string" && rawTimestamp.trim().length > 0
      ? parseDetectedAt(rawTimestamp)
      : typeof rawTimestamp === "number" && Number.isFinite(rawTimestamp)
        ? new Date(rawTimestamp).toISOString()
        : null

  const sourceLabel = readString(source.source ?? source.provider) || "gps"

  return {
    latitude,
    longitude,
    accuracy: toFiniteNumber(source.accuracy),
    altitude: toFiniteNumber(source.altitude),
    heading: toFiniteNumber(source.heading),
    speed: toFiniteNumber(source.speed),
    timestamp,
    source: sourceLabel
  }
}
