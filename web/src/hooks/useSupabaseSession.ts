import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ensureDevAuthenticated } from '../lib/devAuth'
import { supabase } from '../lib/supabaseClient'

type Listener = (session: Session | null) => void
type ErrorListener = (message: string | null) => void

let cachedSession: Session | null | undefined
let cachedAuthError: string | null = null
let authReady = false
const listeners = new Set<Listener>()
const errorListeners = new Set<ErrorListener>()

function notify(session: Session | null) {
  cachedSession = session
  listeners.forEach((fn) => fn(session))
}

function notifyAuthError(message: string | null) {
  cachedAuthError = message
  errorListeners.forEach((fn) => fn(message))
}

function getCallbackParams(): URLSearchParams {
  const params = new URLSearchParams(window.location.search)
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
  const hashParams = new URLSearchParams(hash)
  hashParams.forEach((value, key) => {
    if (!params.has(key)) params.set(key, value)
  })
  return params
}

function clearAuthCallbackUrl() {
  if (!window.location.pathname.startsWith('/auth/callback') && !window.location.hash && !window.location.search) return
  window.history.replaceState(window.history.state, '', `${window.location.origin}/`)
}

async function completeAuthCallbackFromUrl(): Promise<Session | null> {
  if (typeof window === 'undefined') return null

  const params = getCallbackParams()
  const error = params.get('error_description') || params.get('error') || params.get('error_code')
  if (error) {
    notifyAuthError(error)
    clearAuthCallbackUrl()
    return null
  }

  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (accessToken && refreshToken) {
    const { data, error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (sessionError) {
      notifyAuthError(sessionError.message)
      clearAuthCallbackUrl()
      return null
    }
    notifyAuthError(null)
    notify(data.session)
    clearAuthCallbackUrl()
    return data.session
  }

  const code = params.get('code')
  if (code) {
    const { data, error: codeError } = await supabase.auth.exchangeCodeForSession(code)
    if (codeError) {
      notifyAuthError(codeError.message)
      clearAuthCallbackUrl()
      return null
    }
    notifyAuthError(null)
    notify(data.session)
    clearAuthCallbackUrl()
    return data.session
  }

  return null
}

function ensureAuthListener() {
  if (authReady) return
  authReady = true

  void (async () => {
    const callbackSession = await completeAuthCallbackFromUrl()
    if (callbackSession) return

    await ensureDevAuthenticated()
    const { data } = await supabase.auth.getSession()
    notify(data.session)
  })()

  supabase.auth.onAuthStateChange((_event, session) => {
    notify(session)
  })
}

/** Force-read the current session and notify all subscribers (after manual verify). */
export async function refreshSupabaseSession(): Promise<Session | null> {
  ensureAuthListener()
  const { data } = await supabase.auth.getSession()
  notify(data.session)
  return data.session
}

/**
 * Shared Supabase auth session — works in dev and production.
 * Restores persisted sessions from localStorage on load.
 */
export function useSupabaseSession() {
  const [session, setSession] = useState<Session | null | undefined>(cachedSession)
  const [authError, setAuthError] = useState<string | null>(cachedAuthError)
  const loading = session === undefined

  useEffect(() => {
    ensureAuthListener()

    const onChange: Listener = (next) => setSession(next)
    const onError: ErrorListener = (next) => setAuthError(next)
    listeners.add(onChange)
    errorListeners.add(onError)

    if (cachedSession !== undefined) {
      onChange(cachedSession)
    }
    onError(cachedAuthError)

    return () => {
      listeners.delete(onChange)
      errorListeners.delete(onError)
    }
  }, [])

  return {
    session: session ?? null,
    loading,
    isAuthenticated: !!session,
    authError,
  }
}
