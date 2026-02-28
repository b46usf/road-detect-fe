import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

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
  // Try read persisted stats file (best-effort). If not present, fallback to in-memory globals.
  try {
    const statsFile = path.join(process.cwd(), ".data", "roboflow-admin-stats.json")
    const raw = await fs.readFile(statsFile, "utf8")
    const parsed = JSON.parse(raw)
    const stats = parsed?.stats ?? (globalThis as any).__roboflowApiKeyValidationStats ?? { invalidCount: 0 }
    const cache = parsed?.cache ?? (globalThis as any).__roboflowApiKeyValidation ?? null
    return NextResponse.json({ ok: true, stats, cache })
  } catch {
    const stats = (globalThis as any).__roboflowApiKeyValidationStats ?? { invalidCount: 0 }
    const cache = (globalThis as any).__roboflowApiKeyValidation ?? null
    return NextResponse.json({ ok: true, stats, cache })
  }
}

export async function POST(request: Request) {
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

  try {
    const body = await request.json()
    const stats = body?.stats ?? null
    const cache = body?.cache ?? null

    const payload = {
      stats,
      cache,
      updatedAt: Date.now()
    }

    const statsFile = path.join(process.cwd(), ".data", "roboflow-admin-stats.json")
    await fs.mkdir(path.dirname(statsFile), { recursive: true })
    await fs.writeFile(statsFile, JSON.stringify(payload, null, 2), "utf8")

    // update in-memory snapshot for immediate visibility
    try {
      if (stats && typeof stats === "object") {
        (globalThis as any).__roboflowApiKeyValidationStats = stats
      }
      if (cache && typeof cache === "object") {
        (globalThis as any).__roboflowApiKeyValidation = cache
      }
    } catch {
      // ignore
    }

    return NextResponse.json({ ok: true, message: "Stats tersimpan." })
  } catch (err) {
    return NextResponse.json({ ok: false, error: { code: "INVALID_PAYLOAD", message: "Payload tidak valid." } }, { status: 400 })
  }
}
