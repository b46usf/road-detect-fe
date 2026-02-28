import type { ApiStatus, CameraStatus, GpsStatus } from "./types"

export function mapCameraError(error: unknown): string {
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

export function mapGeolocationError(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Izin lokasi ditolak. Aktifkan GPS/location permission di browser."
    case error.POSITION_UNAVAILABLE:
      return "Lokasi tidak tersedia. Pastikan GPS/GNSS aktif."
    case error.TIMEOUT:
      return "Permintaan lokasi timeout. Coba lagi di area dengan sinyal lebih baik."
    default:
      return "Gagal membaca lokasi GPS."
  }
}

export function formatConfidence(value: number | null): string | null {
  if (value === null) {
    return null
  }

  return `${Math.max(0, Math.min(100, value)).toFixed(1)}%`
}

export function getCameraStatusBadge(status: CameraStatus): { tone: string; label: string } {
  if (status === "active") {
    return {
      tone: "border-emerald-300/40 bg-emerald-400/15 text-emerald-100",
      label: "Kamera Aktif"
    }
  }

  if (status === "error") {
    return {
      tone: "border-rose-300/40 bg-rose-400/15 text-rose-100",
      label: "Perlu Tindakan"
    }
  }

  if (status === "idle") {
    return {
      tone: "border-amber-300/40 bg-amber-400/15 text-amber-100",
      label: "Kamera Berhenti"
    }
  }

  return {
    tone: "border-cyan-300/40 bg-cyan-400/15 text-cyan-100",
    label: "Memulai Kamera"
  }
}

export function getApiStatusBadge(status: ApiStatus): { tone: string; label: string } {
  if (status === "success") {
    return {
      tone: "border-emerald-300/40 bg-emerald-400/15 text-emerald-100",
      label: "API Sukses"
    }
  }

  if (status === "error") {
    return {
      tone: "border-rose-300/40 bg-rose-400/15 text-rose-100",
      label: "API Error"
    }
  }

  return {
    tone: "border-slate-300/30 bg-slate-300/10 text-slate-200",
    label: "API Menunggu"
  }
}

export function getGpsStatusBadge(status: GpsStatus): { tone: string; label: string } {
  if (status === "ready") {
    return {
      tone: "border-emerald-300/40 bg-emerald-400/15 text-emerald-100",
      label: "GPS Ready"
    }
  }

  if (status === "error") {
    return {
      tone: "border-rose-300/40 bg-rose-400/15 text-rose-100",
      label: "GPS Error"
    }
  }

  if (status === "unsupported") {
    return {
      tone: "border-amber-300/40 bg-amber-400/15 text-amber-100",
      label: "GPS Unsupported"
    }
  }

  return {
    tone: "border-cyan-300/40 bg-cyan-400/15 text-cyan-100",
    label: "GPS Tracking"
  }
}
