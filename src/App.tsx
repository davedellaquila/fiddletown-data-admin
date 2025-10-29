import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import Events from './features/Events'
import Locations from './features/Locations'
import Routes from './features/Routes'


type View = 'locations' | 'events' | 'routes'

export default function App() {
  console.log('App component rendering...')
  const [session, setSession] = useState<any>(null)
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<null | { to: string }>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  const [justSent, setJustSent] = useState<boolean>(false)
  const [view, setView] = useState<View>('locations')
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode')
    return saved ? JSON.parse(saved) : false
  })

  useEffect(() => {
    console.log('Setting up auth...')
    try {
      supabase.auth.getSession().then(({ data }) => {
        console.log('Session data:', data)
        setSession(data.session)
      })
      const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
        console.log('Auth state changed:', s)
        setSession(s)
      })
      return () => sub.subscription.unsubscribe()
    } catch (error) {
      console.error('Auth setup error:', error)
    }
  }, [])

  // Global keyboard shortcuts for module navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === '1') { e.preventDefault(); setView('locations') }
      if (e.key === '2') { e.preventDefault(); setView('events') }
      if (e.key === '3') { e.preventDefault(); setView('routes') }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Restore last email
  useEffect(() => {
    const last = localStorage.getItem('lastEmail')
    if (last) setEmail(last)
  }, [])

  // Persist dark mode changes
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode))
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
  }

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    const trimmed = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrorMsg('Please enter a valid email address')
      return
    }
    try {
      setSending(true)
      const { error } = await supabase.auth.signInWithOtp({ email: trimmed })
      if (error) {
        const msg = error.message || ''
        // Suppress Supabase security/rate limit messaging – treat as soft success
        if (/security|rate|seconds|wait/i.test(msg)) {
          setErrorMsg(null)
        } else {
          setErrorMsg(msg)
          return
        }
      }
      localStorage.setItem('lastEmail', trimmed)
      setSent({ to: trimmed })
      setJustSent(true)
      setTimeout(() => { setJustSent(false) }, 1200)
    } finally {
      setSending(false)
    }
  }

  

  if (!session) {
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
        width: '220px',
        height: '100vh',
        overflowY: 'auto',
        background: darkMode ? '#1f2937' : '#f9fafb',
        borderRight: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
        padding: '20px',
        zIndex: 1000
      }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <strong style={{ color: darkMode ? '#f9fafb' : '#1f2937' }}>{session.user?.email}</strong>
            <button 
              onClick={toggleDarkMode}
              style={{
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px',
                background: darkMode ? '#374151' : '#e5e7eb'
              }}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
          <button 
            className="btn" 
            onClick={() => supabase.auth.signOut()} 
            style={{ 
              marginTop: 8,
              background: darkMode ? '#374151' : '#ffffff',
              border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
              color: darkMode ? '#f9fafb' : '#374151'
            }}
          >
            Sign out
          </button>
        </div>
        <nav className="stack" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <button 
            className="btn" 
            onClick={() => setView('locations')}
            title="Go to Locations (⌘1 / Ctrl1)"
            style={{
              background: view === 'locations' ? (darkMode ? '#3b82f6' : '#3b82f6') : (darkMode ? '#374151' : '#ffffff'),
              border: `1px solid ${view === 'locations' ? '#3b82f6' : (darkMode ? '#4b5563' : '#d1d5db')}`,
              color: view === 'locations' ? 'white' : (darkMode ? '#f9fafb' : '#374151'),
              textAlign: 'left',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '8px'
            }}
          >
            📍 Locations
          </button>
          <button 
            className="btn" 
            onClick={() => setView('events')}
            title="Go to Events (⌘2 / Ctrl2)"
            style={{
              background: view === 'events' ? (darkMode ? '#3b82f6' : '#3b82f6') : (darkMode ? '#374151' : '#ffffff'),
              border: `1px solid ${view === 'events' ? '#3b82f6' : (darkMode ? '#4b5563' : '#d1d5db')}`,
              color: view === 'events' ? 'white' : (darkMode ? '#f9fafb' : '#374151'),
              textAlign: 'left',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '8px'
            }}
          >
            📅 Events
          </button>
          <button 
            className="btn" 
            onClick={() => setView('routes')}
            title="Go to Routes (⌘3 / Ctrl3)"
            style={{
              background: view === 'routes' ? (darkMode ? '#3b82f6' : '#3b82f6') : (darkMode ? '#374151' : '#ffffff'),
              border: `1px solid ${view === 'routes' ? '#3b82f6' : (darkMode ? '#4b5563' : '#d1d5db')}`,
              color: view === 'routes' ? 'white' : (darkMode ? '#f9fafb' : '#374151'),
              textAlign: 'left',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '8px'
            }}
          >
            🗺️ Routes
          </button>
        </nav>
      </aside>
      <main className="main" style={{ 
        marginLeft: '220px',
        marginTop: '0',
        background: darkMode ? '#111827' : '#ffffff',
        color: darkMode ? '#f9fafb' : '#1f2937',
        padding: '0 0 20px 20px',
        width: 'calc(100vw - 220px)',
        minHeight: '100vh'
      }}>
        {/* Reserved for future notifications/info header (currently hidden) */}
        <div 
          id="top-notifications" 
          role="status" 
          aria-live="polite" 
          style={{ display: 'none' }}
        />
        {view === 'locations' && <Locations darkMode={darkMode} />}
        {view === 'events' && <Events darkMode={darkMode} />}
        {view === 'routes' && <Routes darkMode={darkMode} />}
      </main>
    </div>
  )
}
