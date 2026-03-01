import { NextResponse } from "next/server"
import { readString } from "@/lib/common-utils"
import { resolveRoboflowEndpointSecret } from "@/lib/server/roboflow-endpoint-secret"

const TRUSTED_FETCH_SITES = new Set(["same-origin", "same-site", "none"])

interface EndpointSecretGuardOptions {
  allowTrustedClientRequest?: boolean
}

function isTrustedClientRequest(request: Request): boolean {
  const fetchSite = readString(request.headers.get("sec-fetch-site")).toLowerCase()
  if (TRUSTED_FETCH_SITES.has(fetchSite)) {
    return true
  }

  const origin = readString(request.headers.get("origin"))
  const host = readString(request.headers.get("host"))
  if (!origin || !host) {
    return false
  }

  try {
    const originUrl = new URL(origin)
    return originUrl.host === host || originUrl.hostname === host.split(":")[0]
  } catch {
    return false
  }
}

export function requireRoboflowEndpointSecret(
  request: Request,
  options: EndpointSecretGuardOptions = {}
): NextResponse | null {
  const { allowTrustedClientRequest = false } = options
  const endpointSecret = resolveRoboflowEndpointSecret()
  if (!endpointSecret) {
    return null
  }

  const incomingSecret = readString(request.headers.get("x-roboflow-endpoint-secret"))
  if (incomingSecret && incomingSecret === endpointSecret) {
    return null
  }

  if (allowTrustedClientRequest && isTrustedClientRequest(request)) {
    return null
  }

  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Akses endpoint ditolak."
      }
    },
    { status: 401 }
  )
}
