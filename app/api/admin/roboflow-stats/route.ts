import { NextResponse } from "next/server"
import { requireRoboflowEndpointSecret } from "@/lib/server/roboflow-endpoint-auth"
import {
  getInMemoryRoboflowAdminState,
  persistRoboflowAdminState,
  readPersistedRoboflowAdminState
} from "@/lib/server/roboflow-admin-state"

export async function GET(request: Request) {
  const unauthorized = requireRoboflowEndpointSecret(request, { allowTrustedClientRequest: true })
  if (unauthorized) {
    return unauthorized
  }

  const persisted = await readPersistedRoboflowAdminState()
  if (persisted) {
    return NextResponse.json({
      ok: true,
      stats: persisted.stats,
      cache: persisted.cache
    })
  }

  const snapshot = getInMemoryRoboflowAdminState()
  return NextResponse.json({
    ok: true,
    stats: snapshot.stats,
    cache: snapshot.cache
  })
}

export async function POST(request: Request) {
  const unauthorized = requireRoboflowEndpointSecret(request)
  if (unauthorized) {
    return unauthorized
  }

  try {
    const body: unknown = await request.json()
    const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {}

    await persistRoboflowAdminState({
      stats: payload.stats,
      cache: payload.cache
    })

    return NextResponse.json({ ok: true, message: "Stats tersimpan." })
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_PAYLOAD",
          message: "Payload tidak valid."
        }
      },
      { status: 400 }
    )
  }
}
