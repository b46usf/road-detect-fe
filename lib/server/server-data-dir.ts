import os from "node:os"
import path from "node:path"
import { readString } from "@/lib/common-utils"

const VERCEL_SERVER_DATA_DIR = "roadster-fe-data"

export function getServerDataDirectory(): string {
  const configuredPath = readString(process.env.SERVER_DATA_DIR)
  if (configuredPath) {
    return path.isAbsolute(configuredPath) ? configuredPath : path.resolve(process.cwd(), configuredPath)
  }

  if (readString(process.env.VERCEL)) {
    return path.join(os.tmpdir(), VERCEL_SERVER_DATA_DIR)
  }

  return path.join(process.cwd(), ".data")
}

export function getServerDataFilePath(filename: string): string {
  return path.join(getServerDataDirectory(), filename)
}
