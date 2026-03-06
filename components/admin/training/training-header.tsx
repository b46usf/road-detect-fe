import Image from "next/image"
import Link from "next/link"
import {
  ROADSTER_ADMIN_DESCRIPTION,
  ROADSTER_EXPANDED_NAME,
  ROADSTER_LOGO_ALT,
  ROADSTER_LOGO_PATH,
  ROADSTER_NAME
} from "@/lib/app-brand"

interface TrainingHeaderProps {
  username: string | null
  totalSamples: number
  queued: number
  uploaded: number
  failed: number
  onLogout: () => void
}

export default function TrainingHeader(props: TrainingHeaderProps) {
  const { username, totalSamples, queued, uploaded, failed, onLogout } = props

  return (
    <header className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:p-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-start">
        <div>
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-200/90">
            <Image
              src={ROADSTER_LOGO_PATH}
              alt={ROADSTER_LOGO_ALT}
              width={16}
              height={16}
              className="h-4 w-4 rounded-sm object-cover"
            />
            Training Module
          </p>
          <h1 className="mt-1 text-3xl font-bold leading-none tracking-tight sm:text-4xl">
            {ROADSTER_NAME}
          </h1>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-cyan-100/90 sm:text-sm md:text-base">
            {ROADSTER_EXPANDED_NAME}
          </p>
          <p className="mt-2 text-sm text-slate-300">{ROADSTER_ADMIN_DESCRIPTION}</p>
          <p className="mt-1 text-xs text-slate-400">
            Login aktif: <span className="font-medium text-slate-100">{username ?? "-"}</span>
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Menu Cepat</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
            <Link
              href="/admin/dashboard"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-center text-xs font-medium transition hover:bg-white/10"
            >
              Dashboard
            </Link>
            <Link
              href="/camera"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-cyan-300/35 bg-cyan-400/15 px-3 py-2 text-center text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/25"
            >
              Buka Camera
            </Link>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-cyan-300 px-3 py-2 text-center text-xs font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <article className="rounded-xl border border-white/10 bg-black/35 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Total Sample</p>
          <p className="mt-1 text-xl font-semibold">{totalSamples}</p>
        </article>
        <article className="rounded-xl border border-amber-300/20 bg-black/35 p-3">
          <p className="text-[11px] uppercase tracking-wide text-amber-100/80">Queued</p>
          <p className="mt-1 text-xl font-semibold text-amber-100">{queued}</p>
        </article>
        <article className="rounded-xl border border-emerald-300/20 bg-black/35 p-3">
          <p className="text-[11px] uppercase tracking-wide text-emerald-100/80">Uploaded</p>
          <p className="mt-1 text-xl font-semibold text-emerald-100">{uploaded}</p>
        </article>
        <article className="rounded-xl border border-rose-300/20 bg-black/35 p-3">
          <p className="text-[11px] uppercase tracking-wide text-rose-100/80">Failed</p>
          <p className="mt-1 text-xl font-semibold text-rose-100">{failed}</p>
        </article>
      </div>
    </header>
  )
}
