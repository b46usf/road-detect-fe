"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"

type CameraStatus = "starting" | "active" | "idle" | "error"

function mapCameraError(error: unknown): string {
  if (!(error instanceof DOMException)) {
    return "Tidak bisa mengakses kamera. Cek izin kamera di browser."
  }

  switch (error.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Izin kamera ditolak. Aktifkan izin kamera di browser."
    case "NotFoundError":
      return "Kamera tidak ditemukan pada perangkat ini."
    case "NotReadableError":
    case "TrackStartError":
      return "Kamera sedang dipakai aplikasi lain. Tutup aplikasi kamera lain lalu coba lagi."
    case "OverconstrainedError":
      return "Mode kamera belakang tidak tersedia. Coba pakai kamera default."
    case "SecurityError":
      return "Akses kamera diblokir. Gunakan HTTPS atau localhost."
    default:
      return `Gagal mengakses kamera (${error.name}).`
  }
}

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mountedRef = useRef(false)

  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<CameraStatus>("starting")
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null)
  const [lastSnapshotAt, setLastSnapshotAt] = useState<Date | null>(null)

  const captureFrame = useCallback(() => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      return
    }

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas")
    }

    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const context = canvas.getContext("2d")
    if (!context) {
      return
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    setSnapshotUrl(canvas.toDataURL("image/jpeg", 0.8))
    setLastSnapshotAt(new Date())
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    setStatus("starting")
    setError(null)
    setSnapshotUrl(null)
    setLastSnapshotAt(null)
    stopCamera()

    if (!window.isSecureContext) {
      setError("Halaman tidak aman. Kamera hanya bisa diakses lewat HTTPS atau localhost.")
      setStatus("error")
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Browser tidak mendukung akses kamera (getUserMedia).")
      setStatus("error")
      return
    }

    try {
      let stream: MediaStream

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false
        })
      } catch (err) {
        if (
          err instanceof DOMException &&
          (err.name === "OverconstrainedError" || err.name === "NotFoundError")
        ) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          })
        } else {
          throw err
        }
      }

      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }

      setStatus("active")
    } catch (err) {
      if (!mountedRef.current) {
        return
      }

      setError(mapCameraError(err))
      setStatus("error")
    }
  }, [stopCamera])

  const handleStopCamera = useCallback(() => {
    stopCamera()
    setError(null)
    setStatus("idle")
  }, [stopCamera])

  const handleDownloadSnapshot = useCallback(() => {
    if (!snapshotUrl) {
      return
    }

    const captureTime = lastSnapshotAt ?? new Date()
    const datePart = [
      captureTime.getFullYear(),
      String(captureTime.getMonth() + 1).padStart(2, "0"),
      String(captureTime.getDate()).padStart(2, "0")
    ].join("")
    const timePart = [
      String(captureTime.getHours()).padStart(2, "0"),
      String(captureTime.getMinutes()).padStart(2, "0"),
      String(captureTime.getSeconds()).padStart(2, "0")
    ].join("")

    const anchor = document.createElement("a")
    anchor.href = snapshotUrl
    anchor.download = `snapshot-jalan-${datePart}-${timePart}.jpg`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  }, [lastSnapshotAt, snapshotUrl])

  useEffect(() => {
    mountedRef.current = true
    startCamera()

    return () => {
      mountedRef.current = false
      stopCamera()
    }
  }, [startCamera, stopCamera])

  useEffect(() => {
    if (status !== "active") {
      return
    }

    captureFrame()
    const intervalId = window.setInterval(captureFrame, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [captureFrame, status])

  const statusTone =
    status === "active"
      ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
      : status === "error"
        ? "border-rose-300/40 bg-rose-400/15 text-rose-100"
        : status === "idle"
          ? "border-amber-300/40 bg-amber-400/15 text-amber-100"
          : "border-cyan-300/40 bg-cyan-400/15 text-cyan-100"

  const statusLabel =
    status === "active"
      ? "Kamera Aktif"
      : status === "error"
        ? "Perlu Tindakan"
        : status === "idle"
          ? "Kamera Berhenti"
          : "Memulai Kamera"

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100 [font-family:var(--font-geist-sans)]">
      <div className="pointer-events-none absolute -left-16 top-10 h-56 w-56 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-0 h-56 w-56 rounded-full bg-emerald-500/20 blur-3xl" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
        <header className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/90">Live Detection</p>
              <h1 className="mt-1 text-xl font-semibold sm:text-2xl">Deteksi Jalan Realtime</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Arahkan kamera ke permukaan jalan dan jaga posisi stabil untuk hasil visual yang lebih jelas.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusTone}`}>
                {statusLabel}
              </span>
              <Link
                href="/"
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-medium text-slate-100 transition hover:bg-white/10"
              >
                Kembali
              </Link>
            </div>
          </div>
        </header>

        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
          <div className="relative aspect-[9/16] w-full md:aspect-[16/9]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />

            {status === "starting" && (
              <div className="absolute inset-0 grid place-items-center bg-slate-950/70">
                <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
                  Memulai kamera...
                </div>
              </div>
            )}

            {status === "idle" && (
              <div className="absolute inset-0 grid place-items-center bg-slate-950/75 p-4">
                <div className="rounded-xl border border-white/15 bg-black/45 px-4 py-3 text-center text-sm text-slate-200">
                  Kamera sedang tidak aktif.
                </div>
              </div>
            )}

            {status === "error" && error && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 p-4">
                <div className="max-w-md rounded-2xl border border-rose-300/35 bg-rose-950/45 p-5 text-center">
                  <p className="text-sm leading-relaxed text-rose-100">{error}</p>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="mt-4 rounded-lg bg-rose-300 px-4 py-2 text-sm font-semibold text-rose-950 transition hover:bg-rose-200"
                  >
                    Coba Lagi
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold sm:text-base">Snapshot Frame</h2>
              <span className="text-xs text-slate-400">Auto update ~1 detik</span>
            </div>

            <button
              type="button"
              onClick={handleDownloadSnapshot}
              disabled={!snapshotUrl}
              className="rounded-lg bg-emerald-300 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-slate-700"
            >
              Simpan Snapshot
            </button>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/60">
            <div className="relative aspect-[16/9] w-full">
              {snapshotUrl ? (
                <img
                  src={snapshotUrl}
                  alt="Snapshot frame dari video kamera"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full place-items-center p-4 text-sm text-slate-400">
                  Menunggu frame dari kamera...
                </div>
              )}
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            {lastSnapshotAt
              ? `Update terakhir: ${lastSnapshotAt.toLocaleTimeString("id-ID")}`
              : "Snapshot akan tampil setelah video aktif."}
          </p>
        </div>

        <footer className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:p-5">
          <div className="grid gap-2 text-sm text-slate-300 md:grid-cols-3">
            <p>1. Pastikan browser sudah mendapat izin kamera.</p>
            <p>2. Gunakan koneksi HTTPS atau localhost.</p>
            <p>3. Hindari aplikasi lain yang sedang memakai kamera.</p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startCamera}
              className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Muat Ulang Kamera
            </button>
            <button
              type="button"
              onClick={handleStopCamera}
              className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
            >
              Matikan Kamera
            </button>
          </div>
        </footer>
      </section>
    </main>
  )
}
