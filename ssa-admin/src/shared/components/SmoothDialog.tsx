import { ReactNode } from 'react'
import * as React from 'react'

interface SmoothDialogProps {
  isOpen: boolean
  isNavigating?: boolean
  onOverlayClick: () => void
  darkMode: boolean
  children: ReactNode
  maxWidth?: string
}

export const SmoothDialog = ({
  isOpen,
  isNavigating = false,
  onOverlayClick,
  darkMode,
  children,
  maxWidth = '800px'
}: SmoothDialogProps) => {
  if (!isOpen) return null

  return (
    <div 
      onClick={onOverlayClick}
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        background: 'rgba(0,0,0,0.5)', 
        zIndex: 1000, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease-in-out'
      }}
    >
      {isNavigating ? (
        <div style={{
          background: darkMode ? '#1f2937' : 'white',
          padding: '40px',
          borderRadius: '12px',
          textAlign: 'center',
          color: darkMode ? '#f9fafb' : '#1f2937',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          animation: 'slideIn 0.2s ease-in-out'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>⏳</div>
          <div>Loading next record...</div>
        </div>
      ) : (
        <div 
          onClick={(e) => e.stopPropagation()}
          style={{ 
            background: darkMode ? '#1f2937' : 'white', 
            padding: '32px',
            borderRadius: '12px', 
            maxWidth: maxWidth, 
            width: '100%', 
            maxHeight: '90vh', 
            overflow: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            animation: 'slideIn 0.2s ease-in-out'
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}
