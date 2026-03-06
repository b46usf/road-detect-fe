/* @vitest-environment node */

import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"

const ORIGINAL_ENV = { ...process.env }

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key]
    }
  }

  Object.assign(process.env, ORIGINAL_ENV)
}

describe("server data directory", () => {
  afterEach(() => {
    vi.resetModules()
    resetEnv()
  })

  it("uses process .data locally by default", async () => {
    delete process.env.SERVER_DATA_DIR
    delete process.env.VERCEL

    const { getServerDataDirectory } = await import("@/lib/server/server-data-dir")

    expect(getServerDataDirectory()).toBe(path.join(process.cwd(), ".data"))
  })

  it("uses SERVER_DATA_DIR when configured", async () => {
    process.env.SERVER_DATA_DIR = ".custom-data"
    delete process.env.VERCEL

    const { getServerDataDirectory, getServerDataFilePath } = await import("@/lib/server/server-data-dir")

    expect(getServerDataDirectory()).toBe(path.resolve(process.cwd(), ".custom-data"))
    expect(getServerDataFilePath("state.json")).toBe(path.resolve(process.cwd(), ".custom-data", "state.json"))
  })

  it("falls back to os tmpdir on Vercel", async () => {
    delete process.env.SERVER_DATA_DIR
    process.env.VERCEL = "1"

    const { getServerDataDirectory } = await import("@/lib/server/server-data-dir")

    expect(getServerDataDirectory()).toBe(path.join(os.tmpdir(), "roadster-fe-data"))
  })
})
