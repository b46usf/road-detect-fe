export type TrainingSampleStatus = "queued" | "uploading" | "uploaded" | "failed"

export type TrainingSampleSource = "admin-upload" | "camera-capture"

export type TrainingLabel =
  | "pothole"
  | "crack"
  | "rutting"
  | "barrier"
  | "water"
  | "other"

export type TrainingSeverity = "ringan" | "sedang" | "berat" | "unknown"

export interface TrainingAnnotation {
  label: TrainingLabel
  x: number
  y: number
  width: number
  height: number
}

export interface TrainingSample {
  id: string
  createdAt: string
  updatedAt: string
  filename: string
  publicImagePath: string
  mime: string
  sizeBytes: number
  imageWidth: number
  imageHeight: number
  label: TrainingLabel
  severity: TrainingSeverity
  notes: string
  source: TrainingSampleSource
  annotations: TrainingAnnotation[]
  status: TrainingSampleStatus
  uploadAttempts: number
  uploadedAt: string | null
  remoteId: string | null
  lastError: string | null
}

export interface TrainingDatasetState {
  samples: TrainingSample[]
  updatedAt: string
}

export interface CreateTrainingSampleInput {
  imageDataUrl: string
  imageWidth: number
  imageHeight: number
  label: TrainingLabel
  severity: TrainingSeverity
  annotations?: TrainingAnnotation[]
  notes?: string
  source?: TrainingSampleSource
}

export interface TrainingPipelineRunSummary {
  total: number
  succeeded: number
  failed: number
  skipped: number
}

export const TRAINING_LABELS: readonly TrainingLabel[] = [
  "pothole",
  "crack",
  "rutting",
  "barrier",
  "water",
  "other"
]

export const TRAINING_SEVERITIES: readonly TrainingSeverity[] = [
  "ringan",
  "sedang",
  "berat",
  "unknown"
]
