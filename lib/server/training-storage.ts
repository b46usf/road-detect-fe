import { randomUUID } from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"
import { readString } from "@/lib/common-utils"
import {
  TRAINING_LABELS,
  TRAINING_SEVERITIES,
  type CreateTrainingSampleInput,
  type TrainingDatasetState,
  type TrainingLabel,
  type TrainingSample,
  type TrainingSampleSource,
  type TrainingSampleStatus,
  type TrainingSeverity
} from "@/lib/training-types"

const TRAINING_IMAGE_PUBLIC_SUBDIR = path.join("img", "training")
const TRAINING_IMAGE_DIR = path.join(process.cwd(), "public", TRAINING_IMAGE_PUBLIC_SUBDIR)
const TRAINING_METADATA_FILE = path.join(process.cwd(), ".data", "training-samples.json")
const MAX_TRAINING_IMAGE_BYTES = 6_000_000

const STATUS_SET = new Set<TrainingSampleStatus>(["queued", "uploading", "uploaded", "failed"])
const LABEL_SET = new Set<TrainingLabel>(TRAINING_LABELS)
const SEVERITY_SET = new Set<TrainingSeverity>(TRAINING_SEVERITIES)

let writeQueue: Promise<void> = Promise.resolve()

function withWriteLock<T>(task: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(task, task)
  writeQueue = next.then(
    () => undefined,
    () => undefined
  )
  return next
}

async function ensureTrainingDirectories(): Promise<void> {
  await fs.mkdir(TRAINING_IMAGE_DIR, { recursive: true })
  await fs.mkdir(path.dirname(TRAINING_METADATA_FILE), { recursive: true })
}

function createDefaultState(): TrainingDatasetState {
  return {
    samples: [],
    updatedAt: new Date().toISOString()
  }
}

function normalizeStatus(value: unknown): TrainingSampleStatus {
  const raw = readString(value)
  return STATUS_SET.has(raw as TrainingSampleStatus) ? (raw as TrainingSampleStatus) : "queued"
}

function normalizeLabel(value: unknown): TrainingLabel {
  const raw = readString(value)
  return LABEL_SET.has(raw as TrainingLabel) ? (raw as TrainingLabel) : "other"
}

function normalizeSeverity(value: unknown): TrainingSeverity {
  const raw = readString(value)
  return SEVERITY_SET.has(raw as TrainingSeverity) ? (raw as TrainingSeverity) : "unknown"
}

function normalizeSource(value: unknown): TrainingSampleSource {
  const raw = readString(value)
  return raw === "camera-capture" ? "camera-capture" : "admin-upload"
}

function normalizeSample(value: unknown, index: number): TrainingSample | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const source = value as Record<string, unknown>
  const nowIso = new Date().toISOString()
  const id = readString(source.id, `training-${Date.now()}-${index}`)
  const filename = readString(source.filename)
  const publicImagePath = readString(source.publicImagePath)

  if (!filename || !publicImagePath) {
    return null
  }

  return {
    id,
    createdAt: readString(source.createdAt, nowIso),
    updatedAt: readString(source.updatedAt, nowIso),
    filename,
    publicImagePath,
    mime: readString(source.mime, "image/jpeg"),
    sizeBytes: Math.max(0, Number(source.sizeBytes) || 0),
    label: normalizeLabel(source.label),
    severity: normalizeSeverity(source.severity),
    notes: readString(source.notes),
    source: normalizeSource(source.source),
    status: normalizeStatus(source.status),
    uploadAttempts: Math.max(0, Number(source.uploadAttempts) || 0),
    uploadedAt: readString(source.uploadedAt) || null,
    remoteId: readString(source.remoteId) || null,
    lastError: readString(source.lastError) || null
  }
}

async function readStateFromDisk(): Promise<TrainingDatasetState> {
  await ensureTrainingDirectories()

  try {
    const raw = await fs.readFile(TRAINING_METADATA_FILE, "utf8")
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") {
      return createDefaultState()
    }

    const source = parsed as Record<string, unknown>
    const samplesRaw = Array.isArray(source.samples) ? source.samples : []
    const samples = samplesRaw
      .map((item, index) => normalizeSample(item, index))
      .filter((item): item is TrainingSample => item !== null)

    return {
      samples,
      updatedAt: readString(source.updatedAt, new Date().toISOString())
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return createDefaultState()
    }

    return createDefaultState()
  }
}

async function writeStateToDisk(state: TrainingDatasetState): Promise<void> {
  await ensureTrainingDirectories()
  const nextState: TrainingDatasetState = {
    ...state,
    updatedAt: new Date().toISOString()
  }

  const tempFile = `${TRAINING_METADATA_FILE}.tmp`
  await fs.writeFile(tempFile, JSON.stringify(nextState, null, 2), "utf8")
  await fs.rename(tempFile, TRAINING_METADATA_FILE)
}

function extensionFromMime(mime: string): string {
  if (mime === "image/png") return "png"
  if (mime === "image/webp") return "webp"
  return "jpg"
}

function parseImageDataUrl(dataUrl: string): { mime: string; imageBuffer: Buffer } {
  const trimmed = dataUrl.trim()
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(trimmed)
  if (!match) {
    throw new Error("Format image harus data URL base64.")
  }

  const [, mimeRaw, payloadRaw] = match
  const mime = mimeRaw.toLowerCase()
  const allowedMime = mime === "image/jpeg" || mime === "image/png" || mime === "image/webp"
  if (!allowedMime) {
    throw new Error("Format image yang didukung hanya JPEG/PNG/WEBP.")
  }

  const normalizedBase64 = payloadRaw.replace(/\s+/g, "")
  const imageBuffer = Buffer.from(normalizedBase64, "base64")
  const reencoded = imageBuffer.toString("base64").replace(/=+$/, "")
  const originalNoPad = normalizedBase64.replace(/=+$/, "")
  if (imageBuffer.length === 0 || reencoded !== originalNoPad) {
    throw new Error("Payload base64 image tidak valid.")
  }

  if (imageBuffer.length > MAX_TRAINING_IMAGE_BYTES) {
    throw new Error(`Ukuran image terlalu besar. Maksimal ${MAX_TRAINING_IMAGE_BYTES} bytes.`)
  }

  return { mime, imageBuffer }
}

function buildPublicImagePath(filename: string): string {
  return `/${TRAINING_IMAGE_PUBLIC_SUBDIR.replace(/\\/g, "/")}/${filename}`
}

function resolvePublicPath(publicImagePath: string): string {
  const publicRoot = path.resolve(process.cwd(), "public")
  const cleaned = publicImagePath.replace(/^\/+/, "")
  const absolutePath = path.resolve(publicRoot, cleaned)
  if (!absolutePath.startsWith(publicRoot)) {
    throw new Error("Path image tidak valid.")
  }
  return absolutePath
}

export async function readTrainingDatasetState(): Promise<TrainingDatasetState> {
  return readStateFromDisk()
}

export async function listTrainingSamples(): Promise<TrainingSample[]> {
  const state = await readStateFromDisk()
  return state.samples
    .slice()
    .sort((a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || ""))
}

export async function createTrainingSample(input: CreateTrainingSampleInput): Promise<TrainingSample> {
  const { mime, imageBuffer } = parseImageDataUrl(input.imageDataUrl)
  const id = randomUUID()
  const extension = extensionFromMime(mime)
  const filename = `${Date.now()}-${id.slice(0, 8)}.${extension}`
  const absoluteImagePath = path.join(TRAINING_IMAGE_DIR, filename)
  const now = new Date().toISOString()
  const sample: TrainingSample = {
    id,
    createdAt: now,
    updatedAt: now,
    filename,
    publicImagePath: buildPublicImagePath(filename),
    mime,
    sizeBytes: imageBuffer.length,
    label: normalizeLabel(input.label),
    severity: normalizeSeverity(input.severity),
    notes: readString(input.notes),
    source: normalizeSource(input.source),
    status: "queued",
    uploadAttempts: 0,
    uploadedAt: null,
    remoteId: null,
    lastError: null
  }

  await ensureTrainingDirectories()
  await fs.writeFile(absoluteImagePath, imageBuffer)

  try {
    await withWriteLock(async () => {
      const state = await readStateFromDisk()
      state.samples.unshift(sample)
      await writeStateToDisk(state)
    })
  } catch (error) {
    await fs.unlink(absoluteImagePath).catch(() => undefined)
    throw error
  }

  return sample
}

export async function deleteTrainingSampleById(id: string): Promise<boolean> {
  const normalizedId = readString(id)
  if (!normalizedId) {
    return false
  }

  let deletedImagePath: string | null = null
  await withWriteLock(async () => {
    const state = await readStateFromDisk()
    const nextSamples = state.samples.filter((sample) => {
      const shouldKeep = sample.id !== normalizedId
      if (!shouldKeep) {
        deletedImagePath = sample.publicImagePath
      }
      return shouldKeep
    })

    if (nextSamples.length === state.samples.length) {
      return
    }

    state.samples = nextSamples
    await writeStateToDisk(state)
  })

  if (!deletedImagePath) {
    return false
  }

  const absoluteImagePath = resolvePublicPath(deletedImagePath)
  await fs.unlink(absoluteImagePath).catch(() => undefined)
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

  await withWriteLock(async () => {
    const state = await readStateFromDisk()
    const index = state.samples.findIndex((sample) => sample.id === normalizedId)
    if (index === -1) {
      return
    }

    const current = state.samples[index]
    const next: TrainingSample = {
      ...current,
      ...patch,
      label: patch.label ? normalizeLabel(patch.label) : current.label,
      severity: patch.severity ? normalizeSeverity(patch.severity) : current.severity,
      source: patch.source ? normalizeSource(patch.source) : current.source,
      status: patch.status ? normalizeStatus(patch.status) : current.status,
      notes: patch.notes !== undefined ? readString(patch.notes) : current.notes,
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
  await withWriteLock(async () => {
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

export async function readTrainingImageAsDataUrl(sample: TrainingSample): Promise<string> {
  const absoluteImagePath = resolvePublicPath(sample.publicImagePath)
  const imageBuffer = await fs.readFile(absoluteImagePath)
  return `data:${sample.mime};base64,${imageBuffer.toString("base64")}`
}

export async function countTrainingSamplesByStatus(): Promise<Record<TrainingSampleStatus, number>> {
  const samples = await listTrainingSamples()
  return samples.reduce<Record<TrainingSampleStatus, number>>(
    (accumulator, sample) => {
      accumulator[sample.status] += 1
      return accumulator
    },
    { queued: 0, uploading: 0, uploaded: 0, failed: 0 }
  )
}
