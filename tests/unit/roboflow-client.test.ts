import { describe, expect, it } from "vitest"
import { extractUpstreamMessage } from "@/lib/roboflow-client"

describe("extractUpstreamMessage", () => {
  it("extracts message from detail array objects", () => {
    const message = extractUpstreamMessage({
      detail: [
        {
          type: "missing",
          loc: ["body", "inputs"],
          msg: "Field required"
        }
      ]
    })

    expect(message).toBe("Field required (body.inputs)")
  })

  it("extracts message from inner_error_message", () => {
    const message = extractUpstreamMessage({
      inner_error_message: "Model not found"
    })

    expect(message).toBe("Model not found")
  })
})
