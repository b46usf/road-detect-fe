import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const endpointSecret = process.env.ROBOFLOW_ENDPOINT_SECRET
  if (endpointSecret) {
    const incoming = (request.headers.get("x-roboflow-endpoint-secret") || "").trim()
    if (!incoming || incoming !== endpointSecret) {
      return NextResponse.json(
        { ok: false, error: { code: "UNAUTHORIZED", message: "Akses endpoint ditolak." } },
        { status: 401 }
      )
    }
  }

  const stats = (globalThis as any).__roboflowApiKeyValidationStats ?? { invalidCount: 0 }
  const cache = (globalThis as any).__roboflowApiKeyValidation ?? null

  return NextResponse.json({ ok: true, stats, cache })
}
