import { describe, expect, it } from "vitest"
import {
  buildDarknetAnnotationFile,
  normalizeTrainingAnnotations,
  parseTrainingAnnotationDocument
} from "@/lib/training-annotations"

describe("training annotations", () => {
  it("normalizes annotation labels to supported training labels", () => {
    const result = normalizeTrainingAnnotations([
      { label: "potholes", x: 120, y: 200, width: 80, height: 60 },
      { label: "crackings", x: 80, y: 120, width: 40, height: 30 },
      { label: "waters", x: 64, y: 64, width: 20, height: 20 }
    ])

    expect(result).toEqual([
      { label: "pothole", x: 120, y: 200, width: 80, height: 60 },
      { label: "crack", x: 80, y: 120, width: 40, height: 30 },
      { label: "water", x: 64, y: 64, width: 20, height: 20 }
    ])
  })

  it("parses ROADSTER annotation document format", () => {
    const result = parseTrainingAnnotationDocument(`{
      "annotations": [
        { "label": "pothole", "x": 120, "y": 200, "width": 80, "height": 60 }
      ]
    }`)

    expect(result).toHaveLength(1)
    expect(result[0]?.label).toBe("pothole")
  })

  it("converts pixel annotations to darknet text format", () => {
    const result = buildDarknetAnnotationFile({
      annotations: [{ label: "pothole", x: 160, y: 90, width: 64, height: 36 }],
      imageWidth: 320,
      imageHeight: 180
    })

    expect(result.annotationFile).toContain("0 0.500000 0.500000 0.200000 0.200000")
    expect(result.labelmap["0"]).toBe("pothole")
  })
})
