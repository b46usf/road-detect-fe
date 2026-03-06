import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { checkDedicatedInferenceHealth } from "@/lib/server/inference-runtime"

const ORIGINAL_ENV = { ...process.env }
const ORIGINAL_FETCH = global.fetch

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key]
    }
  }

  Object.assign(process.env, ORIGINAL_ENV)
}

describe("inference runtime health", () => {
  beforeEach(() => {
    resetEnv()
  })

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH
    vi.restoreAllMocks()
    resetEnv()
  })

  it("returns disabled state when dedicated endpoint is not configured", async () => {
    delete process.env.ROBOFLOW_DEDICATED_INFERENCE_ENDPOINT

    const result = await checkDedicatedInferenceHealth()

    expect(result.configured).toBe(false)
    expect(result.reachable).toBe(false)
  })

  it("marks endpoint reachable when the server responds", async () => {
    process.env.ROBOFLOW_DEDICATED_INFERENCE_ENDPOINT = "http://gpubabesugab:9001/road-damage-ai/2"
    global.fetch = vi.fn(async () => new Response(null, { status: 405 })) as typeof fetch

    const result = await checkDedicatedInferenceHealth()

    expect(result.configured).toBe(true)
    expect(result.reachable).toBe(true)
    expect(result.httpStatus).toBe(405)
  })
})
