"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useEffect, useState } from "react"
import {
  ADMIN_DEFAULT_PASSWORD,
  ADMIN_DEFAULT_USERNAME,
  readAdminSession,
  validateAdminCredentials,
  writeAdminSession
} from "@/lib/admin-storage"

export default function AdminLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const session = readAdminSession()
    if (session) {
      router.replace("/admin/dashboard")
    }
  }, [router])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)

    if (!validateAdminCredentials(username, password)) {
      setError("Username atau password admin tidak valid.")
      setIsSubmitting(false)
      return
    }

    writeAdminSession(username)
    setError(null)
    router.replace("/admin/dashboard")
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100 [font-family:var(--font-geist-sans)]">
      <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10 sm:px-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm sm:p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/90">Admin Portal</p>
          <h1 className="mt-2 text-2xl font-semibold">Login Dashboard</h1>
          <p className="mt-2 text-sm text-slate-300">
            Gunakan kredensial admin untuk melihat riwayat deteksi yang tersimpan di localStorage browser ini.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-300">Username</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="admin"
                autoComplete="username"
                className="w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300/70"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-slate-300">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="********"
                autoComplete="current-password"
                className="w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300/70"
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Masuk Admin
            </button>
          </form>

          {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/camera"
              className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-medium transition hover:bg-white/10"
            >
              Buka Kamera
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-medium transition hover:bg-white/10"
            >
              Kembali Home
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
