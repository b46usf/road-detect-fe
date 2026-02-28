import { ADMIN_DEFAULT_PASSWORD, ADMIN_DEFAULT_USERNAME, ADMIN_SESSION_STORAGE_KEY } from "./constants"
import { canUseLocalStorage, parseJson } from "./local-storage"
import type { AdminSession } from "./types"

export function validateAdminCredentials(username: string, password: string): boolean {
  return username.trim().toLowerCase() === ADMIN_DEFAULT_USERNAME && password === ADMIN_DEFAULT_PASSWORD
}

export function readAdminSession(): AdminSession | null {
  if (!canUseLocalStorage()) {
    return null
  }

  const raw = window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY)
  const parsed = parseJson<AdminSession | null>(raw, null)

  if (!parsed || typeof parsed !== "object") {
    return null
  }

  if (typeof parsed.username !== "string" || parsed.username.trim().length === 0) {
    return null
  }

  if (typeof parsed.loggedInAt !== "string" || parsed.loggedInAt.trim().length === 0) {
    return null
  }

  return parsed
}

export function writeAdminSession(username: string): void {
  if (!canUseLocalStorage()) {
    return
  }

  const session: AdminSession = {
    username: username.trim().toLowerCase(),
    loggedInAt: new Date().toISOString()
  }

  window.localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(session))
}

export function clearAdminSession(): void {
  if (!canUseLocalStorage()) {
    return
  }

  window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY)
}
