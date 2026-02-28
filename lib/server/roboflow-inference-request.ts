import { extractMimeFromDataUrl, readString } from "@/lib/common-utils"

export function parseOptionalNumber(value: unknown): string | null | "invalid" {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "invalid"
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? String(parsed) : "invalid"
  }

  return "invalid"
}

export function isOriginAllowed(request: Request): boolean {
  const origin = readString(request.headers.get("origin"))
  if (!origin) {
    return true
  }

  const host = readString(request.headers.get("host"))
  if (!host) {
    return false
  }

  try {
    const originUrl = new URL(origin)
    const hostOnly = host.split(":")[0]
    if (originUrl.hostname === hostOnly || originUrl.host === host) {
      return true
    }
  } catch {
    return false
  }

  const rawAllowedOrigins = readString(process.env.ROBOFLOW_ALLOWED_ORIGINS)
  if (!rawAllowedOrigins) {
    return false
  }

  const allowedOrigins = rawAllowedOrigins
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

  return allowedOrigins.includes(origin)
}

export async function forwardInferenceToRoboflow(params: {
  roboflowUrl: string
  cleanedBase64: string
  imageInput: string
}): Promise<{
  ok: boolean
  status: number
  responseData: unknown
}> {
  const { roboflowUrl, cleanedBase64, imageInput } = params

  const form = new FormData()
  const mime = extractMimeFromDataUrl(imageInput) || "image/jpeg"
  const fileBuffer = Buffer.from(cleanedBase64, "base64")

  try {
    const blob = new Blob([fileBuffer], { type: mime })
    form.append("file", blob, "upload.jpg")
  } catch {
    form.append("file", cleanedBase64)
  }

  const postResponse = await fetch(roboflowUrl, {
    method: "POST",
    body: form,
    cache: "no-store"
  })

  const responseText = await postResponse.text()
  let responseData: unknown = { raw: responseText }

  try {
    responseData = JSON.parse(responseText)
  } catch {
    responseData = { raw: responseText }
  }

  if (postResponse.ok) {
    return {
      ok: true,
      status: postResponse.status,
      responseData
    }
  }

  if (postResponse.status === 405) {
    try {
      const fallbackUrl = `${roboflowUrl}&image=${encodeURIComponent(cleanedBase64)}`
      const getResponse = await fetch(fallbackUrl, { method: "GET", cache: "no-store" })
      const getResponseText = await getResponse.text()

      let getResponseData: unknown = { raw: getResponseText }
      try {
        getResponseData = JSON.parse(getResponseText)
      } catch {
        getResponseData = { raw: getResponseText }
      }

      return {
        ok: getResponse.ok,
        status: getResponse.status,
        responseData: getResponseData
      }
    } catch {
      // keep original response
    }
  }

  return {
    ok: false,
    status: postResponse.status,
    responseData
  }
}
