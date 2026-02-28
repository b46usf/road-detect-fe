/* @vitest-environment node */

import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { ChildProcessWithoutNullStreams } from "node:child_process"
import { spawn } from "node:child_process"
import path from "node:path"

const SMOKE_ROUTES = ["/", "/camera", "/admin/login", "/admin/dashboard"] as const
const ALLOWED_STATUS_CODES = new Set([200, 301, 302, 307, 308])
const port = Number(process.env.SMOKE_PORT ?? 3200)
const baseUrl = `http://127.0.0.1:${port}`

let serverProcess: ChildProcessWithoutNullStreams | null = null
let serverOutput = ""

async function waitForServer(timeoutMs = 90_000): Promise<void> {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    if (serverProcess?.exitCode !== null) {
      throw new Error(`Next server exited before ready.\n${serverOutput}`)
    }

    try {
      const response = await fetch(`${baseUrl}/`, {
        redirect: "manual"
      })

      if (response.status >= 200 && response.status < 500) {
        return
      }
    } catch {
      // Server not ready yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`Timeout waiting for ${baseUrl}\n${serverOutput}`)
}

async function stopServer(): Promise<void> {
  if (!serverProcess) {
    return
  }

  await new Promise<void>((resolve) => {
    const processRef = serverProcess
    const forceKillTimer = setTimeout(() => {
      if (processRef.exitCode === null) {
        processRef.kill("SIGKILL")
      }
      resolve()
    }, 5000)

    processRef.once("exit", () => {
      clearTimeout(forceKillTimer)
      resolve()
    })

    processRef.kill("SIGTERM")
  })

  serverProcess = null
}

describe("smoke routes", () => {
  beforeAll(async () => {
    const nextBinPath = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next")
    serverProcess = spawn(
      process.execPath,
      [nextBinPath, "start", "--hostname", "127.0.0.1", "--port", String(port)],
      {
        env: {
          ...process.env,
          NEXT_TELEMETRY_DISABLED: "1"
        },
        stdio: ["ignore", "pipe", "pipe"]
      }
    )

    serverProcess.stdout.on("data", (chunk: Buffer) => {
      serverOutput = `${serverOutput}${chunk.toString()}`
    })

    serverProcess.stderr.on("data", (chunk: Buffer) => {
      serverOutput = `${serverOutput}${chunk.toString()}`
    })

    await waitForServer()
  }, 120_000)

  afterAll(async () => {
    await stopServer()
  })

  for (const route of SMOKE_ROUTES) {
    it(`responds for ${route}`, async () => {
      const response = await fetch(`${baseUrl}${route}`, {
        redirect: "manual"
      })
      expect(ALLOWED_STATUS_CODES.has(response.status)).toBe(true)
    })
  }
})
