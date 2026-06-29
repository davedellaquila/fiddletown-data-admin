/**
 * Main application component - Root of the SSA Admin application
 * 
 * This component manages:
 * - Authentication state and magic link login flow
 * - Global UI state (dark mode, sidebar collapse)
 * - View navigation between different admin modules
 * - Keyboard shortcuts for quick navigation and sidebar toggle (⌘B)
 * 
 * The app supports two modes:
 * - Development mode: App shell loads without login; optional dev auto sign-in (VITE_DEV_AUTH_*) skips magic link for Candidates
 * - Production mode: Requires Supabase authentication via magic link
 * 
 * @module App
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { refreshSupabaseSession, useSupabaseSession } from './hooks/useSupabaseSession'
import { IS_DEVELOPMENT_MODE } from './lib/devMode'
import {
  completeEmailCodeSignIn,
  completeMagicLinkSignIn,
  getMagicLinkCooldownSeconds,
  isMagicLinkRateLimitMessage,
  sendMagicLinkEmail,
} from './lib/magicLinkAuth'
import { supabase } from './lib/supabaseClient'
import Events from './features/Events'
import EventCandidates from './features/EventCandidates'
import Locations from './features/Locations'
import Routes from './features/Routes'
import OCRTest from './features/OCRTest'

/**
 * Available view types for navigation
 * Each view corresponds to a different admin module
 */
type View = 'locations' | 'events' | 'candidates' | 'routes' | 'ocr-test'

/**
 * Main App component
 * 
 * Manages application-wide state and renders either:
 * - Login screen (if not authenticated and not in dev mode)
 * - Main admin interface (if authenticated or in dev mode)
 */
export default function App() {
  console.log('App component rendering...')
  
  const { session, loading: authLoading, isAuthenticated, authError } = useSupabaseSession()
  const canAccessApp = IS_DEVELOPMENT_MODE || isAuthenticated
  
  // Magic link email form state
  const [email, setEmail] = useState('')
  const [pastedLink, setPastedLink] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyingCode, setVerifyingCode] = useState(false)
  const [sent, setSent] = useState<null | { to: string }>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [justSent, setJustSent] = useState<boolean>(false) // Visual feedback for sent state
  const [signedInWithPastedLink, setSignedInWithPastedLink] = useState(false)
  const [magicLinkCooldown, setMagicLinkCooldown] = useState(() => getMagicLinkCooldownSeconds())
  const pastedLinkRef = useRef<HTMLTextAreaElement>(null)
  
  // View navigation - which admin module is currently active
  // Restore last selected view from localStorage, default to 'locations'
  const [view, setView] = useState<View>(() => {
    const saved = localStorage.getItem('selectedView')
    // Validate that saved value is a valid View type
    if (saved && ['locations', 'events', 'candidates', 'routes', 'ocr-test'].includes(saved)) {
      return saved as View
    }
    return 'locations'
  })
  
  // UI preferences - persisted to localStorage for user convenience
  // Dark mode preference
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode')
    return saved ? JSON.parse(saved) : false
  })
  // Sidebar collapsed state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed')
    return saved ? JSON.parse(saved) : false
  })
  // Track if user manually collapsed sidebar (vs auto-collapse)
  const [userManuallyCollapsed, setUserManuallyCollapsed] = useState(false)

  const resizePastedLinkField = useCallback(() => {
    const el = pastedLinkRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(180, Math.max(92, el.scrollHeight))}px`
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const newState = !prev
      setUserManuallyCollapsed(newState)
      localStorage.setItem('sidebarCollapsed', JSON.stringify(newState))
      return newState
    })
  }, [])

  /**
   * Global keyboard shortcuts for quick module navigation
   * 
   * Shortcuts (Cmd/Ctrl + key):
   * - ⌘/Ctrl + 1: Navigate to Locations
   * - ⌘/Ctrl + 2: Navigate to Events
   * - ⌘/Ctrl + 3: Navigate to Routes
   * - ⌘/Ctrl + 4: Navigate to OCR Test
   * - ⌘/Ctrl + 5: Navigate to Candidates
   * - ⌘/Ctrl + B: Toggle sidebar
   * 
   * These shortcuts work globally when the app is focused
   */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts with Cmd (Mac) or Ctrl (Windows/Linux)
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === '1') { e.preventDefault(); setView('locations') }
      if (e.key === '2') { e.preventDefault(); setView('events') }
      if (e.key === '3') { e.preventDefault(); setView('routes') }
      if (e.key === '4') { e.preventDefault(); setView('ocr-test') }
      if (e.key === '5') { e.preventDefault(); setView('candidates') }
      if (e.key === 'b' || e.key === 'B') {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
        e.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleSidebar])

  /**
   * Restore last used email from localStorage
   * 
   * Improves UX by remembering the user's email between sessions
   * Only restores if a saved email exists
   */
  useEffect(() => {
    const last = localStorage.getItem('lastEmail')
    if (last) setEmail(last)
  }, [])

  useLayoutEffect(() => {
    resizePastedLinkField()
  }, [pastedLink, resizePastedLinkField])

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

  /**
   * Auto-collapse sidebar on narrow screens (≤1024px)
   * 
   * Automatically collapses sidebar when screen width is ≤1024px.
   * Restores previous state when screen width >1024px, unless user manually collapsed it.
   */
  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1024px)')
    
    const handleResize = (e: MediaQueryListEvent | MediaQueryList) => {
      const isNarrow = e.matches
      
      if (isNarrow) {
        // Auto-collapse on narrow screens
        if (!sidebarCollapsed) {
          setSidebarCollapsed(true)
        }
      } else {
        // Restore previous state on wider screens (unless user manually collapsed)
        if (!userManuallyCollapsed) {
          const saved = localStorage.getItem('sidebarCollapsed')
          const savedState = saved ? JSON.parse(saved) : false
          setSidebarCollapsed(savedState)
        }
      }
    }
    
    // Check initial state
    handleResize(mediaQuery)
    
    // Listen for changes
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleResize)
      return () => mediaQuery.removeEventListener('change', handleResize)
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleResize)
      return () => mediaQuery.removeListener(handleResize)
    }
  }, [sidebarCollapsed, userManuallyCollapsed])

  /**
   * Persist dark mode preference to localStorage
   * 
   * Also updates the document's data-theme attribute for CSS theming
   * This allows CSS to respond to theme changes without JavaScript
   */
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode))
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  /**
   * Persist sidebar collapsed state to localStorage
   * 
   * Remembers user's sidebar preference between sessions
   */
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(sidebarCollapsed))
  }, [sidebarCollapsed])

  /**
   * Persist selected view/module to localStorage
   * 
   * Remembers which admin module was last viewed between page reloads
   */
  useEffect(() => {
    localStorage.setItem('selectedView', view)
  }, [view])

  /**
   * Toggle dark mode on/off
   * 
   * The preference is automatically persisted to localStorage via useEffect
   */
  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
  }

  /**
   * Send magic link email for passwordless authentication
   * 
   * Flow:
   * 1. Validates email format
   * 2. Sends OTP email via Supabase
   * 3. Handles errors gracefully (suppresses rate limit messages)
   * 4. Saves email to localStorage for next time
   * 5. Shows success feedback
   * 
   * Note: Rate limit and security messages are suppressed as they're
   * often false positives and don't indicate actual failures
   * 
   * @param e - Form submit event
   */
  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    const trimmed = email.trim()
    
    // Basic email validation
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
      setSent({ to: trimmed })
      setJustSent(true)
      setTimeout(() => { setJustSent(false) }, 1200)
    } finally {
      setSending(false)
    }
  }

  const verifyPastedLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSignedInWithPastedLink(false)

    try {
      setVerifying(true)
      const result = await completeMagicLinkSignIn(pastedLink)
      if (result.ok === false) {
        setErrorMsg(result.message)
        return
      }
      setSignedInWithPastedLink(true)
      setPastedLink('')
    } finally {
      setVerifying(false)
    }
  }

  const pasteMagicLinkFromClipboard = async () => {
    setErrorMsg(null)

    if (!navigator.clipboard?.readText) {
      setErrorMsg('This browser blocked direct clipboard paste. Tap inside the box, then choose Paste.')
      pastedLinkRef.current?.focus()
      return
    }

    try {
      const clipboardText = await navigator.clipboard.readText()
      const trimmed = clipboardText.trim()
      if (!trimmed) {
        setErrorMsg('The clipboard is empty. Copy the magic link from Mail, then tap Paste copied link.')
        pastedLinkRef.current?.focus()
        return
      }
      if (/^[A-Za-z0-9_-]{4,12}$/.test(trimmed)) {
        setEmailCode(trimmed)
        return
      }
      setPastedLink(trimmed)
      window.requestAnimationFrame(resizePastedLinkField)
      pastedLinkRef.current?.focus()
    } catch {
      setErrorMsg('Paste permission was blocked. Tap inside the box, then choose Paste.')
      pastedLinkRef.current?.focus()
    }
  }

  const verifyEmailCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSignedInWithPastedLink(false)

    try {
      setVerifyingCode(true)
      const result = await completeEmailCodeSignIn(email, emailCode, refreshSupabaseSession)
      if (result.ok === false) {
        setErrorMsg(result.message)
        return
      }
      setSignedInWithPastedLink(true)
      setEmailCode('')
    } finally {
      setVerifyingCode(false)
    }
  }

  

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: darkMode ? '#111827' : '#ffffff', color: darkMode ? '#f9fafb' : '#1f2937' }}>
        Loading…
      </div>
    )
  }

  if (!canAccessApp) {
    return (
      <div style={{
        position: 'relative',
        minHeight: '100vh',
        overflowX: 'hidden',
        overflowY: 'auto',
        padding: 'max(12px, env(safe-area-inset-top)) 0 calc(120px + env(safe-area-inset-bottom))',
        background: darkMode ? '#0b1020' : '#0b1020'
      }}>
        {/* Modern layered gradient background */}
        <div aria-hidden="true" style={{
          position: 'fixed', inset: 0, zIndex: 0,
          background: darkMode
            ? 'radial-gradient(800px 400px at 10% 10%, rgba(59,130,246,.20), transparent 60%), radial-gradient(600px 300px at 80% 20%, rgba(16,185,129,.15), transparent 60%), radial-gradient(700px 350px at 50% 85%, rgba(236,72,153,.12), transparent 60%)'
            : 'radial-gradient(800px 400px at 10% 10%, rgba(59,130,246,.18), transparent 60%), radial-gradient(600px 300px at 80% 20%, rgba(16,185,129,.14), transparent 60%), radial-gradient(700px 350px at 50% 85%, rgba(236,72,153,.10), transparent 60%)'
        }} />
        <div style={{ 
          position: 'relative',
          zIndex: 1,
          maxWidth: 560, 
          width: 'calc(100% - 24px)',
          margin: 'clamp(12px, 5vh, 56px) auto',
          background: darkMode ? 'rgba(17,24,39,.85)' : 'rgba(255,255,255,.90)',
          backdropFilter: 'saturate(1.1) blur(4px)',
          WebkitBackdropFilter: 'saturate(1.1) blur(4px)',
          color: darkMode ? '#f9fafb' : '#1f2937',
          padding: 'clamp(20px, 5vw, 32px)',
          borderRadius: '16px',
          boxShadow: '0 25px 60px rgba(0,0,0,.25)',
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '600' }}>SSA Admin</h1>
          <button 
            onClick={toggleDarkMode}
            style={{
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              background: darkMode ? '#374151' : '#f3f4f6'
            }}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
        <p style={{ marginBottom: '12px', color: darkMode ? '#d1d5db' : '#6b7280' }}>Sign in to edit datasets.</p>
        <p style={{ margin: '0 0 16px', color: darkMode ? '#9ca3af' : '#6b7280', fontSize: 13, lineHeight: 1.5 }}>
          Send yourself a magic link, then copy the full link from the email and paste it below to sign into this browser.
        </p>
        {signedInWithPastedLink && (
          <div role="status" style={{
            marginBottom: '12px',
            padding: '8px 12px',
            borderRadius: '8px',
            background: darkMode ? '#14532d' : '#dcfce7',
            color: darkMode ? '#bbf7d0' : '#166534',
            border: `1px solid ${darkMode ? '#166534' : '#86efac'}`,
            overflowWrap: 'anywhere'
          }}>
            Signed in. Loading admin…
          </div>
        )}
        {sent && magicLinkCooldown > 0 && (
          <div role="status" style={{
            marginBottom: '12px',
            padding: '8px 12px',
            borderRadius: '8px',
            background: darkMode ? '#14532d' : '#dcfce7',
            color: darkMode ? '#bbf7d0' : '#166534',
            border: `1px solid ${darkMode ? '#166534' : '#86efac'}`,
            overflowWrap: 'anywhere'
          }}>
            Magic link request accepted. Check {sent.to} and spam. You can request another link when the timer finishes.
          </div>
        )}
        {!sent && magicLinkCooldown > 0 && (
          <div role="status" style={{
            marginBottom: '12px',
            padding: '8px 12px',
            borderRadius: '8px',
            background: darkMode ? '#1e3a8a' : '#eff6ff',
            color: darkMode ? '#dbeafe' : '#1e40af',
            border: `1px solid ${darkMode ? '#1d4ed8' : '#bfdbfe'}`,
            overflowWrap: 'anywhere'
          }}>
            A magic link was already sent. Check Mail for the newest message, copy that link, and paste it below. You can request another link in {magicLinkCooldown}s.
          </div>
        )}
        {authError && (
          <div role="alert" style={{
            marginBottom: '12px',
            padding: '8px 12px',
            borderRadius: '8px',
            background: darkMode ? '#7f1d1d' : '#fef2f2',
            color: darkMode ? '#fee2e2' : '#991b1b',
            border: `1px solid ${darkMode ? '#991b1b' : '#fecaca'}`,
            overflowWrap: 'anywhere'
          }}>
            Sign-in failed: {authError}
          </div>
        )}
        {errorMsg && !isMagicLinkRateLimitMessage(errorMsg) && (
          <div role="alert" style={{
            marginBottom: '12px',
            padding: '8px 12px',
            borderRadius: '8px',
            background: darkMode ? '#7f1d1d' : '#fef2f2',
            color: darkMode ? '#fee2e2' : '#991b1b',
            border: `1px solid ${darkMode ? '#991b1b' : '#fecaca'}`,
            overflowWrap: 'anywhere'
          }}>
            {errorMsg}
          </div>
        )}
        <form onSubmit={verifyPastedLink} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
          <label style={{ fontSize: 14, fontWeight: 600 }}>
            Paste magic link from Mail
          </label>
          <button
            className="btn"
            type="button"
            onClick={pasteMagicLinkFromClipboard}
            style={{
              width: '100%',
              background: darkMode ? '#1f2937' : '#ffffff',
              border: `1px solid ${darkMode ? '#60a5fa' : '#93c5fd'}`,
              color: darkMode ? '#dbeafe' : '#1d4ed8',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            Paste copied link
          </button>
          <textarea
            ref={pastedLinkRef}
            value={pastedLink}
            onChange={(e) => setPastedLink(e.target.value)}
            onPaste={() => window.requestAnimationFrame(resizePastedLinkField)}
            aria-label="Full magic link URL from email"
            placeholder="Paste the full link from the email"
            rows={3}
            style={{
              width: '100%',
              minHeight: 92,
              maxHeight: 180,
              padding: '12px',
              border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`,
              borderRadius: '8px',
              background: darkMode ? '#374151' : '#ffffff',
              color: darkMode ? '#f9fafb' : '#1f2937',
              fontSize: '13px',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              lineHeight: 1.45,
              resize: 'vertical',
              boxSizing: 'border-box',
              overflowX: 'hidden',
              overflowWrap: 'anywhere',
              wordBreak: 'break-all',
              whiteSpace: 'pre-wrap',
            }}
          />
          <button
            className="btn"
            type="submit"
            disabled={!pastedLink.trim() || verifying}
            style={{
              width: '100%',
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
              color: darkMode ? '#f9fafb' : '#1f2937',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: !pastedLink.trim() || verifying ? 'not-allowed' : 'pointer',
              opacity: !pastedLink.trim() || verifying ? 0.65 : 1,
            }}
          >
            {verifying ? 'Signing in…' : 'Sign in with pasted link'}
          </button>
          <div style={{ fontSize: 12, color: darkMode ? '#9ca3af' : '#6b7280', lineHeight: 1.45 }}>
            In Mail, touch and hold the magic-link button, choose Copy Link, return here, then tap Paste copied link.
          </div>
        </form>

        <div style={{ margin: '18px 0', display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{ height: 1, flex: 1, background: darkMode ? '#374151' : '#d1d5db' }} />
          <span style={{ fontSize: 12, color: darkMode ? '#9ca3af' : '#6b7280', whiteSpace: 'nowrap' }}>or use code</span>
          <div style={{ height: 1, flex: 1, background: darkMode ? '#374151' : '#d1d5db' }} />
        </div>

        <form onSubmit={verifyEmailCode} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Code from email"
            value={emailCode}
            onChange={(e) => setEmailCode(e.target.value)}
            aria-label="Email sign-in code"
            style={{
              width: '100%',
              padding: '12px',
              border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`,
              borderRadius: '8px',
              background: darkMode ? '#374151' : '#ffffff',
              color: darkMode ? '#f9fafb' : '#1f2937',
              fontSize: '16px',
              textAlign: 'center',
              letterSpacing: '0.08em'
            }}
          />
          <button
            className="btn"
            type="submit"
            disabled={!emailCode.trim() || verifyingCode}
            style={{
              width: '100%',
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
              color: darkMode ? '#f9fafb' : '#1f2937',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: !emailCode.trim() || verifyingCode ? 'not-allowed' : 'pointer',
              opacity: !emailCode.trim() || verifyingCode ? 0.65 : 1,
            }}
          >
            {verifyingCode ? 'Signing in…' : 'Sign in with code'}
          </button>
          <div style={{ fontSize: 12, color: darkMode ? '#9ca3af' : '#6b7280', lineHeight: 1.45 }}>
            If your email shows a short code, enter it here. This avoids iPhone link-preview issues.
          </div>
        </form>

        <div style={{ margin: '18px 0', display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{ height: 1, flex: 1, background: darkMode ? '#374151' : '#d1d5db' }} />
          <span style={{ fontSize: 12, color: darkMode ? '#9ca3af' : '#6b7280', whiteSpace: 'nowrap' }}>or send a new link</span>
          <div style={{ height: 1, flex: 1, background: darkMode ? '#374151' : '#d1d5db' }} />
        </div>

        <form onSubmit={sendMagicLink} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
           <input
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Email address"
            style={{ 
              width: '100%', 
              padding: '12px',
              border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`,
              borderRadius: '8px',
              background: darkMode ? '#374151' : '#ffffff',
              color: darkMode ? '#f9fafb' : '#1f2937',
              fontSize: '14px'
            }}
          />
          <button 
            className="btn primary" 
            type="submit"
            style={{
              width: '100%',
              background: '#3b82f6',
              border: '1px solid #3b82f6',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: sending ? 'not-allowed' : 'pointer',
              opacity: sending || magicLinkCooldown > 0 ? 0.95 : 1,
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 6px 18px rgba(59,130,246,.35)'
            }}
            disabled={sending || magicLinkCooldown > 0}
            title="Send magic link"
          >
            <span style={{ position: 'relative', zIndex: 1 }}>
              {sending
                ? 'Sending…'
                : magicLinkCooldown > 0
                  ? sent ? `Sent - resend in ${magicLinkCooldown}s` : `Wait ${magicLinkCooldown}s to resend`
                  : justSent ? 'Sent ✓' : 'Send Magic Link'}
            </span>
          </button>
          <div style={{ fontSize: 12, color: darkMode ? '#9ca3af' : '#6b7280', textAlign: 'center' }}>
            Use your work email. Example: <code>you@domain.com</code>.
          </div>
        </form>

        </div>
      </div>
    )
  }

  return (
    <div style={{ 
      display: 'flex',
      height: '100vh',
      background: darkMode ? '#111827' : '#ffffff',
      color: darkMode ? '#f9fafb' : '#1f2937'
    }}>
      <aside className="sidebar app-sidebar" style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        width: sidebarCollapsed ? '60px' : '220px',
        height: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        background: darkMode ? '#1f2937' : '#f9fafb',
        borderRight: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
        padding: sidebarCollapsed ? '20px 8px' : '20px',
        zIndex: 1000,
        transition: 'width 0.3s ease, padding 0.3s ease'
      }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            {!sidebarCollapsed && (
              <strong style={{ color: darkMode ? '#f9fafb' : '#1f2937', fontSize: '14px', wordBreak: 'break-word' }}>
                {session?.user?.email ?? (IS_DEVELOPMENT_MODE ? 'Dev (not signed in)' : '')}
              </strong>
            )}
            <div style={{
              display: 'flex',
              flexDirection: sidebarCollapsed ? 'column' : 'row',
              gap: '6px',
              alignItems: 'center'
            }}>
              <button 
                className="sidebar-control-btn"
                onClick={toggleSidebar}
                style={{
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  background: darkMode ? '#374151' : '#e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '32px',
                  height: '32px'
                }}
                title={sidebarCollapsed ? 'Expand sidebar (⌘B)' : 'Collapse sidebar (⌘B)'}
              >
                {sidebarCollapsed ? '→' : '←'}
              </button>
              <button 
                className="sidebar-control-btn"
                onClick={toggleDarkMode}
                style={{
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  background: darkMode ? '#374151' : '#e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '32px',
                  height: '32px'
                }}
                title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
          {!sidebarCollapsed && (
            <button 
              className="btn sidebar-action-btn" 
              onClick={() => {
                if (IS_DEVELOPMENT_MODE && !isAuthenticated) {
                  window.location.reload()
                } else {
                  supabase.auth.signOut()
                }
              }} 
              style={{ 
                marginTop: 8,
                width: '100%',
                background: darkMode ? '#374151' : '#ffffff',
                border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                color: darkMode ? '#f9fafb' : '#374151'
              }}
            >
              {IS_DEVELOPMENT_MODE && !isAuthenticated ? 'Reload (Dev)' : 'Sign out'}
            </button>
          )}
        </div>
        <nav className="stack" style={{ flexDirection: 'column', alignItems: sidebarCollapsed ? 'center' : 'stretch' }}>
          <button 
            className={`btn sidebar-nav-btn ${view === 'locations' ? 'active' : ''}`}
            onClick={() => setView('locations')}
            title="Go to Locations (⌘1 / Ctrl1)"
            style={{
              background: view === 'locations' ? (darkMode ? '#3b82f6' : '#3b82f6') : (darkMode ? '#374151' : '#ffffff'),
              border: `1px solid ${view === 'locations' ? '#3b82f6' : (darkMode ? '#4b5563' : '#d1d5db')}`,
              color: view === 'locations' ? 'white' : (darkMode ? '#f9fafb' : '#374151'),
              textAlign: sidebarCollapsed ? 'center' : 'left',
              padding: sidebarCollapsed ? '12px' : '12px 16px',
              borderRadius: '8px',
              marginBottom: '8px',
              width: sidebarCollapsed ? '44px' : '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              gap: sidebarCollapsed ? '0' : '8px'
            }}
          >
            <span>📍</span>
            {!sidebarCollapsed && <span>Locations</span>}
          </button>
          <button 
            className={`btn sidebar-nav-btn ${view === 'events' ? 'active' : ''}`}
            onClick={() => setView('events')}
            title="Go to Events (⌘2 / Ctrl2)"
            style={{
              background: view === 'events' ? (darkMode ? '#3b82f6' : '#3b82f6') : (darkMode ? '#374151' : '#ffffff'),
              border: `1px solid ${view === 'events' ? '#3b82f6' : (darkMode ? '#4b5563' : '#d1d5db')}`,
              color: view === 'events' ? 'white' : (darkMode ? '#f9fafb' : '#374151'),
              textAlign: sidebarCollapsed ? 'center' : 'left',
              padding: sidebarCollapsed ? '12px' : '12px 16px',
              borderRadius: '8px',
              marginBottom: '8px',
              width: sidebarCollapsed ? '44px' : '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              gap: sidebarCollapsed ? '0' : '8px'
            }}
          >
            <span>📅</span>
            {!sidebarCollapsed && <span>Events</span>}
          </button>
          <button 
            className={`btn sidebar-nav-btn ${view === 'candidates' ? 'active' : ''}`}
            onClick={() => setView('candidates')}
            title="Go to Candidates (⌘5 / Ctrl5)"
            style={{
              background: view === 'candidates' ? (darkMode ? '#3b82f6' : '#3b82f6') : (darkMode ? '#374151' : '#ffffff'),
              border: `1px solid ${view === 'candidates' ? '#3b82f6' : (darkMode ? '#4b5563' : '#d1d5db')}`,
              color: view === 'candidates' ? 'white' : (darkMode ? '#f9fafb' : '#374151'),
              textAlign: sidebarCollapsed ? 'center' : 'left',
              padding: sidebarCollapsed ? '12px' : '12px 16px',
              borderRadius: '8px',
              marginBottom: '8px',
              width: sidebarCollapsed ? '44px' : '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              gap: sidebarCollapsed ? '0' : '8px'
            }}
          >
            <span>📥</span>
            {!sidebarCollapsed && <span>Candidates</span>}
          </button>
          <button 
            className={`btn sidebar-nav-btn ${view === 'routes' ? 'active' : ''}`}
            onClick={() => setView('routes')}
            title="Go to Routes (⌘3 / Ctrl3)"
            style={{
              background: view === 'routes' ? (darkMode ? '#3b82f6' : '#3b82f6') : (darkMode ? '#374151' : '#ffffff'),
              border: `1px solid ${view === 'routes' ? '#3b82f6' : (darkMode ? '#4b5563' : '#d1d5db')}`,
              color: view === 'routes' ? 'white' : (darkMode ? '#f9fafb' : '#374151'),
              textAlign: sidebarCollapsed ? 'center' : 'left',
              padding: sidebarCollapsed ? '12px' : '12px 16px',
              borderRadius: '8px',
              marginBottom: '8px',
              width: sidebarCollapsed ? '44px' : '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              gap: sidebarCollapsed ? '0' : '8px'
            }}
          >
            <span>🗺️</span>
            {!sidebarCollapsed && <span>Routes</span>}
          </button>
          <button 
            className={`btn sidebar-nav-btn ${view === 'ocr-test' ? 'active' : ''}`}
            onClick={() => setView('ocr-test')}
            title="Go to OCR Test (⌘4 / Ctrl4)"
            style={{
              background: view === 'ocr-test' ? (darkMode ? '#3b82f6' : '#3b82f6') : (darkMode ? '#374151' : '#ffffff'),
              border: `1px solid ${view === 'ocr-test' ? '#3b82f6' : (darkMode ? '#4b5563' : '#d1d5db')}`,
              color: view === 'ocr-test' ? 'white' : (darkMode ? '#f9fafb' : '#374151'),
              textAlign: sidebarCollapsed ? 'center' : 'left',
              padding: sidebarCollapsed ? '12px' : '12px 16px',
              borderRadius: '8px',
              marginBottom: '8px',
              width: sidebarCollapsed ? '44px' : '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              gap: sidebarCollapsed ? '0' : '8px'
            }}
          >
            <span>🔍</span>
            {!sidebarCollapsed && <span>OCR Test</span>}
          </button>
          <button 
            className="btn sidebar-nav-btn" 
            onClick={() => {
              // Open the HTML file in a new browser tab
              const htmlPath = '/code-snippets/events/event-list-dev.html'
              window.open(htmlPath, '_blank')
            }}
            title="Open Events List Dev (new tab)"
            style={{
              background: darkMode ? '#374151' : '#ffffff',
              border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
              color: darkMode ? '#f9fafb' : '#374151',
              textAlign: sidebarCollapsed ? 'center' : 'left',
              padding: sidebarCollapsed ? '12px' : '12px 16px',
              borderRadius: '8px',
              marginBottom: '8px',
              marginTop: '8px',
              width: sidebarCollapsed ? '44px' : '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              gap: sidebarCollapsed ? '0' : '8px'
            }}
          >
            <span>🌐</span>
            {!sidebarCollapsed && <span>Events List Dev</span>}
          </button>
        </nav>
      </aside>
      <main className="main app-main" style={{ 
        marginLeft: sidebarCollapsed ? '60px' : '220px',
        marginTop: '0',
        background: darkMode ? '#111827' : '#ffffff',
        color: darkMode ? '#f9fafb' : '#1f2937',
        padding: '0 0 20px 20px',
        width: sidebarCollapsed ? 'calc(100vw - 60px)' : 'calc(100vw - 220px)',
        minHeight: '100vh',
        transition: 'margin-left 0.3s ease, width 0.3s ease',
        maxWidth: '100%',
        overflowX: 'hidden',
        boxSizing: 'border-box',
        minWidth: 0
      }}>
        {/* Reserved for future notifications/info header (currently hidden) */}
        <div 
          id="top-notifications" 
          role="status" 
          aria-live="polite" 
          style={{ display: 'none' }}
        />
        {view === 'locations' && <Locations darkMode={darkMode} sidebarCollapsed={sidebarCollapsed} />}
        {view === 'events' && <Events darkMode={darkMode} sidebarCollapsed={sidebarCollapsed} />}
        {view === 'candidates' && <EventCandidates darkMode={darkMode} sidebarCollapsed={sidebarCollapsed} />}
        {view === 'routes' && <Routes darkMode={darkMode} sidebarCollapsed={sidebarCollapsed} />}
        {view === 'ocr-test' && <OCRTest darkMode={darkMode} />}
      </main>
    </div>
  )
}
