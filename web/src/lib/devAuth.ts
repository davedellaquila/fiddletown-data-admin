/**
 * Dev-only automatic Supabase sign-in (no magic link).
 * Requires VITE_DEV_AUTH_EMAIL + VITE_DEV_AUTH_PASSWORD in web/.env.local.
 * @see docs/DEVELOPMENT_AUTH.md
 */
import { IS_DEVELOPMENT_MODE } from './devMode'
import { supabase } from './supabaseClient'

let devSignInPromise: Promise<boolean> | null = null
let lastDevAuthError: string | null = null

export function isDevPasswordAuthConfigured(): boolean {
  if (!IS_DEVELOPMENT_MODE) return false
  const email = import.meta.env.VITE_DEV_AUTH_EMAIL
  const password = import.meta.env.VITE_DEV_AUTH_PASSWORD
  return Boolean(email?.trim() && password)
}

export function getDevAuthError(): string | null {
  return lastDevAuthError
}

/**
 * In dev mode, sign in with email/password from env when no session exists.
 * Returns true if a session is available after this call.
 */
export async function ensureDevAuthenticated(): Promise<boolean> {
  if (!IS_DEVELOPMENT_MODE || !isDevPasswordAuthConfigured()) {
    return false
  }

  const { data: existing } = await supabase.auth.getSession()
  if (existing.session) {
    lastDevAuthError = null
    return true
  }

  if (!devSignInPromise) {
    devSignInPromise = (async () => {
      const email = import.meta.env.VITE_DEV_AUTH_EMAIL!.trim()
      const password = import.meta.env.VITE_DEV_AUTH_PASSWORD!

      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        lastDevAuthError = error.message
        console.error('[dev auth] Auto sign-in failed:', error.message)
        return false
      }

      lastDevAuthError = null
      console.info('[dev auth] Signed in automatically as', email)
      return true
    })().finally(() => {
      devSignInPromise = null
    })
  }

  return devSignInPromise
}
