import { readString } from "@/lib/common-utils"
import {
  DEFAULT_LOCAL_APP_URL,
  DEFAULT_ROBOFLOW_MODEL_ID,
  DEFAULT_ROBOFLOW_MODEL_VERSION
} from "@/lib/env/shared"

export function getClientAppUrl(): string {
  return readString(process.env.NEXT_PUBLIC_APP_URL, DEFAULT_LOCAL_APP_URL)
}

export function getClientRoboflowModelId(): string {
  return readString(process.env.NEXT_PUBLIC_ROBOFLOW_MODEL_ID, DEFAULT_ROBOFLOW_MODEL_ID)
}

export function getClientRoboflowModelVersion(): string {
  return readString(process.env.NEXT_PUBLIC_ROBOFLOW_MODEL_VERSION, DEFAULT_ROBOFLOW_MODEL_VERSION)
}

export function getClientAdminUsername(): string {
  return readString(process.env.NEXT_PUBLIC_ADMIN_USERNAME)
}

export function getClientAdminPassword(): string {
  return readString(process.env.NEXT_PUBLIC_ADMIN_PASSWORD)
}
