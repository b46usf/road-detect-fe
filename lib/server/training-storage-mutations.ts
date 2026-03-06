import { randomUUID } from "node:crypto"
import { readString } from "@/lib/common-utils"
import { normalizeTrainingAnnotations } from "@/lib/training-annotations"
import type { CreateTrainingSampleInput, TrainingSample } from "@/lib/training-types"
import {
  buildTrainingPublicImagePath,
  deleteTrainingImageFile,
  extensionFromMime,
  listTrainingSamples,
  normalizeTrainingSampleLabel,
  normalizeTrainingSampleSeverity,
  normalizeTrainingSampleSource,
  normalizeTrainingSampleStatus,
  parseTrainingImageDataUrl,
  readStateFromDisk,
  withTrainingWriteLock,
  writeStateToDisk,
  writeTrainingImageFile
} from "@/lib/server/training-storage-persistence"

export async function createTrainingSample(input: CreateTrainingSampleInput): Promise<TrainingSample> {
  const { mime, imageBuffer } = parseTrainingImageDataUrl(input.imageDataUrl)
  const imageWidth = Math.max(1, Number(input.imageWidth) || 0)
  const imageHeight = Math.max(1, Number(input.imageHeight) || 0)
  if (imageWidth <= 0 || imageHeight <= 0) {
    throw new Error("Dimensi image training wajib diisi.")
  }

  const id = randomUUID()
  const extension = extensionFromMime(mime)
  const filename = `${Date.now()}-${id.slice(0, 8)}.${extension}`
  const now = new Date().toISOString()
  const sample: TrainingSample = {
    id,
    createdAt: now,
    updatedAt: now,
    filename,
    publicImagePath: buildTrainingPublicImagePath(id),
    mime,
    sizeBytes: imageBuffer.length,
    imageWidth,
    imageHeight,
    label: normalizeTrainingSampleLabel(input.label),
    severity: normalizeTrainingSampleSeverity(input.severity),
    notes: readString(input.notes),
    source: normalizeTrainingSampleSource(input.source),
    annotations: normalizeTrainingAnnotations(input.annotations),
    status: "queued",
    uploadAttempts: 0,
    uploadedAt: null,
    remoteId: null,
    lastError: null
  }

  await writeTrainingImageFile(filename, imageBuffer)

  try {
    await withTrainingWriteLock(async () => {
      const state = await readStateFromDisk()
      state.samples.unshift(sample)
      await writeStateToDisk(state)
    })
  } catch (error) {
    await deleteTrainingImageFile(sample).catch(() => undefined)
    throw error
  }

  return sample
}

export async function deleteTrainingSampleById(id: string): Promise<boolean> {
  const normalizedId = readString(id)
  if (!normalizedId) {
    return false
  }

  let deletedSample: TrainingSample | null = null
  await withTrainingWriteLock(async () => {
    const state = await readStateFromDisk()
    const nextSamples = state.samples.filter((sample) => {
      const shouldKeep = sample.id !== normalizedId
      if (!shouldKeep) {
        deletedSample = sample
      }
      return shouldKeep
    })

    if (nextSamples.length === state.samples.length) {
      return
    }

    state.samples = nextSamples
    await writeStateToDisk(state)
  })

  if (!deletedSample) {
    return false
  }

  await deleteTrainingImageFile(deletedSample)
  return true
}

export async function patchTrainingSample(
  id: string,
  patch: Partial<Omit<TrainingSample, "id" | "createdAt" | "filename" | "publicImagePath" | "mime" | "sizeBytes">>
): Promise<TrainingSample | null> {
  const normalizedId = readString(id)
  if (!normalizedId) {
    return null
  }

  let updatedSample: TrainingSample | null = null

  await withTrainingWriteLock(async () => {
    const state = await readStateFromDisk()
    const index = state.samples.findIndex((sample) => sample.id === normalizedId)
    if (index === -1) {
      return
    }

    const current = state.samples[index]
    const next: TrainingSample = {
      ...current,
      ...patch,
      imageWidth: patch.imageWidth ? Math.max(1, Number(patch.imageWidth) || current.imageWidth) : current.imageWidth,
      imageHeight: patch.imageHeight ? Math.max(1, Number(patch.imageHeight) || current.imageHeight) : current.imageHeight,
      label: patch.label ? normalizeTrainingSampleLabel(patch.label) : current.label,
      severity: patch.severity ? normalizeTrainingSampleSeverity(patch.severity) : current.severity,
      source: patch.source ? normalizeTrainingSampleSource(patch.source) : current.source,
      status: patch.status ? normalizeTrainingSampleStatus(patch.status) : current.status,
      notes: patch.notes !== undefined ? readString(patch.notes) : current.notes,
      annotations:
        patch.annotations !== undefined
          ? normalizeTrainingAnnotations(patch.annotations)
          : current.annotations,
      updatedAt: new Date().toISOString()
    }

    state.samples[index] = next
    await writeStateToDisk(state)
    updatedSample = next
  })

  return updatedSample
}

export async function requeueFailedTrainingSamples(): Promise<number> {
  let updatedCount = 0
  await withTrainingWriteLock(async () => {
    const state = await readStateFromDisk()
    state.samples = state.samples.map((sample) => {
      if (sample.status !== "failed") {
        return sample
      }

      updatedCount += 1
      return {
        ...sample,
        status: "queued",
        lastError: null,
        updatedAt: new Date().toISOString()
      }
    })

    if (updatedCount > 0) {
      await writeStateToDisk(state)
    }
  })

  return updatedCount
}

export { listTrainingSamples }
