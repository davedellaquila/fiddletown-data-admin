import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ensureDevAuthenticated } from '../lib/devAuth'
import { supabase } from '../lib/supabaseClient'

type Listener = (session: Session | null) => void

let cachedSession: Session | null | undefined
let authReady = false
const listeners = new Set<Listener>()

function notify(session: Session | null) {
  cachedSession = session
  listeners.forEach((fn) => fn(session))
}

function ensureAuthListener() {
  if (authReady) return
  authReady = true

  void (async () => {
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
  const loading = session === undefined

  useEffect(() => {
    ensureAuthListener()

    const onChange: Listener = (next) => setSession(next)
    listeners.add(onChange)

    if (cachedSession !== undefined) {
      onChange(cachedSession)
    }

    return () => {
      listeners.delete(onChange)
    }
  }, [])

  return {
    session: session ?? null,
    loading,
    isAuthenticated: !!session,
  }
}
