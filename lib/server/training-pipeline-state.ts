import { promises as fs } from "node:fs"
import path from "node:path"
import { readString } from "@/lib/common-utils"
import { getServerDataFilePath } from "@/lib/server/server-data-dir"

function getTrainingPipelineStateFilePath(): string {
  return getServerDataFilePath("training-pipeline-state.json")
}

export type InferenceTarget = "serverless" | "dedicated"

export interface TrainingPipelineState {
  updatedAt: string
  inferenceTarget: InferenceTarget
  lastTriggerAt: string | null
  lastTriggerResponse: unknown
  pendingVersion: string | null
  deployedVersion: string | null
  trainingReady: boolean
  lastStatusAt: string | null
  lastStatusResponse: unknown
  lastDeployAt: string | null
  lastDeployResponse: unknown
  lastError: string | null
  lastDeployError: string | null
  dedicatedDeploymentName: string | null
  dedicatedDeploymentDomain: string | null
  dedicatedDeploymentStatus: string | null
}

function createDefaultState(): TrainingPipelineState {
  return {
    updatedAt: new Date().toISOString(),
    inferenceTarget: "serverless",
    lastTriggerAt: null,
    lastTriggerResponse: null,
    pendingVersion: null,
    deployedVersion: null,
    trainingReady: false,
    lastStatusAt: null,
    lastStatusResponse: null,
    lastDeployAt: null,
    lastDeployResponse: null,
    lastError: null,
    lastDeployError: null,
    dedicatedDeploymentName: null,
    dedicatedDeploymentDomain: null,
    dedicatedDeploymentStatus: null
  }
}

function normalizeInferenceTarget(value: unknown): InferenceTarget {
  return value === "dedicated" ? "dedicated" : "serverless"
}

async function ensurePipelineStateDir(): Promise<void> {
  await fs.mkdir(path.dirname(getTrainingPipelineStateFilePath()), { recursive: true })
}

function normalizeState(value: unknown): TrainingPipelineState {
  if (!value || typeof value !== "object") {
    return createDefaultState()
  }

  const source = value as Record<string, unknown>
  return {
    updatedAt: readString(source.updatedAt, new Date().toISOString()),
    inferenceTarget: normalizeInferenceTarget(source.inferenceTarget),
    lastTriggerAt: readString(source.lastTriggerAt) || null,
    lastTriggerResponse: source.lastTriggerResponse ?? null,
    pendingVersion: readString(source.pendingVersion) || null,
    deployedVersion: readString(source.deployedVersion) || null,
    trainingReady: Boolean(source.trainingReady),
    lastStatusAt: readString(source.lastStatusAt) || null,
    lastStatusResponse: source.lastStatusResponse ?? null,
    lastDeployAt: readString(source.lastDeployAt) || null,
    lastDeployResponse: source.lastDeployResponse ?? null,
    lastError: readString(source.lastError) || null,
    lastDeployError: readString(source.lastDeployError) || null,
    dedicatedDeploymentName: readString(source.dedicatedDeploymentName) || null,
    dedicatedDeploymentDomain: readString(source.dedicatedDeploymentDomain) || null,
    dedicatedDeploymentStatus: readString(source.dedicatedDeploymentStatus) || null
  }
}

export async function readTrainingPipelineState(): Promise<TrainingPipelineState> {
  try {
    const raw = await fs.readFile(getTrainingPipelineStateFilePath(), "utf8")
    return normalizeState(JSON.parse(raw))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return createDefaultState()
    }
    return createDefaultState()
  }
}

export async function writeTrainingPipelineState(
  nextState: TrainingPipelineState
): Promise<TrainingPipelineState> {
  await ensurePipelineStateDir()
  const stateFile = getTrainingPipelineStateFilePath()
  const normalized = normalizeState({
    ...nextState,
    updatedAt: new Date().toISOString()
  })
  const tempFile = `${stateFile}.tmp`
  await fs.writeFile(tempFile, JSON.stringify(normalized, null, 2), "utf8")
  await fs.rename(tempFile, stateFile)
  return normalized
}

export async function patchTrainingPipelineState(
  patch: Partial<TrainingPipelineState>
): Promise<TrainingPipelineState> {
  const current = await readTrainingPipelineState()
  return writeTrainingPipelineState({
    ...current,
    ...patch
  })
}
