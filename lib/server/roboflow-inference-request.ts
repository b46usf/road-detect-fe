import { extractMimeFromDataUrl, readString } from "@/lib/common-utils"
import type { RoboflowEndpointType } from "@/lib/server/roboflow-endpoint"

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
  apiKey: string
  endpointType: RoboflowEndpointType
  cleanedBase64: string
  imageInput: string
}): Promise<{
  ok: boolean
  status: number
  responseData: unknown
}> {
  const { roboflowUrl, apiKey, endpointType, cleanedBase64, imageInput } = params

  const workflowJsonPayloads: unknown[] = [
    {
      api_key: apiKey,
      inputs: {
        image: {
          type: "base64",
          value: cleanedBase64
        }
      }
    },
    {
      api_key: apiKey,
      inputs: {
        image: cleanedBase64
      }
    },
    {
      api_key: apiKey,
      inputs: {
        image: imageInput
      }
    }
  ]

  if (endpointType === "workflow") {
    let latestStatus = 502
    let latestResponseData: unknown = { error: "Workflow request failed." }

    for (const payload of workflowJsonPayloads) {
      try {
        const workflowResponse = await fetch(roboflowUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify(payload),
          cache: "no-store"
        })

        latestStatus = workflowResponse.status
        const text = await workflowResponse.text()

        try {
          latestResponseData = JSON.parse(text)
        } catch {
          latestResponseData = { raw: text }
        }

        if (workflowResponse.ok) {
          return {
            ok: true,
            status: workflowResponse.status,
            responseData: latestResponseData
          }
        }
      } catch {
        latestStatus = 502
      }
    }

    return {
      ok: false,
      status: latestStatus,
      responseData: latestResponseData
    }
  }

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
      const separator = roboflowUrl.includes("?") ? "&" : "?"
      const fallbackUrl = `${roboflowUrl}${separator}image=${encodeURIComponent(cleanedBase64)}`
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

  // Fallback for alternate non-workflow endpoints that require JSON body.
  if (postResponse.status === 400 || postResponse.status === 401 || postResponse.status === 403 || postResponse.status === 404 || postResponse.status === 405 || postResponse.status === 415) {
    const jsonPayloads: unknown[] = [
      {
        api_key: apiKey,
        image: cleanedBase64
      },
      {
        image: cleanedBase64
      },
      {
        api_key: apiKey,
        inputs: {
          image: {
            type: "base64",
            value: cleanedBase64
          }
        }
      },
      {
        inputs: {
          image: {
            type: "base64",
            value: cleanedBase64
          }
        }
      }
    ]

    for (const payload of jsonPayloads) {
      try {
        const jsonResponse = await fetch(roboflowUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify(payload),
          cache: "no-store"
        })

        const jsonText = await jsonResponse.text()
        let jsonData: unknown = { raw: jsonText }
        try {
          jsonData = JSON.parse(jsonText)
        } catch {
          jsonData = { raw: jsonText }
        }

        if (jsonResponse.ok) {
          return {
            ok: true,
            status: jsonResponse.status,
            responseData: jsonData
          }
        }

        // Keep latest non-OK payload for more informative upstream error.
        responseData = jsonData
      } catch {
        // continue trying the next fallback payload
      }
    }
  }

  return {
    ok: false,
    status: postResponse.status,
    responseData
  }
}
