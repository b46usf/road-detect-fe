import { describe, expect, it } from "vitest"
import { buildTrainingTriggerPolicy } from "@/lib/server/roboflow-training"

describe("roboflow training policy", () => {
  it("blocks trigger training when uploaded samples are below minimum", () => {
    const result = buildTrainingTriggerPolicy(72)

    expect(result.canTriggerTraining).toBe(false)
    expect(result.minUploadedSamples).toBeGreaterThan(72)
  })

  it("allows trigger training once minimum sample threshold is reached", () => {
    const result = buildTrainingTriggerPolicy(100)

    expect(result.canTriggerTraining).toBe(true)
    expect(result.minUploadedSamples).toBe(100)
    expect(result.recommendedMaxUploadedSamples).toBe(500)
  })
})
