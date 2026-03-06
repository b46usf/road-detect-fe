/* @vitest-environment node */

import { access, mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { TrainingSample } from "@/lib/training-types"

const ORIGINAL_ENV = { ...process.env }

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key]
    }
  }

  Object.assign(process.env, ORIGINAL_ENV)
}

describe("training storage persistence", () => {
  afterEach(() => {
    vi.resetModules()
    resetEnv()
  })

  it("stores sample images in server data dir and exposes an internal image route", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "roadster-training-"))
    process.env.SERVER_DATA_DIR = tempDir

    const {
      buildTrainingPublicImagePath,
      deleteTrainingImageFile,
      readTrainingImageAsDataUrl,
      writeTrainingImageFile
    } = await import("@/lib/server/training-storage-persistence")

    const sample = {
      id: "sample-123",
      filename: "sample-123.jpg",
      publicImagePath: buildTrainingPublicImagePath("sample-123"),
      mime: "image/jpeg"
    } as TrainingSample

    await writeTrainingImageFile(sample.filename, Buffer.from("roadster"))

    expect(sample.publicImagePath).toBe("/api/admin/training/sample-image?id=sample-123")
    await expect(readTrainingImageAsDataUrl(sample)).resolves.toBe("data:image/jpeg;base64,cm9hZHN0ZXI=")

    await deleteTrainingImageFile(sample)
    await expect(access(path.join(tempDir, "training-images", sample.filename))).rejects.toBeTruthy()
    await rm(tempDir, { recursive: true, force: true })
  })
})
