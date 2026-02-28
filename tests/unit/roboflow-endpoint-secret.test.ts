import { describe, expect, it } from "vitest"
import {
  isUsingLegacySyncSecretOnly,
  resolveRoboflowEndpointSecret
} from "@/lib/server/roboflow-endpoint-secret"

describe("roboflow endpoint secret resolution", () => {
  it("prioritizes ROBOFLOW_ENDPOINT_SECRET when both are set", () => {
    const secret = resolveRoboflowEndpointSecret({
      ROBOFLOW_ENDPOINT_SECRET: "primary-secret",
      SYNC_ROBOFLOW_SECRET: "legacy-secret"
    })

    expect(secret).toBe("primary-secret")
    expect(
      isUsingLegacySyncSecretOnly({
        ROBOFLOW_ENDPOINT_SECRET: "primary-secret",
        SYNC_ROBOFLOW_SECRET: "legacy-secret"
      })
    ).toBe(false)
  })

  it("falls back to SYNC_ROBOFLOW_SECRET for legacy compatibility", () => {
    const secret = resolveRoboflowEndpointSecret({
      SYNC_ROBOFLOW_SECRET: "legacy-secret"
    })

    expect(secret).toBe("legacy-secret")
    expect(
      isUsingLegacySyncSecretOnly({
        SYNC_ROBOFLOW_SECRET: "legacy-secret"
      })
    ).toBe(true)
  })

  it("returns empty secret when none are configured", () => {
    const secret = resolveRoboflowEndpointSecret({})

    expect(secret).toBe("")
    expect(isUsingLegacySyncSecretOnly({})).toBe(false)
  })
})
