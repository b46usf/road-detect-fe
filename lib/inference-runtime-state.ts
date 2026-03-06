export interface InferenceHealthState {
  configured: boolean
  reachable: boolean
  checkedAt: string
  latencyMs: number | null
  httpStatus: number | null
  endpoint: string | null
  message: string
}

export interface InferenceRuntimeState {
  target: "serverless" | "dedicated"
  activeEndpoint: string | null
  dedicatedInferenceEndpoint: string | null
  dedicatedInferenceConfigured: boolean
  dedicatedDeploymentEnabled: boolean
  dedicatedDeploymentReady: boolean
  dedicatedDeploymentDomain: string | null
  dedicatedDeploymentStatus: string | null
  health: InferenceHealthState | null
}

export function normalizeInferenceRuntime(value: unknown): InferenceRuntimeState | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const source = value as Record<string, unknown>
  const health =
    source.health && typeof source.health === "object"
      ? (source.health as Record<string, unknown>)
      : null

  return {
    target: source.target === "dedicated" ? "dedicated" : "serverless",
    activeEndpoint:
      typeof source.activeEndpoint === "string" && source.activeEndpoint.trim().length > 0
        ? source.activeEndpoint
        : null,
    dedicatedInferenceEndpoint:
      typeof source.dedicatedInferenceEndpoint === "string" &&
      source.dedicatedInferenceEndpoint.trim().length > 0
        ? source.dedicatedInferenceEndpoint
        : null,
    dedicatedInferenceConfigured: Boolean(source.dedicatedInferenceConfigured),
    dedicatedDeploymentEnabled: Boolean(source.dedicatedDeploymentEnabled),
    dedicatedDeploymentReady: Boolean(source.dedicatedDeploymentReady),
    dedicatedDeploymentDomain:
      typeof source.dedicatedDeploymentDomain === "string" &&
      source.dedicatedDeploymentDomain.trim().length > 0
        ? source.dedicatedDeploymentDomain
        : null,
    dedicatedDeploymentStatus:
      typeof source.dedicatedDeploymentStatus === "string" &&
      source.dedicatedDeploymentStatus.trim().length > 0
        ? source.dedicatedDeploymentStatus
        : null,
    health: health
      ? {
          configured: Boolean(health.configured),
          reachable: Boolean(health.reachable),
          checkedAt:
            typeof health.checkedAt === "string" && health.checkedAt.trim().length > 0
              ? health.checkedAt
              : "",
          latencyMs:
            typeof health.latencyMs === "number" && Number.isFinite(health.latencyMs)
              ? health.latencyMs
              : null,
          httpStatus:
            typeof health.httpStatus === "number" && Number.isFinite(health.httpStatus)
              ? health.httpStatus
              : null,
          endpoint:
            typeof health.endpoint === "string" && health.endpoint.trim().length > 0
              ? health.endpoint
              : null,
          message:
            typeof health.message === "string" && health.message.trim().length > 0
              ? health.message
              : "Health status tidak tersedia."
        }
      : null
  }
}
