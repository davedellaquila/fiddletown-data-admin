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
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) alert(error.message)
    else alert('Magic link sent. Check your email.')
  }

  if (!session) {
    return (
      <div style={{ 
        maxWidth: 420, 
        margin: '10vh auto',
        background: darkMode ? '#1f2937' : '#ffffff',
        color: darkMode ? '#f9fafb' : '#1f2937',
        padding: '32px',
        borderRadius: '12px',
        boxShadow: darkMode ? '0 20px 25px -5px rgba(0, 0, 0, 0.3)' : '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
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
        <p style={{ marginBottom: '24px', color: darkMode ? '#d1d5db' : '#6b7280' }}>Sign in to edit datasets.</p>
        <form onSubmit={sendMagicLink} className="stack">
          <input
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
              background: '#3b82f6',
              border: '1px solid #3b82f6',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Send Magic Link
          </button>
        </form>
      </div>
    )
  }

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: '220px 1fr', 
      height: '100vh',
      background: darkMode ? '#111827' : '#ffffff',
      color: darkMode ? '#f9fafb' : '#1f2937'
    }}>
      <aside className="sidebar" style={{ 
        marginTop: '40px',
        background: darkMode ? '#1f2937' : '#f9fafb',
        borderRight: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
        padding: '20px'
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
        marginTop: '40px',
        background: darkMode ? '#111827' : '#ffffff',
        color: darkMode ? '#f9fafb' : '#1f2937',
        padding: '20px'
      }}>
        <div style={{ 
          background: darkMode ? '#1f2937' : '#e8f4fd', 
          padding: '12px', 
          marginBottom: '16px', 
          borderRadius: '8px',
          fontSize: '14px',
          border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`
        }}>
          📊 Current View: <strong>{view}</strong> | Component: {view === 'locations' ? 'Locations' : view === 'events' ? 'Events' : 'Routes'}
        </div>
        {view === 'locations' && <Locations darkMode={darkMode} />}
        {view === 'events' && <Events darkMode={darkMode} />}
        {view === 'routes' && <Routes darkMode={darkMode} />}
      </main>
    </div>
  )
}
