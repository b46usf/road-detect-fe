import { describe, expect, it } from "vitest"
import { resolveRoboflowEndpoint } from "@/lib/server/roboflow-endpoint"

describe("roboflow endpoint resolution", () => {
  it("builds dedicated deployment inference url from deployed domain", () => {
    const result = resolveRoboflowEndpoint({
      apiKey: "secret-key",
      modelId: "road-damage-ai",
      modelVersion: "9",
      confidence: "0.4",
      overlap: "0.3",
      endpointBaseOverride: "https://roadster-prod-abc.roboflow.cloud"
    })

    expect(result?.endpointType).toBe("detect")
    expect(result?.roboflowUrl).toContain("roadster-prod-abc.roboflow.cloud/road-damage-ai/9")
    expect(result?.roboflowUrl).toContain("api_key=secret-key")
    expect(result?.modelMeta.modelVersion).toBe("9")
  })

  it("preserves direct dedicated inference endpoint path for self-hosted target", () => {
    const result = resolveRoboflowEndpoint({
      apiKey: "secret-key",
      modelId: "road-damage-ai",
      modelVersion: "2",
      confidence: "0.4",
      overlap: "0.3",
      endpointBaseOverride: "http://gpubabesugab:9001/road-damage-ai/2"
    })

    expect(result?.endpointType).toBe("detect")
    expect(result?.roboflowUrl).toContain("http://gpubabesugab:9001/road-damage-ai/2")
    expect(result?.roboflowUrl).toContain("api_key=secret-key")
  })
})
