import { promises as fs } from "node:fs"
import path from "node:path"
import { readString } from "@/lib/common-utils"
import { normalizeTrainingAnnotations } from "@/lib/training-annotations"
import {
  TRAINING_LABELS,
  TRAINING_SEVERITIES,
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

export function withTrainingWriteLock<T>(task: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(task, task)
  writeQueue = next.then(
    () => undefined,
    () => undefined
  )
  return next
}

export async function ensureTrainingDirectories(): Promise<void> {
  await fs.mkdir(TRAINING_IMAGE_DIR, { recursive: true })
  await fs.mkdir(path.dirname(TRAINING_METADATA_FILE), { recursive: true })
}

function createDefaultState(): TrainingDatasetState {
  return {
    samples: [],
    updatedAt: new Date().toISOString()
  }
}

export function normalizeTrainingSampleStatus(value: unknown): TrainingSampleStatus {
  const raw = readString(value)
  return STATUS_SET.has(raw as TrainingSampleStatus) ? (raw as TrainingSampleStatus) : "queued"
}

export function normalizeTrainingSampleLabel(value: unknown): TrainingLabel {
  const raw = readString(value)
  return LABEL_SET.has(raw as TrainingLabel) ? (raw as TrainingLabel) : "other"
}

export function normalizeTrainingSampleSeverity(value: unknown): TrainingSeverity {
  const raw = readString(value)
  return SEVERITY_SET.has(raw as TrainingSeverity) ? (raw as TrainingSeverity) : "unknown"
}

export function normalizeTrainingSampleSource(value: unknown): TrainingSampleSource {
  const raw = readString(value)
  return raw === "camera-capture" ? "camera-capture" : "admin-upload"
}

function normalizeTrainingSample(value: unknown, index: number): TrainingSample | null {
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
    imageWidth: Math.max(1, Number(source.imageWidth) || 1),
    imageHeight: Math.max(1, Number(source.imageHeight) || 1),
    label: normalizeTrainingSampleLabel(source.label),
    severity: normalizeTrainingSampleSeverity(source.severity),
    notes: readString(source.notes),
    source: normalizeTrainingSampleSource(source.source),
    annotations: normalizeTrainingAnnotations(source.annotations),
    status: normalizeTrainingSampleStatus(source.status),
    uploadAttempts: Math.max(0, Number(source.uploadAttempts) || 0),
    uploadedAt: readString(source.uploadedAt) || null,
    remoteId: readString(source.remoteId) || null,
    lastError: readString(source.lastError) || null
  }
}

export async function readStateFromDisk(): Promise<TrainingDatasetState> {
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
      .map((item, index) => normalizeTrainingSample(item, index))
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

export async function writeStateToDisk(state: TrainingDatasetState): Promise<void> {
  await ensureTrainingDirectories()
  const nextState: TrainingDatasetState = {
    ...state,
    updatedAt: new Date().toISOString()
  }

  const tempFile = `${TRAINING_METADATA_FILE}.tmp`
  await fs.writeFile(tempFile, JSON.stringify(nextState, null, 2), "utf8")
  await fs.rename(tempFile, TRAINING_METADATA_FILE)
}

export function extensionFromMime(mime: string): string {
  if (mime === "image/png") return "png"
  if (mime === "image/webp") return "webp"
  return "jpg"
}

export function parseTrainingImageDataUrl(dataUrl: string): { mime: string; imageBuffer: Buffer } {
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

export function buildTrainingPublicImagePath(filename: string): string {
  return `/${TRAINING_IMAGE_PUBLIC_SUBDIR.replace(/\\/g, "/")}/${filename}`
}

export function resolveTrainingPublicPath(publicImagePath: string): string {
  const publicRoot = path.resolve(process.cwd(), "public")
  const cleaned = publicImagePath.replace(/^\/+/, "")
  const absolutePath = path.resolve(publicRoot, cleaned)
  if (!absolutePath.startsWith(publicRoot)) {
    throw new Error("Path image tidak valid.")
  }
  return absolutePath
}

export async function writeTrainingImageFile(filename: string, imageBuffer: Buffer): Promise<void> {
  await ensureTrainingDirectories()
  await fs.writeFile(path.join(TRAINING_IMAGE_DIR, filename), imageBuffer)
}

export async function deleteTrainingImageFile(publicImagePath: string): Promise<void> {
  const absoluteImagePath = resolveTrainingPublicPath(publicImagePath)
  await fs.unlink(absoluteImagePath).catch(() => undefined)
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

export async function readTrainingImageAsDataUrl(sample: TrainingSample): Promise<string> {
  const absoluteImagePath = resolveTrainingPublicPath(sample.publicImagePath)
  const imageBuffer = await fs.readFile(absoluteImagePath)
  return `data:${sample.mime};base64,${imageBuffer.toString("base64")}`
}
