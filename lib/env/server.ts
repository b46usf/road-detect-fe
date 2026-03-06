import { readString } from "@/lib/common-utils"
import {
  DEFAULT_ROBOFLOW_API_KEY_VALIDATION_TTL_MS,
  DEFAULT_ROBOFLOW_INFERENCE_ENDPOINT,
  DEFAULT_ROBOFLOW_MODEL_ID,
  DEFAULT_ROBOFLOW_MODEL_VERSION,
  DEFAULT_TRAINING_MIN_UPLOADED_SAMPLES,
  DEFAULT_TRAINING_RECOMMENDED_MAX_UPLOADED_SAMPLES
} from "@/lib/env/shared"

const DISABLED_ENV_VALUES = new Set(["0", "false", "off", "no", "none", "null", "undefined", "disabled"])
const ENABLED_ENV_VALUES = new Set(["1", "true", "on", "yes"])

function readOptionalEnv(rawValue: string | undefined): string {
  const value = readString(rawValue)
  return DISABLED_ENV_VALUES.has(value.toLowerCase()) ? "" : value
}

function readBooleanEnv(rawValue: string | undefined): boolean {
  return ENABLED_ENV_VALUES.has(readString(rawValue).toLowerCase())
}

export function getServerRoboflowApiKey(): string {
  return readString(process.env.ROBOFLOW_API_KEY)
}

export function getServerRoboflowModelId(): string {
  return readString(process.env.ROBOFLOW_MODEL_ID, DEFAULT_ROBOFLOW_MODEL_ID)
}

export function getServerRoboflowModelVersion(): string {
  return readString(process.env.ROBOFLOW_MODEL_VERSION, DEFAULT_ROBOFLOW_MODEL_VERSION)
}

export function getServerRoboflowInferenceEndpoint(): string {
  return readString(process.env.ROBOFLOW_INFERENCE_ENDPOINT, DEFAULT_ROBOFLOW_INFERENCE_ENDPOINT)
}

export function getServerRoboflowAllowedOrigins(): string[] {
  return readString(process.env.ROBOFLOW_ALLOWED_ORIGINS)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

export function shouldSkipRoboflowKeyValidation(): boolean {
  return readString(process.env.ROBOFLOW_SKIP_KEY_VALIDATION).toLowerCase() === "true"
}

export function getRoboflowApiKeyValidationTtlMs(): number {
  const ttl = Number(process.env.ROBOFLOW_API_KEY_VALIDATION_TTL_MS)
  return Number.isFinite(ttl) && ttl > 0 ? ttl : DEFAULT_ROBOFLOW_API_KEY_VALIDATION_TTL_MS
}

export function getRoboflowTrainingUploadEndpoint(): string {
  return readString(process.env.ROBOFLOW_TRAINING_UPLOAD_ENDPOINT)
}

export function getRoboflowTrainingTriggerEndpoint(): string {
  return readString(process.env.ROBOFLOW_TRAINING_TRIGGER_ENDPOINT)
}

export function getRoboflowTrainingStatusEndpointTemplate(): string {
  return readOptionalEnv(process.env.ROBOFLOW_TRAINING_STATUS_ENDPOINT_TEMPLATE)
}

export function getRoboflowTrainingDeployEndpoint(): string {
  return readOptionalEnv(process.env.ROBOFLOW_TRAINING_DEPLOY_ENDPOINT)
}

export function getRoboflowDedicatedDeploymentStatusEndpoint(): string {
  return readOptionalEnv(process.env.ROBOFLOW_DEDICATED_DEPLOYMENT_STATUS_ENDPOINT)
}

export function getRoboflowDedicatedDeploymentName(): string {
  return readOptionalEnv(process.env.ROBOFLOW_DEDICATED_DEPLOYMENT_NAME)
}

export function getRoboflowDedicatedInferenceEndpoint(): string {
  return readOptionalEnv(process.env.ROBOFLOW_DEDICATED_INFERENCE_ENDPOINT)
}

export function isRoboflowDedicatedDeploymentEnabled(): boolean {
  return readBooleanEnv(process.env.ROBOFLOW_USE_DEDICATED_DEPLOYMENT)
}

export function shouldUseDedicatedDeploymentRouting(): boolean {
  return isRoboflowDedicatedDeploymentEnabled()
}

export function isRoboflowTrainingAutoDeployEnabled(): boolean {
  return isRoboflowDedicatedDeploymentEnabled() && readBooleanEnv(process.env.ROBOFLOW_TRAINING_AUTO_DEPLOY)
}

export function getTrainingMinUploadedSamples(): number {
  const value = Number(process.env.ROBOFLOW_TRAINING_MIN_UPLOADED_SAMPLES)
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_TRAINING_MIN_UPLOADED_SAMPLES
}

export function getTrainingRecommendedMaxUploadedSamples(): number {
  const value = Number(process.env.ROBOFLOW_TRAINING_RECOMMENDED_MAX_UPLOADED_SAMPLES)
  return Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : DEFAULT_TRAINING_RECOMMENDED_MAX_UPLOADED_SAMPLES
}
