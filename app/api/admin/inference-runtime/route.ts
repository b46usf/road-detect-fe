import { NextResponse } from "next/server"
import { requireRoboflowEndpointSecret } from "@/lib/server/roboflow-endpoint-auth"
import { getInferenceRuntimeSnapshot } from "@/lib/server/inference-runtime"

export async function GET(request: Request) {
  const unauthorized = requireRoboflowEndpointSecret(request, { allowTrustedClientRequest: true })
  if (unauthorized) {
    return unauthorized
  }

  const runtime = await getInferenceRuntimeSnapshot({ includeHealth: true })
  return NextResponse.json({
    ok: true,
    runtime
  })
}
