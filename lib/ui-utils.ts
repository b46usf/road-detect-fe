export type SeverityLike = "ringan" | "sedang" | "berat" | "tidak-terdeteksi"

export function formatPercent(value: number): string {
  return `${Math.max(0, Math.min(100, value)).toFixed(1)}%`
}

export function severityLabel(severity: SeverityLike): string {
  if (severity === "ringan") return "Ringan"
  if (severity === "sedang") return "Sedang"
  if (severity === "berat") return "Berat"
  return "Tidak Terdeteksi"
}

export function dominantSeverityLabel(severity: SeverityLike): string {
  return severity === "tidak-terdeteksi" ? "Tidak Terdeteksi" : severityLabel(severity)
}

export function getSeverityStyles(severity: SeverityLike): { boxClass: string; labelClass: string } {
  if (severity === "berat") {
    return { boxClass: "border-rose-300/95", labelClass: "bg-rose-700/80 text-rose-50" }
  }
  if (severity === "sedang") {
    return { boxClass: "border-amber-300/95", labelClass: "bg-amber-700/80 text-amber-50" }
  }
  return { boxClass: "border-emerald-300/95", labelClass: "bg-emerald-700/80 text-emerald-50" }
}

export function severityTone(value: SeverityLike): string {
  if (value === "berat") return "border-rose-300/45 bg-rose-400/15 text-rose-100"
  if (value === "sedang") return "border-amber-300/45 bg-amber-400/15 text-amber-100"
  if (value === "ringan") return "border-emerald-300/45 bg-emerald-400/15 text-emerald-100"
  return "border-slate-300/35 bg-slate-300/10 text-slate-200"
}

export function boolLabel(value: boolean): string {
  return value ? "Aktif" : "Nonaktif"
}
