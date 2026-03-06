/* @vitest-environment node */

import { afterEach, describe, expect, it, vi } from "vitest"

const readFileMock = vi.fn()
const mkdirMock = vi.fn()
const writeFileMock = vi.fn()
const renameMock = vi.fn()

vi.mock("node:fs", () => ({
  promises: {
    readFile: readFileMock,
    mkdir: mkdirMock,
    writeFile: writeFileMock,
    rename: renameMock
  }
}))

describe("training pipeline state", () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("does not create the data directory during read fallback", async () => {
    readFileMock.mockRejectedValueOnce(Object.assign(new Error("missing"), { code: "ENOENT" }))

    const { readTrainingPipelineState } = await import("@/lib/server/training-pipeline-state")
    const state = await readTrainingPipelineState()

    expect(state.inferenceTarget).toBe("serverless")
    expect(mkdirMock).not.toHaveBeenCalled()
  })
})
