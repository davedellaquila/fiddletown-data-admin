import React from 'react'

interface ModalDialogProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  maxWidth?: string
  busy?: boolean
}

export default function ModalDialog({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = '700px',
  busy = false
}: ModalDialogProps) {
  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if clicking the backdrop, not the dialog content
    if (e.target === e.currentTarget && !busy) {
      onClose()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Close on Escape key
    if (e.key === 'Escape' && !busy) {
      onClose()
    }
  }

  return (
    <div 
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
        padding: '20px'
      }}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div 
        style={{ 
          background: 'white', 
          padding: '32px', 
          borderRadius: '12px', 
          maxWidth: maxWidth, 
          width: '100%', 
          maxHeight: '90vh', 
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid rgba(0, 0, 0, 0.1)'
        }}
        onClick={(e) => e.stopPropagation()} // Prevent backdrop click when clicking inside dialog
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: '#1f2937' }}>
            {title}
          </h3>
          <button 
            onClick={onClose}
            disabled={busy}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: busy ? 'not-allowed' : 'pointer',
              color: busy ? '#9ca3af' : '#6b7280',
              padding: '4px'
            }}
            title="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
