import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import Events from './features/Events'
import Locations from './features/Locations'
import Routes from './features/Routes'
import LoadingScreen from './components/LoadingScreen'


type View = 'locations' | 'events' | 'routes'

export default function App() {
  console.log('App component rendering...')
  const [session, setSession] = useState<any>(null)
  const [email, setEmail] = useState('')
  const [view, setView] = useState<View>('locations')
  const [isLoading, setIsLoading] = useState(true)
  const [isSendingLink, setIsSendingLink] = useState(false)
  const [linkSent, setLinkSent] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [networkError, setNetworkError] = useState('')
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode')
    return saved ? JSON.parse(saved) : false
  })

  useEffect(() => {
    console.log('Setting up auth...')
    
    // Always hide loading screen after a maximum of 2 seconds
    const loadingTimeout = setTimeout(() => {
      console.log('Loading timeout reached, hiding loading screen')
      setIsLoading(false)
    }, 2000)
    
    try {
      supabase.auth.getSession().then(({ data }) => {
        console.log('Session data:', data)
        setSession(data.session)
        // Hide loading screen after initial auth check
        clearTimeout(loadingTimeout)
        setTimeout(() => setIsLoading(false), 500)
      }).catch((error) => {
        console.error('Session fetch error:', error)
        clearTimeout(loadingTimeout)
        setTimeout(() => setIsLoading(false), 500)
      })
      
      const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
        console.log('Auth state changed:', s)
        setSession(s)
      })
      return () => {
        clearTimeout(loadingTimeout)
        sub.subscription.unsubscribe()
      }
    } catch (error) {
      console.error('Auth setup error:', error)
      // Hide loading screen even if there's an error
      clearTimeout(loadingTimeout)
      setTimeout(() => setIsLoading(false), 500)
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

  // Email validation function
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // Clear errors when email changes
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value
    setEmail(newEmail)
    
    // Clear errors when user starts typing
    if (emailError) setEmailError('')
    if (networkError) setNetworkError('')
  }

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSendingLink || linkSent) return
    
    // Clear previous errors
    setEmailError('')
    setNetworkError('')
    
    // Validate email format
    if (!email.trim()) {
      setEmailError('Email address is required')
      return
    }
    
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address')
      return
    }
    
    setIsSendingLink(true)
    try {
      console.log('Attempting to send magic link to:', email)
      console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL)
      console.log('Supabase Key present:', !!import.meta.env.VITE_SUPABASE_ANON_KEY)
      
      const { data, error } = await supabase.auth.signInWithOtp({ email })
      
      console.log('Supabase response:', { data, error })
      
      if (error) {
        console.error('Supabase error details:', {
          message: error.message,
          status: error.status,
          statusText: error.statusText
        })
        
        // Handle different types of errors
        if (error.message.includes('Invalid email')) {
          setEmailError('Please enter a valid email address')
        } else if (error.message.includes('rate limit') || error.message.includes('too many')) {
          setNetworkError('Too many requests. Please wait a moment and try again.')
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          setNetworkError('Network error. Please check your connection and try again.')
        } else if (error.message.includes('Invalid API key') || error.message.includes('API key')) {
          setNetworkError('Configuration error. Please check your Supabase settings.')
        } else if (error.message.includes('Invalid URL') || error.message.includes('URL')) {
          setNetworkError('Configuration error. Please check your Supabase URL.')
        } else {
          setNetworkError(`Error: ${error.message}`)
        }
        setIsSendingLink(false)
      } else {
        console.log('Magic link sent successfully')
        setLinkSent(true)
        setIsSendingLink(false)
      }
    } catch (err: any) {
      console.error('Magic link error:', err)
      console.error('Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack
      })
      
      if (err.message?.includes('network') || err.message?.includes('fetch')) {
        setNetworkError('Network error. Please check your connection and try again.')
      } else if (err.message?.includes('Failed to fetch')) {
        setNetworkError('Cannot connect to Supabase. Please check your internet connection.')
      } else {
        setNetworkError(`Connection error: ${err.message}`)
      }
      setIsSendingLink(false)
    }
  }

  // Show loading screen during initial load
  if (isLoading) {
    return <LoadingScreen onComplete={() => setIsLoading(false)} />
  }

  if (!session) {
    return (
      <div style={{ 
        minHeight: '100vh',
        background: darkMode 
          ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)'
          : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{ 
          maxWidth: 420, 
          width: '100%',
          background: darkMode ? '#1f2937' : '#ffffff',
          color: darkMode ? '#f9fafb' : '#1f2937',
          padding: '40px',
          borderRadius: '20px',
          boxShadow: darkMode 
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05)' 
            : '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          backdropFilter: 'blur(10px)',
          border: darkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(255, 255, 255, 0.8)'
        }}>
          {/* Header */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '32px' 
          }}>
            <div>
              <h1 style={{ 
                margin: 0, 
                fontSize: '32px', 
                fontWeight: '700',
                background: darkMode 
                  ? 'linear-gradient(135deg, #f9fafb 0%, #e5e7eb 100%)'
                  : 'linear-gradient(135deg, #1f2937 0%, #374151 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                SSA Admin
              </h1>
              <p style={{ 
                margin: '8px 0 0 0', 
                color: darkMode ? '#9ca3af' : '#6b7280',
                fontSize: '16px',
                fontWeight: '500'
              }}>
                Fiddletown Data Management
              </p>
            </div>
            <button 
              onClick={toggleDarkMode}
              style={{
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '12px',
                borderRadius: '12px',
                background: darkMode ? '#374151' : '#f3f4f6',
                color: darkMode ? '#f9fafb' : '#374151',
                transition: 'all 0.2s ease',
                boxShadow: darkMode 
                  ? '0 4px 6px -1px rgba(0, 0, 0, 0.3)' 
                  : '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = darkMode ? '#4b5563' : '#e5e7eb'
                e.currentTarget.style.transform = 'scale(1.05)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = darkMode ? '#374151' : '#f3f4f6'
                e.currentTarget.style.transform = 'scale(1)'
              }}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>

          {/* Description */}
          <p style={{ 
            marginBottom: '32px', 
            color: darkMode ? '#d1d5db' : '#6b7280',
            fontSize: '16px',
            lineHeight: '1.5'
          }}>
            Sign in to manage your datasets and content.
          </p>

          {/* Form */}
          <form onSubmit={sendMagicLink} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: darkMode ? '#f3f4f6' : '#374151'
              }}>
                Email Address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={handleEmailChange}
                disabled={isSendingLink || linkSent}
                style={{ 
                  width: '100%', 
                  padding: '16px',
                  border: `2px solid ${
                    emailError 
                      ? '#ef4444' 
                      : darkMode ? '#374151' : '#e5e7eb'
                  }`,
                  borderRadius: '12px',
                  background: darkMode ? '#374151' : '#ffffff',
                  color: darkMode ? '#f9fafb' : '#1f2937',
                  fontSize: '16px',
                  transition: 'all 0.2s ease',
                  outline: 'none',
                  opacity: (isSendingLink || linkSent) ? 0.6 : 1,
                  cursor: (isSendingLink || linkSent) ? 'not-allowed' : 'text'
                }}
                onFocus={(e) => {
                  if (!isSendingLink && !linkSent) {
                    e.target.style.borderColor = emailError ? '#ef4444' : '#3b82f6'
                    e.target.style.boxShadow = emailError 
                      ? '0 0 0 3px rgba(239, 68, 68, 0.1)'
                      : '0 0 0 3px rgba(59, 130, 246, 0.1)'
                  }
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = emailError 
                    ? '#ef4444' 
                    : darkMode ? '#374151' : '#e5e7eb'
                  e.target.style.boxShadow = 'none'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isSendingLink && !linkSent) {
                    sendMagicLink(e)
                  }
                }}
              />
              
              {/* Email Error Message */}
              {emailError && (
                <div style={{
                  marginTop: '8px',
                  padding: '8px 12px',
                  background: darkMode ? '#7f1d1d' : '#fef2f2',
                  border: `1px solid ${darkMode ? '#991b1b' : '#fecaca'}`,
                  borderRadius: '6px',
                  color: darkMode ? '#fca5a5' : '#dc2626',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span>⚠️</span>
                  {emailError}
                </div>
              )}
            </div>
            
            <button 
              type="submit"
              disabled={isSendingLink || linkSent}
              style={{
                background: linkSent 
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : isSendingLink
                  ? 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'
                  : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                border: 'none',
                color: 'white',
                padding: '16px 24px',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: (isSendingLink || linkSent) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: linkSent 
                  ? '0 4px 14px 0 rgba(16, 185, 129, 0.3)'
                  : isSendingLink
                  ? '0 4px 14px 0 rgba(107, 114, 128, 0.3)'
                  : '0 4px 14px 0 rgba(59, 130, 246, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: (isSendingLink || linkSent) ? 0.8 : 1
              }}
              onMouseEnter={(e) => {
                if (!isSendingLink && !linkSent) {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 6px 20px 0 rgba(59, 130, 246, 0.4)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isSendingLink && !linkSent) {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 14px 0 rgba(59, 130, 246, 0.3)'
                }
              }}
              onMouseDown={(e) => {
                if (!isSendingLink && !linkSent) {
                  e.currentTarget.style.transform = 'translateY(0)'
                }
              }}
            >
              {isSendingLink ? (
                <>
                  <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                  Sending...
                </>
              ) : linkSent ? (
                <>
                  <span>✅</span>
                  Magic Link Sent!
                </>
              ) : (
                <>
                  <span>📧</span>
                  Send Magic Link
                </>
              )}
            </button>
            
            {/* Network Error Message */}
            {networkError && (
              <div style={{
                padding: '12px 16px',
                background: darkMode ? '#7f1d1d' : '#fef2f2',
                border: `1px solid ${darkMode ? '#991b1b' : '#fecaca'}`,
                borderRadius: '8px',
                color: darkMode ? '#fca5a5' : '#dc2626',
                fontSize: '14px',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}>
                <span>🚫</span>
                {networkError}
              </div>
            )}

            {/* Success Status Message */}
            {linkSent && (
              <div style={{
                padding: '12px 16px',
                background: darkMode ? '#064e3b' : '#ecfdf5',
                border: `1px solid ${darkMode ? '#065f46' : '#a7f3d0'}`,
                borderRadius: '8px',
                color: darkMode ? '#6ee7b7' : '#065f46',
                fontSize: '14px',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}>
                <span>📬</span>
                Check your email for the magic link
              </div>
            )}
          </form>

          {/* Footer */}
          <div style={{
            marginTop: '32px',
            paddingTop: '24px',
            borderTop: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
            textAlign: 'center'
          }}>
            <p style={{
              margin: 0,
              fontSize: '14px',
              color: darkMode ? '#9ca3af' : '#6b7280'
            }}>
              Secure authentication powered by Supabase
            </p>
          </div>
        </div>
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
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
        background: darkMode ? '#1f2937' : '#f9fafb',
        borderRight: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
        padding: '20px',
        zIndex: 10
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
        background: darkMode ? '#111827' : '#ffffff',
        color: darkMode ? '#f9fafb' : '#1f2937',
        padding: '20px',
        overflowY: 'auto',
        height: '100vh'
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
