import { describe, expect, it } from "vitest"
import { assignAbVariant } from "@/lib/experiments/ab-assignment"

describe("assignAbVariant", () => {
  it("returns deterministic result for the same seed", () => {
    const first = assignAbVariant("user-123")
    const second = assignAbVariant("user-123")
    expect(first).toBe(second)
  })

  it("returns A when ratioA is 1", () => {
    expect(assignAbVariant("user-123", 1)).toBe("A")
  })

  it("returns B when ratioA is 0", () => {
    expect(assignAbVariant("user-123", 0)).toBe("B")
  })

  it("falls back safely for empty seed", () => {
    expect(assignAbVariant("   ")).toBe("A")
  })
})
