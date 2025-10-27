import React from 'react'

interface ModalDialogProps {
  isOpen: boolean
  onClose: () => void
  title: string
  darkMode: boolean
  children: React.ReactNode
  maxWidth?: string
  showNavigation?: boolean
  onPrevious?: () => void
  onNext?: () => void
  canNavigatePrevious?: boolean
  canNavigateNext?: boolean
}

export const ModalDialog: React.FC<ModalDialogProps> = ({
  isOpen,
  onClose,
  title,
  darkMode,
  children,
  maxWidth = '600px',
  showNavigation = false,
  onPrevious,
  onNext,
  canNavigatePrevious = false,
  canNavigateNext = false
}) => {
  if (!isOpen) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: darkMode ? '#1f2937' : 'white',
          padding: '32px',
          borderRadius: '12px',
          maxWidth: maxWidth, 
          width: '100%', 
          maxHeight: '90vh', 
          overflow: 'hidden',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Fixed Header */}
        <div style={{
          padding: '0 0 16px 0',
          borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
          background: darkMode ? '#1f2937' : 'white',
          borderRadius: '12px 12px 0 0',
          flexShrink: 0
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between'
          }}>
            {/* Title - Left aligned */}
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: darkMode ? '#f9fafb' : '#1f2937' }}>
                {title}
              </h3>
            </div>
            
            {/* Navigation buttons - Centered */}
            {showNavigation && (
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={onPrevious}
                    disabled={!canNavigatePrevious}
                    style={{
                      background: darkMode ? '#374151' : '#f3f4f6',
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '14px',
                      cursor: !canNavigatePrevious ? 'not-allowed' : 'pointer',
                      color: !canNavigatePrevious ? (darkMode ? '#6b7280' : '#9ca3af') : (darkMode ? '#f9fafb' : '#374151'),
                      opacity: !canNavigatePrevious ? 0.5 : 1,
                      minWidth: '100px',
                      textAlign: 'center'
                    }}
                    title="Previous"
                  >
                    ← Previous
                  </button>
                  <button 
                    onClick={onNext}
                    disabled={!canNavigateNext}
                    style={{
                      background: darkMode ? '#374151' : '#f3f4f6',
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '14px',
                      cursor: !canNavigateNext ? 'not-allowed' : 'pointer',
                      color: !canNavigateNext ? (darkMode ? '#6b7280' : '#9ca3af') : (darkMode ? '#f9fafb' : '#374151'),
                      opacity: !canNavigateNext ? 0.5 : 1,
                      minWidth: '100px',
                      textAlign: 'center'
                    }}
                    title="Next"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
            
            {/* Close button - Right aligned */}
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
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
        </div>

        {/* Scrollable Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 0'
        }}>
          {children}
        </div>
      </div>
    </div>
  )
}
