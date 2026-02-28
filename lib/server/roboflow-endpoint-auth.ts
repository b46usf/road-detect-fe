import { NextResponse } from "next/server"
import { readString } from "@/lib/common-utils"
import { resolveRoboflowEndpointSecret } from "@/lib/server/roboflow-endpoint-secret"

export function requireRoboflowEndpointSecret(request: Request): NextResponse | null {
  const endpointSecret = resolveRoboflowEndpointSecret()
  if (!endpointSecret) {
    return null
  }

  const incomingSecret = readString(request.headers.get("x-roboflow-endpoint-secret"))
  if (incomingSecret && incomingSecret === endpointSecret) {
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
