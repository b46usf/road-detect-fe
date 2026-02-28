import Link from "next/link"
import Image from "next/image"
import type { Metadata } from "next"
import {
  ROADSTER_FULL_NAME,
  ROADSTER_HOME_DESCRIPTION,
  ROADSTER_LOGO_ALT,
  ROADSTER_LOGO_PATH,
  ROADSTER_NAME
} from "@/lib/app-brand"

const highlights = [
  {
    title: "AI Recognition Realtime",
    description: "ROADSTER membaca indikasi kerusakan jalan secara cepat langsung dari kamera perangkat."
  },
  {
    title: "Siap Untuk Tim Lapangan",
    description: "Alur dibuat ringkas agar proses identifikasi, validasi, dan pelaporan jalan lebih efisien."
  },
  {
    title: "GIS-Ready Monitoring",
    description: "Hasil deteksi dapat dipantau dari dashboard admin lengkap dengan konteks spasial dan statistik."
  }
]

export const metadata: Metadata = {
  title: {
    absolute: ROADSTER_FULL_NAME
  },
  description: ROADSTER_HOME_DESCRIPTION
}

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100 [font-family:var(--font-geist-sans)]">
      <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-10 px-6 py-14 md:py-20">
        <div className="space-y-6 text-center md:text-left">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-sm text-slate-200">
            <Image
              src={ROADSTER_LOGO_PATH}
              alt={ROADSTER_LOGO_ALT}
              width={18}
              height={18}
              className="h-[18px] w-[18px] rounded-sm object-cover"
              priority
            />
            {ROADSTER_NAME}
          </p>

          <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
            {ROADSTER_FULL_NAME}
          </h1>

          <p className="max-w-2xl text-base text-slate-300 md:text-lg">
            {ROADSTER_HOME_DESCRIPTION}
          </p>

          <div className="flex flex-col items-center gap-3 sm:flex-row md:items-start">
            <Link
              href="/camera"
              className="inline-flex items-center justify-center rounded-xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Mulai ROADSTER Camera
            </Link>
            <Link
              href="/admin/login"
              className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/10 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/20"
            >
              Login Admin
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {highlights.map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm"
            >
              <h2 className="text-lg font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{item.description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
