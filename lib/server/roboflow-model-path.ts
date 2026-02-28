function splitModelIdSegments(rawModelId: string): string[] {
  const normalized = rawModelId
    .trim()
    .replace(/^https?:\/\/detect\.roboflow\.com\//i, "")
    .replace(/^\/+|\/+$/g, "")

  if (!normalized) {
    return []
  }

  return normalized
    .split("/")
    .map((segment) => {
      const cleaned = segment.trim()
      if (!cleaned) {
        return ""
      }

      try {
        return decodeURIComponent(cleaned).trim()
      } catch {
        return cleaned
      }
    })
    .filter((segment) => segment.length > 0)
}

export function buildRoboflowPath(
  modelId: string,
  modelVersion: string
): { path: string; normalizedModelId: string } | null {
  const normalizedVersion = modelVersion.trim()
  if (!normalizedVersion) {
    return null
  }

  const segments = splitModelIdSegments(modelId)
  if (segments.length === 0) {
    return null
  }

  const lastSegment = segments[segments.length - 1]
  if (lastSegment === normalizedVersion) {
    segments.pop()
  }

  if (segments.length === 0) {
    return null
  }

  const encodedPath = [...segments.map((segment) => encodeURIComponent(segment)), encodeURIComponent(normalizedVersion)].join("/")
  return {
    path: encodedPath,
    normalizedModelId: segments.join("/")
  }
}
