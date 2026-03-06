import type {
  TrainingLabel,
  TrainingSampleStatus,
  TrainingSeverity
} from "@/lib/training-types"

export const TRAINING_LABEL_OPTIONS: Array<{ value: TrainingLabel; label: string }> = [
  { value: "pothole", label: "Pothole" },
  { value: "crack", label: "Crack" },
  { value: "rutting", label: "Rutting" },
  { value: "barrier", label: "Barrier" },
  { value: "water", label: "Water" },
  { value: "other", label: "Other" }
]

export const TRAINING_SEVERITY_OPTIONS: Array<{ value: TrainingSeverity; label: string }> = [
  { value: "ringan", label: "Ringan" },
  { value: "sedang", label: "Sedang" },
  { value: "berat", label: "Berat" },
  { value: "unknown", label: "Unknown" }
]

export function getTrainingStatusTone(status: TrainingSampleStatus): string {
  if (status === "uploaded") {
    return "border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
  }

  if (status === "failed") {
    return "border-rose-300/40 bg-rose-400/15 text-rose-100"
  }

  if (status === "uploading") {
    return "border-cyan-300/40 bg-cyan-400/15 text-cyan-100"
  }

  return "border-amber-300/40 bg-amber-400/15 text-amber-100"
}

export function getTrainingStatusLabel(status: TrainingSampleStatus): string {
  if (status === "uploaded") return "Uploaded"
  if (status === "failed") return "Failed"
  if (status === "uploading") return "Uploading"
  return "Queued"
}
