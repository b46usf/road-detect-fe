import { NextResponse } from "next/server"
import { readString } from "@/lib/common-utils"

export function requireRoboflowEndpointSecret(request: Request): NextResponse | null {
  const endpointSecret = readString(process.env.ROBOFLOW_ENDPOINT_SECRET)
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
