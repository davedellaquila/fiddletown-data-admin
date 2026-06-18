import { supabase } from './supabaseClient'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const MAGIC_LINK_COOLDOWN_MS = 120_000
const LAST_MAGIC_LINK_ATTEMPT_KEY = 'lastMagicLinkAttemptAt'

export function getAuthRedirectUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin
  return 'http://localhost:5173'
}

export function getMagicLinkCooldownSeconds(now = Date.now()): number {
  if (typeof window === 'undefined') return 0
  const lastAttempt = Number(localStorage.getItem(LAST_MAGIC_LINK_ATTEMPT_KEY) || 0)
  if (!Number.isFinite(lastAttempt) || lastAttempt <= 0) return 0
  const remainingMs = lastAttempt + MAGIC_LINK_COOLDOWN_MS - now
  return Math.max(0, Math.ceil(remainingMs / 1000))
}

function recordMagicLinkAttempt() {
  if (typeof window === 'undefined') return
  localStorage.setItem(LAST_MAGIC_LINK_ATTEMPT_KEY, String(Date.now()))
}

function formatVerifyError(message: string): string {
  if (/invalid|expired|already been used/i.test(message)) {
    return 'This magic link was already used or has expired. Send a new link from the form above, then paste it here without opening it in your default browser first.'
  }
  return message
}

function formatMagicLinkError(message: string, status?: number, code?: string): string {
  if (
    status === 429 ||
    code === 'over_email_send_rate_limit' ||
    /rate limit|seconds|wait/i.test(message)
  ) {
    return 'Supabase rejected the magic link email: email rate limit reached. This usually means the Auth SMTP or rate-limit settings are not active yet, or the project email quota is still exhausted.'
  }
  return message || 'Failed to send magic link'
}

export function isMagicLinkRateLimitMessage(message: string | null): boolean {
  if (!message) return false
  return /already requested|try again in|wait (about )?(60 seconds|a couple of minutes)/i.test(message)
}

export type MagicLinkResult =
  | { ok: true }
  | { ok: false; message: string }

function failure(message: string): Extract<MagicLinkResult, { ok: false }> {
  return { ok: false, message }
}

export async function sendMagicLinkEmail(email: string): Promise<MagicLinkResult> {
  const trimmed = email.trim()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return failure('Please enter a valid email address')
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: { emailRedirectTo: getAuthRedirectUrl() },
  })

  if (error) {
    return failure(formatMagicLinkError(error.message, error.status, error.code))
  }

  recordMagicLinkAttempt()
  localStorage.setItem('lastEmail', trimmed)
  return { ok: true as const }
}

type ParsedMagicLink =
  | { kind: 'verify'; token: string; type: string }
  | { kind: 'callback'; url: string }

function normalizeQueryString(input: string): string {
  let value = input.trim()
  if (!value) return ''

  if (value.includes('://')) {
    try {
      const parsed = new URL(value)
      if (parsed.hash.includes('access_token=')) {
        return `__callback__:${parsed.href}`
      }
      return parsed.search
    } catch {
      return ''
    }
  }

  if (!value.startsWith('?')) {
    // Email clients sometimes copy from the middle: "abc…&type=magiclink&redirect_to=…"
    if (!value.includes('token=') && /^[A-Za-z0-9._-]+&/.test(value)) {
      value = `token=${value}`
    } else if (!value.startsWith('token=')) {
      value = `?${value}`
    } else {
      value = `?${value}`
    }
  }

  return value.startsWith('?') ? value : `?${value}`
}

/** Parse a full magic link URL, query string, or auth callback from the user. */
export function parseMagicLinkInput(input: string): ParsedMagicLink | null {
  const normalized = normalizeQueryString(input)
  if (!normalized) return null

  if (normalized.startsWith('__callback__:')) {
    return { kind: 'callback', url: normalized.slice('__callback__:'.length) }
  }

  const params = new URLSearchParams(normalized)
  const token = params.get('token') ?? params.get('token_hash')
  const type = params.get('type') ?? 'magiclink'

  if (!token || token.length < 8) return null
  return { kind: 'verify', token, type }
}

/**
 * Complete magic-link sign-in inside the current browser (no external browser needed).
 * Verifies the token via Supabase API instead of relying on navigation alone.
 */
export async function completeMagicLinkSignIn(
  input: string,
  refreshSession: () => Promise<unknown>
): Promise<MagicLinkResult> {
  const parsed = parseMagicLinkInput(input)
  if (!parsed) {
    return failure(
      'Could not read a magic link token. Right-click the email button → Copy Link, then paste the full URL (starts with https://…supabase.co/auth/v1/verify).'
    )
  }

  if (parsed.kind === 'callback') {
    window.location.assign(parsed.url)
    return { ok: true as const }
  }

  const otpTypes = parsed.type === 'magiclink'
    ? (['magiclink', 'email'] as const)
    : ([parsed.type] as const)

  let lastError: string | null = null
  for (const otpType of otpTypes) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: parsed.token,
      type: otpType as 'magiclink' | 'email' | 'signup' | 'invite' | 'recovery',
    })

    if (!error && data.session) {
      await refreshSession()
      return { ok: true as const }
    }
    lastError = error?.message ?? 'Link verified but no session was created.'
  }

  if (lastError) {
    return failure(formatVerifyError(lastError))
  }

  return failure('Could not sign in with this link. Request a new magic link and try again.')
}

/** Build the Supabase verify URL for pasting into the Simple Browser address bar. */
export function buildMagicLinkVerifyUrl(input: string): string | null {
  const parsed = parseMagicLinkInput(input)
  if (!parsed || parsed.kind !== 'verify' || !SUPABASE_URL) return null
  return `${SUPABASE_URL}/auth/v1/verify?token=${encodeURIComponent(parsed.token)}&type=${encodeURIComponent(parsed.type)}&redirect_to=${encodeURIComponent(getAuthRedirectUrl())}`
}
