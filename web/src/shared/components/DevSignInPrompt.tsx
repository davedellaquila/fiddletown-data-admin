import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  buildMagicLinkVerifyUrl,
  completeMagicLinkSignIn,
  getAuthRedirectUrl,
  getMagicLinkCooldownSeconds,
  isMagicLinkRateLimitMessage,
  sendMagicLinkEmail,
} from '../../lib/magicLinkAuth'

interface DevSignInPromptProps {
  darkMode: boolean
  title?: string
  description?: string
}

/**
 * Magic-link sign-in for dev mode modules that require authenticated Supabase access.
 */
export default function DevSignInPrompt({
  darkMode,
  title = 'Sign in to load live data',
  description = 'Candidates require an authenticated Supabase session. Send a magic link, then complete sign-in in this same browser window.',
}: DevSignInPromptProps) {
  const [email, setEmail] = useState('')
  const [pastedLink, setPastedLink] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [justSent, setJustSent] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [magicLinkCooldown, setMagicLinkCooldown] = useState(() => getMagicLinkCooldownSeconds())
  const linkFieldRef = useRef<HTMLTextAreaElement>(null)

  const resizeLinkField = () => {
    const el = linkFieldRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(220, el.scrollHeight)}px`
  }

  useLayoutEffect(() => {
    resizeLinkField()
  }, [pastedLink])

  useEffect(() => {
    const last = localStorage.getItem('lastEmail')
    if (last) setEmail(last)
  }, [])

  useEffect(() => {
    const tick = () => {
      const cooldown = getMagicLinkCooldownSeconds()
      setMagicLinkCooldown(cooldown)
      if (cooldown === 0) {
        setErrorMsg((message) => isMagicLinkRateLimitMessage(message) ? null : message)
      }
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    const trimmed = email.trim()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrorMsg('Please enter a valid email address')
      return
    }

    const cooldown = getMagicLinkCooldownSeconds()
    if (cooldown > 0) {
      setMagicLinkCooldown(cooldown)
      setErrorMsg(null)
      return
    }

    try {
      setSending(true)
      const result = await sendMagicLinkEmail(trimmed)
      setMagicLinkCooldown(getMagicLinkCooldownSeconds())
      if (result.ok === false) {
        setErrorMsg(result.message)
        return
      }
      setJustSent(true)
      window.setTimeout(() => setJustSent(false), 4000)
    } finally {
      setSending(false)
    }
  }

  const verifyPastedLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    try {
      setVerifying(true)
      const result = await completeMagicLinkSignIn(pastedLink)
      if (result.ok === false) {
        setErrorMsg(result.message)
        return
      }
      setSignedIn(true)
      setErrorMsg(null)
    } finally {
      setVerifying(false)
    }
  }

  const openInAddressBar = () => {
    setErrorMsg(null)
    const url = buildMagicLinkVerifyUrl(pastedLink)
    if (!url) {
      setErrorMsg('Paste a full magic link first.')
      return
    }
    window.location.assign(url)
  }

  const border = darkMode ? '#374151' : '#e5e7eb'
  const muted = darkMode ? '#9ca3af' : '#6b7280'
  const redirectUrl = getAuthRedirectUrl()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 360,
        padding: '24px 32px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 960,
          margin: '0 auto',
          padding: 28,
          borderRadius: 12,
          border: `1px solid ${border}`,
          background: darkMode ? '#1f2937' : '#f9fafb',
          boxSizing: 'border-box',
        }}
      >
        <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>{title}</h2>
        <p style={{ margin: '0 0 16px', color: muted, fontSize: 14, lineHeight: 1.5 }}>{description}</p>

        <div
          style={{
            marginBottom: 20,
            padding: '10px 12px',
            borderRadius: 8,
            background: darkMode ? '#111827' : '#eff6ff',
            border: `1px solid ${darkMode ? '#374151' : '#bfdbfe'}`,
            fontSize: 13,
            lineHeight: 1.5,
            color: darkMode ? '#d1d5db' : '#1e40af',
          }}
        >
          <strong>Using Cursor Simple Browser?</strong> Your email app opens links in a different browser.
          In your email, <strong>right-click the sign-in button → Copy Link</strong> (do not drag-select — that often copies only the end of the URL).
          Paste the full link below.
        </div>

        {signedIn && (
          <div
            role="status"
            style={{
              marginBottom: 12,
              padding: '8px 12px',
              borderRadius: 8,
              background: darkMode ? '#14532d' : '#dcfce7',
              color: darkMode ? '#bbf7d0' : '#166534',
              border: `1px solid ${darkMode ? '#166534' : '#86efac'}`,
            }}
          >
            Signed in. Loading candidates…
          </div>
        )}

        {justSent && magicLinkCooldown > 0 && (
          <div
            role="status"
            style={{
              marginBottom: 12,
              padding: '8px 12px',
              borderRadius: 8,
              background: darkMode ? '#14532d' : '#dcfce7',
              color: darkMode ? '#bbf7d0' : '#166534',
              border: `1px solid ${darkMode ? '#166534' : '#86efac'}`,
            }}
          >
            Magic link request accepted. Check your email and spam. You can request another link when the timer finishes.
          </div>
        )}

        {!justSent && magicLinkCooldown > 0 && (
          <div
            role="status"
            style={{
              marginBottom: 12,
              padding: '8px 12px',
              borderRadius: 8,
              background: darkMode ? '#1e3a8a' : '#eff6ff',
              color: darkMode ? '#dbeafe' : '#1e40af',
              border: `1px solid ${darkMode ? '#1d4ed8' : '#bfdbfe'}`,
            }}
          >
            A magic link was already requested. Supabase may keep limiting email for a couple of minutes, so check your inbox or try again when the timer finishes.
          </div>
        )}

        {errorMsg && !isMagicLinkRateLimitMessage(errorMsg) && (
          <div
            role="alert"
            style={{
              marginBottom: 12,
              padding: '8px 12px',
              borderRadius: 8,
              background: darkMode ? '#7f1d1d' : '#fef2f2',
              color: darkMode ? '#fee2e2' : '#991b1b',
              border: `1px solid ${darkMode ? '#991b1b' : '#fecaca'}`,
            }}
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={sendMagicLink} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            className="input"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Email address"
            style={{ width: '100%' }}
          />
          <button className="btn primary" type="submit" disabled={sending || magicLinkCooldown > 0} style={{ width: '100%' }}>
            {sending
              ? 'Sending…'
              : magicLinkCooldown > 0
                ? justSent ? `Sent - try again in ${magicLinkCooldown}s` : `Try again in ${magicLinkCooldown}s`
                : justSent ? 'Sent — check your email ✓' : 'Send magic link'}
          </button>
        </form>

        <div style={{ margin: '20px 0', borderTop: `1px solid ${border}` }} />

        <form onSubmit={verifyPastedLink} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: 14, fontWeight: 600 }}>Paste magic link here</label>
          <textarea
            ref={linkFieldRef}
            placeholder="https://ydftcebaftngcdjvxrgl.supabase.co/auth/v1/verify?token=…&type=magiclink&redirect_to=…"
            value={pastedLink}
            onChange={(e) => setPastedLink(e.target.value)}
            onPaste={() => window.requestAnimationFrame(resizeLinkField)}
            aria-label="Full magic link URL from email"
            rows={10}
            style={{
              display: 'block',
              width: '100%',
              minHeight: 220,
              maxHeight: '45vh',
              padding: '14px 16px',
              borderRadius: 8,
              border: `1px solid ${border}`,
              background: darkMode ? '#111827' : '#ffffff',
              color: darkMode ? '#f9fafb' : '#111827',
              resize: 'vertical',
              overflow: 'auto',
              boxSizing: 'border-box',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: 14,
              lineHeight: 1.6,
              wordBreak: 'break-all',
              whiteSpace: 'pre-wrap',
            }}
          />
          <button className="btn" type="submit" disabled={!pastedLink.trim() || verifying} style={{ width: '100%' }}>
            {verifying ? 'Verifying…' : 'Sign in with pasted link'}
          </button>
          <button
            className="btn"
            type="button"
            disabled={!pastedLink.trim()}
            onClick={openInAddressBar}
            style={{ width: '100%' }}
          >
            Or paste link into address bar above
          </button>
        </form>

        <p style={{ margin: '16px 0 0', fontSize: 12, color: muted, lineHeight: 1.5 }}>
          Redirect target for this browser: <code>{redirectUrl}</code>. Check spam for mail from{' '}
          <code>noreply@mail.app.supabase.io</code>.
        </p>
      </div>
    </div>
  )
}
