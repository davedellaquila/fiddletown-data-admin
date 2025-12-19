/**
 * ModalDialog Component
 * 
 * A simple modal dialog component with backdrop and close functionality.
 * Used for displaying content in an overlay dialog.
 * 
 * Features:
 * - Backdrop click to close
 * - Escape key to close
 * - Prevents closing when busy (e.g., during save operations)
 * - Responsive max-width
 * - Scrollable content area
 * 
 * Note: This is a simpler alternative to AutoSaveEditDialog.
 * Use AutoSaveEditDialog for edit forms with auto-save and navigation.
 * 
 * @module ModalDialog
 */
import React from 'react'

/**
 * Props for ModalDialog component
 */
interface ModalDialogProps {
  isOpen: boolean // Whether dialog is visible
  onClose: () => void // Callback when dialog should close
  title: string // Dialog title text
  children: React.ReactNode // Dialog content
  maxWidth?: string // Maximum width of dialog (default: '700px')
  busy?: boolean // Whether dialog is busy (prevents closing)
}

/**
 * ModalDialog component
 * 
 * Renders a centered modal dialog with backdrop overlay.
 * Closes on backdrop click or Escape key (unless busy).
 */
export default function ModalDialog({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = '700px',
  busy = false
}: ModalDialogProps) {
  // Don't render if not open (conditional rendering for performance)
  if (!isOpen) return null

  /**
   * Handle backdrop click
   * 
   * Only closes dialog if clicking directly on backdrop (not dialog content)
   * and not busy.
   */
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if clicking the backdrop, not the dialog content
    if (e.target === e.currentTarget && !busy) {
      onClose()
    }
  }

  /**
   * Handle keyboard events
   * 
   * Closes dialog on Escape key press (unless busy).
   */
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
