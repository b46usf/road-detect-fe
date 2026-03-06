"use client"

import { useCallback, useMemo, useState, type FormEvent } from "react"
import TrainingAnnotationCanvasEditor from "@/components/admin/training/training-annotation-canvas-editor"
import type {
  CreateTrainingSampleInput,
  TrainingAnnotation,
  TrainingLabel,
  TrainingSeverity
} from "@/lib/training-types"
import {
  TRAINING_LABEL_OPTIONS,
  TRAINING_SEVERITY_OPTIONS
} from "@/components/admin/training/training-shared"

interface TrainingUploadFormProps {
  onSubmit: (input: CreateTrainingSampleInput) => Promise<void>
  isSubmitting: boolean
  statusMessage: string | null
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : ""
      if (!value) {
        reject(new Error("File tidak bisa dibaca."))
        return
      }
      resolve(value)
    }
    reader.onerror = () => reject(new Error("Gagal membaca file image."))
    reader.readAsDataURL(file)
  })
}

function readImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error("Dimensi image gagal dibaca."))
    image.src = dataUrl
  })
}

export default function TrainingUploadForm(props: TrainingUploadFormProps) {
  const { onSubmit, isSubmitting, statusMessage } = props

  const [imageDataUrl, setImageDataUrl] = useState("")
  const [imageWidth, setImageWidth] = useState(0)
  const [imageHeight, setImageHeight] = useState(0)
  const [filename, setFilename] = useState("")
  const [label, setLabel] = useState<TrainingLabel>("pothole")
  const [severity, setSeverity] = useState<TrainingSeverity>("sedang")
  const [notes, setNotes] = useState("")
  const [annotations, setAnnotations] = useState<TrainingAnnotation[]>([])
  const [localMessage, setLocalMessage] = useState<string | null>(null)

  const previewReady = useMemo(() => imageDataUrl.length > 0, [imageDataUrl])

  const handleFileChange = useCallback(async (file: File | null) => {
    if (!file) {
      setImageDataUrl("")
      setImageWidth(0)
      setImageHeight(0)
      setFilename("")
      setAnnotations([])
      return
    }

    setLocalMessage(null)
    try {
      const dataUrl = await fileToDataUrl(file)
      const dimensions = await readImageDimensions(dataUrl)
      setImageDataUrl(dataUrl)
      setImageWidth(dimensions.width)
      setImageHeight(dimensions.height)
      setFilename(file.name)
      setAnnotations([])
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "File gagal diproses."
      setLocalMessage(message)
    }
  }, [])

  const resetForm = useCallback(() => {
    setImageDataUrl("")
    setImageWidth(0)
    setImageHeight(0)
    setFilename("")
    setLabel("pothole")
    setSeverity("sedang")
    setNotes("")
    setAnnotations([])
  }, [])

  const submitForm = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!imageDataUrl) {
        setLocalMessage("Pilih image dulu sebelum submit.")
        return
      }

      if (annotations.length === 0) {
        setLocalMessage("Buat minimal satu bounding box sebelum submit sample.")
        return
      }

      setLocalMessage(null)
      await onSubmit({
        imageDataUrl,
        imageWidth,
        imageHeight,
        label,
        severity,
        annotations,
        notes,
        source: "admin-upload"
      })
      resetForm()
    },
    [annotations, imageDataUrl, imageHeight, imageWidth, label, notes, onSubmit, resetForm, severity]
  )

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:p-5">
      <h2 className="text-lg font-semibold text-slate-100">Input Sample Training</h2>
      <p className="mt-1 text-sm text-slate-300">
        Upload image dari lapangan ke folder `public/img/training` dan simpan metadata ke JSON.
      </p>

      <form className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]" onSubmit={submitForm}>
        <div className="space-y-3">
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-300">
            Image Sample
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0] ?? null
                void handleFileChange(file)
              }}
              className="mt-2 block w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-300">
              Label
              <select
                value={label}
                onChange={(event) => setLabel(event.currentTarget.value as TrainingLabel)}
                className="mt-2 block w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
              >
                {TRAINING_LABEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium uppercase tracking-wide text-slate-300">
              Severity
              <select
                value={severity}
                onChange={(event) => setSeverity(event.currentTarget.value as TrainingSeverity)}
                className="mt-2 block w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
              >
                {TRAINING_SEVERITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-xs font-medium uppercase tracking-wide text-slate-300">
            Catatan
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.currentTarget.value)}
              placeholder="Lokasi, kondisi jalan, atau konteks tambahan..."
              rows={3}
              className="mt-2 block w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
            />
          </label>

          {previewReady && (
            <TrainingAnnotationCanvasEditor
              imageSrc={imageDataUrl}
              imageWidth={imageWidth}
              imageHeight={imageHeight}
              annotations={annotations}
              onChange={setAnnotations}
              defaultLabel={label}
              title="Canvas Bounding Box Editor"
            />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Menyimpan..." : "Simpan Sample"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              disabled={isSubmitting}
              className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Reset
            </button>
          </div>

          {(localMessage || statusMessage) && (
            <p className="rounded-lg border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">
              {localMessage ?? statusMessage}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/35 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Preview</p>
          {previewReady ? (
            <div className="mt-2 space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageDataUrl}
                alt={filename || "Training sample preview"}
                className="h-48 w-full rounded-lg border border-white/10 object-cover"
              />
              <p className="truncate text-xs text-slate-300">{filename || "Unnamed image"}</p>
              <p className="text-[11px] text-slate-400">
                {imageWidth}x{imageHeight}px
              </p>
              <p className="text-[11px] text-slate-400">{annotations.length} box siap disimpan</p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-400">Belum ada image dipilih.</p>
          )}
        </div>
      </form>
    </section>
  )
}
