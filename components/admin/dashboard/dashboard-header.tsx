import Image from "next/image"
import {
  ROADSTER_ADMIN_DESCRIPTION,
  ROADSTER_LOGO_ALT,
  ROADSTER_LOGO_PATH,
  ROADSTER_NAME
} from "@/lib/app-brand"
import { formatPercent } from "@/lib/ui-utils"

export interface DashboardSummaryStats {
  total: number
  avgDamage: number
  heavyCount: number
  withGps: number
}

interface DashboardHeaderProps {
  username: string | null | undefined
  stats: DashboardSummaryStats
  rfStats: { invalidCount: number; lastInvalidAt?: number } | null
  onRefresh: () => void
  onClearHistory: () => void
  onLogout: () => void
}

export default function DashboardHeader(props: DashboardHeaderProps) {
  const { username, stats, rfStats, onRefresh, onClearHistory, onLogout } = props

  return (
    <header className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-200/90">
            <Image
              src={ROADSTER_LOGO_PATH}
              alt={ROADSTER_LOGO_ALT}
              width={16}
              height={16}
              className="h-4 w-4 rounded-sm object-cover"
            />
            {ROADSTER_NAME} Admin
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Monitoring Deteksi + GIS Dashboard</h1>
          <p className="mt-2 text-sm text-slate-300">
            {ROADSTER_ADMIN_DESCRIPTION}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Login aktif: <span className="font-medium text-slate-100">{username}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-medium transition hover:bg-white/10"
          >
            Refresh Data
          </button>
          <button
            type="button"
            onClick={onClearHistory}
            className="rounded-lg border border-rose-300/40 bg-rose-400/15 px-3 py-2 text-xs font-medium text-rose-100 transition hover:bg-rose-400/25"
          >
            Hapus Riwayat
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <article className="h-full rounded-xl border border-white/10 bg-black/35 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Total Record</p>
          <p className="mt-1 text-xl font-semibold">{stats.total}</p>
        </article>
        <article className="h-full rounded-xl border border-white/10 bg-black/35 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Rata Luasan</p>
          <p className="mt-1 text-xl font-semibold">{formatPercent(stats.avgDamage)}</p>
        </article>
        <article className="h-full rounded-xl border border-white/10 bg-black/35 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Kasus Berat</p>
          <p className="mt-1 text-xl font-semibold">{stats.heavyCount}</p>
        </article>
        <article className="h-full rounded-xl border border-white/10 bg-black/35 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Data Dengan GPS</p>
          <p className="mt-1 text-xl font-semibold">{stats.withGps}</p>
        </article>
        <article className="h-full rounded-xl border border-amber-200/10 bg-black/35 p-3">
          <p className="text-[11px] uppercase tracking-wide text-amber-200/80">Roboflow Key Invalids</p>
          <p className="mt-1 text-xl font-semibold text-amber-200">
            {rfStats ? rfStats.invalidCount : "-"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Last: {rfStats?.lastInvalidAt ? new Date(rfStats.lastInvalidAt).toLocaleString("id-ID") : "-"}
          </p>
        </article>
      </div>
    </header>
  )
}
