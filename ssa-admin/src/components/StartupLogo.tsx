import { useEffect, useState } from 'react'

interface StartupLogoProps {
  size?: number
  className?: string
}

export default function StartupLogo({ size = 120, className = '' }: StartupLogoProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div 
      className={`startup-logo ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(10px)',
        border: '2px solid rgba(255, 255, 255, 0.2)',
        position: 'relative',
        overflow: 'hidden',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'scale(1)' : 'scale(0.8)',
        transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}
    >
      {/* Animated background gradient */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(45deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05), rgba(255,255,255,0.1))',
        backgroundSize: '200% 200%',
        animation: 'shimmer 3s ease-in-out infinite',
        borderRadius: '50%'
      }} />
      
      {/* Main icon */}
      <div style={{
        fontSize: `${size * 0.4}px`,
        fontWeight: 'bold',
        color: 'white',
        textShadow: '0 2px 4px rgba(0,0,0,0.3)',
        position: 'relative',
        zIndex: 1,
        animation: 'rotate 4s linear infinite'
      }}>
        🍇
      </div>
      
      {/* Pulsing ring */}
      <div style={{
        position: 'absolute',
        top: '-4px',
        left: '-4px',
        right: '-4px',
        bottom: '-4px',
        border: '2px solid rgba(255, 255, 255, 0.3)',
        borderRadius: '50%',
        animation: 'pulse 2s ease-in-out infinite'
      }} />
      
      {/* Inner glow */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '20%',
        right: '20%',
        bottom: '20%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
        borderRadius: '50%',
        animation: 'glow 2s ease-in-out infinite alternate'
      }} />
    </div>
  )
}
