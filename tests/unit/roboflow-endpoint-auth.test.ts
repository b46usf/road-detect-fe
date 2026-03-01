import { afterEach, describe, expect, it } from "vitest"
import { requireRoboflowEndpointSecret } from "@/lib/server/roboflow-endpoint-auth"

const ORIGINAL_ROBOFLOW_ENDPOINT_SECRET = process.env.ROBOFLOW_ENDPOINT_SECRET
const ORIGINAL_SYNC_ROBOFLOW_SECRET = process.env.SYNC_ROBOFLOW_SECRET

afterEach(() => {
  if (ORIGINAL_ROBOFLOW_ENDPOINT_SECRET === undefined) {
    delete process.env.ROBOFLOW_ENDPOINT_SECRET
  } else {
    process.env.ROBOFLOW_ENDPOINT_SECRET = ORIGINAL_ROBOFLOW_ENDPOINT_SECRET
  }

  if (ORIGINAL_SYNC_ROBOFLOW_SECRET === undefined) {
    delete process.env.SYNC_ROBOFLOW_SECRET
  } else {
    process.env.SYNC_ROBOFLOW_SECRET = ORIGINAL_SYNC_ROBOFLOW_SECRET
  }
})

describe("roboflow endpoint auth guard", () => {
  it("allows when no endpoint secret is configured", () => {
    delete process.env.ROBOFLOW_ENDPOINT_SECRET
    delete process.env.SYNC_ROBOFLOW_SECRET

    const request = new Request("https://example.com/api/admin/roboflow-stats")
    const unauthorized = requireRoboflowEndpointSecret(request)
    expect(unauthorized).toBeNull()
  })

  it("allows when secret header matches", () => {
    process.env.ROBOFLOW_ENDPOINT_SECRET = "secret-123"
    delete process.env.SYNC_ROBOFLOW_SECRET

    const request = new Request("https://example.com/api/admin/roboflow-stats", {
      headers: {
        "x-roboflow-endpoint-secret": "secret-123"
      }
    })

    const unauthorized = requireRoboflowEndpointSecret(request)
    expect(unauthorized).toBeNull()
  })

  it("allows trusted browser requests when enabled", () => {
    process.env.ROBOFLOW_ENDPOINT_SECRET = "secret-123"

    const request = new Request("https://example.com/api/admin/roboflow-stats", {
      headers: {
        "sec-fetch-site": "same-origin"
      }
    })

    const unauthorized = requireRoboflowEndpointSecret(request, {
      allowTrustedClientRequest: true
    })
    expect(unauthorized).toBeNull()
  })

  it("rejects non-trusted requests without secret", () => {
    process.env.ROBOFLOW_ENDPOINT_SECRET = "secret-123"

    const request = new Request("https://example.com/api/admin/roboflow-stats")
    const unauthorized = requireRoboflowEndpointSecret(request)

    expect(unauthorized).not.toBeNull()
    expect(unauthorized?.status).toBe(401)
  })
})
