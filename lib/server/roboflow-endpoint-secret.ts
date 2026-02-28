import { readString } from "@/lib/common-utils"

export const ROBOFLOW_ENDPOINT_SECRET_ENV = "ROBOFLOW_ENDPOINT_SECRET"
export const LEGACY_SYNC_ROBOFLOW_SECRET_ENV = "SYNC_ROBOFLOW_SECRET"

export function resolveRoboflowEndpointSecret(env: NodeJS.ProcessEnv = process.env): string {
  const primarySecret = readString(env[ROBOFLOW_ENDPOINT_SECRET_ENV])
  if (primarySecret) {
    return primarySecret
  }

  return readString(env[LEGACY_SYNC_ROBOFLOW_SECRET_ENV])
}

export function isUsingLegacySyncSecretOnly(env: NodeJS.ProcessEnv = process.env): boolean {
  const primarySecret = readString(env[ROBOFLOW_ENDPOINT_SECRET_ENV])
  const legacySecret = readString(env[LEGACY_SYNC_ROBOFLOW_SECRET_ENV])
  return !primarySecret && Boolean(legacySecret)
}
