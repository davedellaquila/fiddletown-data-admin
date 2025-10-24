import { useEffect, useState } from 'react'
import StartupLogo from './StartupLogo'

interface LoadingScreenProps {
  onComplete?: () => void
}

export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0)
  const [loadingText, setLoadingText] = useState('Initializing...')

  useEffect(() => {
    const loadingSteps = [
      { progress: 20, text: 'Loading application...' },
      { progress: 40, text: 'Connecting to database...' },
      { progress: 60, text: 'Initializing components...' },
      { progress: 80, text: 'Preparing interface...' },
      { progress: 100, text: 'Ready!' }
    ]

    let currentStep = 0
    const interval = setInterval(() => {
      if (currentStep < loadingSteps.length) {
        const step = loadingSteps[currentStep]
        setProgress(step.progress)
        setLoadingText(step.text)
        currentStep++
      } else {
        clearInterval(interval)
        setTimeout(() => {
          onComplete?.()
        }, 500)
      }
    }, 300)

    return () => clearInterval(interval)
  }, [onComplete])

  return (
    <div 
      className="loading-screen"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        color: 'white',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji'
      }}
    >
      {/* Logo/Icon */}
      <div className="loading-logo" style={{ marginBottom: '40px' }}>
        <StartupLogo size={120} />
      </div>

      {/* App Title */}
      <h1 style={{
        fontSize: '2.5rem',
        fontWeight: '700',
        margin: '0 0 8px 0',
        textAlign: 'center',
        textShadow: '0 2px 4px rgba(0,0,0,0.3)',
        background: 'linear-gradient(45deg, #fff, #f0f9ff)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text'
      }}>
        SSA Admin
      </h1>

      <p style={{
        fontSize: '1.1rem',
        margin: '0 0 40px 0',
        opacity: 0.9,
        textAlign: 'center',
        textShadow: '0 1px 2px rgba(0,0,0,0.3)'
      }}>
        Fiddletown Data Management
      </p>

      {/* Progress Bar Container */}
      <div 
        className="loading-progress"
        style={{
          width: '300px',
          maxWidth: '90vw',
          marginBottom: '20px'
        }}
      >
        {/* Progress Bar Background */}
        <div 
          role="progressbar"
          aria-label="Loading progress"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{
            width: '100%',
            height: '8px',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '4px',
            overflow: 'hidden',
            backdropFilter: 'blur(10px)'
          }}
        >
          {/* Progress Bar Fill */}
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #4ade80, #22c55e, #16a34a)',
            borderRadius: '4px',
            transition: 'width 0.3s ease-out',
            boxShadow: '0 0 10px rgba(74, 222, 128, 0.5)',
            animation: 'progressGlow 2s ease-in-out infinite'
          }} />
        </div>

        {/* Progress Percentage */}
        <div style={{
          textAlign: 'center',
          marginTop: '12px',
          fontSize: '0.9rem',
          fontWeight: '600',
          opacity: 0.9
        }}>
          {progress}%
        </div>
      </div>

      {/* Loading Text */}
      <div 
        className="loading-text"
        style={{
          fontSize: '1rem',
          opacity: 0.8,
          textAlign: 'center',
          minHeight: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {loadingText}
      </div>

      {/* Animated Dots */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginTop: '20px'
      }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: '8px',
              height: '8px',
              background: 'rgba(255, 255, 255, 0.6)',
              borderRadius: '50%',
              animation: `bounce 1.4s ease-in-out ${i * 0.16}s infinite both`
            }}
          />
        ))}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        @keyframes bounce {
          0%, 80%, 100% { 
            transform: scale(0);
            opacity: 0.5;
          }
          40% { 
            transform: scale(1);
            opacity: 1;
          }
        }
        
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        
        @keyframes progressGlow {
          0%, 100% { box-shadow: 0 0 10px rgba(74, 222, 128, 0.3); }
          50% { box-shadow: 0 0 20px rgba(74, 222, 128, 0.6); }
        }
      `}</style>
    </div>
  )
}
