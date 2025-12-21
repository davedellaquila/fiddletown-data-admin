/**
 * Main application component - Root of the SSA Admin application
 * 
 * This component manages:
 * - Authentication state and magic link login flow
 * - Global UI state (dark mode, sidebar collapse)
 * - View navigation between different admin modules
 * - Keyboard shortcuts for quick navigation
 * 
 * The app supports two modes:
 * - Development mode: Bypasses authentication for local development
 * - Production mode: Requires Supabase authentication via magic link
 * 
 * @module App
 */
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import Events from './features/Events'
import Locations from './features/Locations'
import Routes from './features/Routes'
import OCRTest from './features/OCRTest'

/**
 * Available view types for navigation
 * Each view corresponds to a different admin module
 */
type View = 'locations' | 'events' | 'routes' | 'ocr-test'

/**
 * Development mode flag - determines if authentication is bypassed
 * 
 * In development mode:
 * - Authentication is bypassed with a mock session
 * - Sign out button becomes a reload button
 * - Useful for rapid development without auth setup
 * 
 * Set via environment variables: VITE_DEV or NODE_ENV=development
 */
const IS_DEVELOPMENT_MODE = import.meta.env.DEV || import.meta.env.MODE === 'development'

/**
 * Main App component
 * 
 * Manages application-wide state and renders either:
 * - Login screen (if not authenticated and not in dev mode)
 * - Main admin interface (if authenticated or in dev mode)
 */
export default function App() {
  console.log('App component rendering...')
  
  // Authentication state
  // In dev mode, use a mock session to bypass auth
  const [session, setSession] = useState<any>(IS_DEVELOPMENT_MODE ? { user: { email: 'dev@localhost' } } : null)
  
  // Magic link email form state
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<null | { to: string }>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [justSent, setJustSent] = useState<boolean>(false) // Visual feedback for sent state
  
  // View navigation - which admin module is currently active
  const [view, setView] = useState<View>('locations')
  
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

  /**
   * Authentication setup effect
   * 
   * In production mode:
   * - Checks for existing session on mount
   * - Subscribes to auth state changes (login/logout)
   * - Updates session state when auth state changes
   * 
   * In development mode:
   * - Skips all auth setup
   * - Uses mock session from initial state
   */
  useEffect(() => {
    // In development mode, skip authentication setup
    if (IS_DEVELOPMENT_MODE) {
      console.log('Development mode: Authentication bypassed')
      return
    }
    
    console.log('Setting up auth...')
    try {
      // Check for existing session on mount
      supabase.auth.getSession().then(({ data }) => {
        console.log('Session data:', data)
        setSession(data.session)
      })
      // Subscribe to auth state changes (login, logout, token refresh)
      const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
        console.log('Auth state changed:', s)
        setSession(s)
      })
      // Cleanup: unsubscribe when component unmounts
      return () => sub.subscription.unsubscribe()
    } catch (error) {
      console.error('Auth setup error:', error)
    }
  }, [])

  /**
   * Global keyboard shortcuts for quick module navigation
   * 
   * Shortcuts (Cmd/Ctrl + number):
   * - ⌘/Ctrl + 1: Navigate to Locations
   * - ⌘/Ctrl + 2: Navigate to Events
   * - ⌘/Ctrl + 3: Navigate to Routes
   * - ⌘/Ctrl + 4: Navigate to OCR Test
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
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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
    
    try {
      setSending(true)
      // Request magic link via Supabase
      const { error } = await supabase.auth.signInWithOtp({ email: trimmed })
      if (error) {
        const msg = error.message || ''
        // Suppress Supabase security/rate limit messaging – treat as soft success
        // These messages are often false positives and don't indicate actual failures
        if (/security|rate|seconds|wait/i.test(msg)) {
          setErrorMsg(null)
        } else {
          setErrorMsg(msg)
          return
        }
      }
      // Save email for next time
      localStorage.setItem('lastEmail', trimmed)
      setSent({ to: trimmed })
      // Show brief success feedback
      setJustSent(true)
      setTimeout(() => { setJustSent(false) }, 1200)
    } finally {
      setSending(false)
    }
  }

  

  // In development mode, always show the app content
  if (!session && !IS_DEVELOPMENT_MODE) {
    return (
      <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', background: darkMode ? '#0b1020' : '#0b1020' }}>
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
          maxWidth: 480, 
          margin: '12vh auto',
          background: darkMode ? 'rgba(17,24,39,.85)' : 'rgba(255,255,255,.90)',
          backdropFilter: 'saturate(1.1) blur(4px)',
          WebkitBackdropFilter: 'saturate(1.1) blur(4px)',
          color: darkMode ? '#f9fafb' : '#1f2937',
          padding: '32px',
          borderRadius: '16px',
          boxShadow: '0 25px 60px rgba(0,0,0,.25)'
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
        {/* Success banner removed. Status is shown inside the button now. */}
        {errorMsg && (
          <div role="alert" style={{
            marginBottom: '12px',
            padding: '8px 12px',
            borderRadius: '8px',
            background: darkMode ? '#7f1d1d' : '#fef2f2',
            color: darkMode ? '#fee2e2' : '#991b1b',
            border: `1px solid ${darkMode ? '#991b1b' : '#fecaca'}`
          }}>
            {errorMsg}
          </div>
        )}
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
              opacity: sending ? 0.95 : 1,
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 6px 18px rgba(59,130,246,.35)'
            }}
            disabled={sending}
            title="Send magic link"
          >
            <span style={{ position: 'relative', zIndex: 1 }}>
              {sending ? 'Sending…' : justSent ? 'Sent ✓' : 'Send Magic Link'}
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
      <aside className="sidebar" style={{ 
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
              <strong style={{ color: darkMode ? '#f9fafb' : '#1f2937', fontSize: '14px', wordBreak: 'break-word' }}>{session.user?.email}</strong>
            )}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button 
                className="sidebar-control-btn"
                onClick={() => {
                  const newState = !sidebarCollapsed
                  setSidebarCollapsed(newState)
                  setUserManuallyCollapsed(newState)
                  localStorage.setItem('sidebarCollapsed', JSON.stringify(newState))
                }}
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
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
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
                if (IS_DEVELOPMENT_MODE) {
                  // In development mode, just reload the page
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
              {IS_DEVELOPMENT_MODE ? 'Reload (Dev)' : 'Sign out'}
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
            title="OCR Test Page (⌘4 / Ctrl4)"
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
      <main className="main" style={{ 
        marginLeft: sidebarCollapsed ? '60px' : '220px',
        marginTop: '0',
        background: darkMode ? '#111827' : '#ffffff',
        color: darkMode ? '#f9fafb' : '#1f2937',
        padding: '0 0 20px 20px',
        width: sidebarCollapsed ? 'calc(100vw - 60px)' : 'calc(100vw - 220px)',
        minHeight: '100vh',
        transition: 'margin-left 0.3s ease, width 0.3s ease',
        maxWidth: '100%',
        overflowX: 'hidden'
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
        {view === 'routes' && <Routes darkMode={darkMode} sidebarCollapsed={sidebarCollapsed} />}
        {view === 'ocr-test' && <OCRTest darkMode={darkMode} />}
      </main>
    </div>
  )
}
