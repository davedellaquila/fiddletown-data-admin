import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface PortalDialogProps {
  isOpen: boolean
  onClose: () => void
  title: string
  darkMode: boolean
  children: React.ReactNode
  maxWidth?: string
  headerContent?: React.ReactNode
  isNavigating?: boolean
  onOverlayClick?: () => void
}

export const PortalDialog: React.FC<PortalDialogProps> = ({
  isOpen,
  onClose,
  title,
  darkMode,
  children,
  maxWidth = '600px',
  headerContent,
  isNavigating = false,
  onOverlayClick
}) => {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when dialog is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleOverlayClick = () => {
    if (onOverlayClick) {
      onOverlayClick()
    } else {
      onClose()
    }
  }

  return createPortal(
    <div
      ref={dialogRef}
      onClick={handleOverlayClick}
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
        opacity: 1,
        transition: 'opacity 0.2s ease-in-out'
      }}
    >
      {isNavigating ? (
        <div style={{
          background: darkMode ? '#1f2937' : 'white',
          padding: '40px',
          borderRadius: '12px',
          textAlign: 'center',
          color: darkMode ? '#f9fafb' : '#1f2937',
          transform: 'scale(1)',
          transition: 'transform 0.2s ease-in-out'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>⏳</div>
          <div>Loading next record...</div>
        </div>
      ) : (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: darkMode ? '#1f2937' : 'white',
            padding: '0',
            borderRadius: '12px',
            maxWidth: maxWidth,
            width: '100%',
            maxHeight: '90vh',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            transform: 'scale(1)',
            transition: 'transform 0.2s ease-in-out'
          }}
        >
          {/* Fixed Header */}
          <div style={{
            padding: '24px 32px 16px 32px',
            borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
            background: darkMode ? '#1f2937' : 'white',
            borderRadius: '12px 12px 0 0',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: darkMode ? '#f9fafb' : '#1f2937' }}>
                {title}
              </h3>
              {headerContent}
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: darkMode ? '#6b7280' : '#6b7280',
                  padding: '4px'
                }}
                title="Close dialog"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 32px'
          }}>
            {children}
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
