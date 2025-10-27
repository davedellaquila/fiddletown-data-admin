import React from 'react'
import { NavigationButtons } from './NavigationButtons'
import { useNavigationWithAutoSave } from '../hooks/useNavigationWithAutoSave'

interface AutoSaveEditDialogProps<T extends Record<string, any>> {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  maxWidth?: string
  busy?: boolean
  darkMode?: boolean
  
  // Auto-save navigation props
  editing: T | null
  rows: T[]
  saveFunction: () => Promise<void>
  setEditing: (item: T | null) => void
  itemType: string // e.g., "event", "location", "route"
}

export default function AutoSaveEditDialog<T extends Record<string, any>>({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = '700px',
  busy = false,
  darkMode = false,
  editing,
  rows,
  saveFunction,
  setEditing,
  itemType
}: AutoSaveEditDialogProps<T>) {
  if (!isOpen) return null

  // Use shared navigation hook with auto-save functionality
  const { navigateToNext, navigateToPrevious } = useNavigationWithAutoSave(
    editing,
    rows,
    saveFunction,
    setEditing
  )

  // Enhanced close handler that auto-saves before closing
  const handleClose = async () => {
    if (busy) return
    
    try {
      // Auto-save before closing
      await saveFunction()
      onClose()
    } catch (error) {
      console.error('Error saving before close:', error)
      // Still close the dialog even if save fails
      onClose()
    }
  }

  const handleBackdropClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if clicking the backdrop, not the dialog content
    if (e.target === e.currentTarget && !busy) {
      await handleClose()
    }
  }

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    // Close on Escape key
    if (e.key === 'Escape' && !busy) {
      await handleClose()
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
        onClick={(e) => e.stopPropagation()} // Prevent backdrop click when clicking inside dialog
      >
        {/* Header with navigation */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          marginBottom: '24px',
          flexShrink: 0
        }}>
          {/* Title - Left aligned */}
          <div style={{ flex: 1 }}>
            <h3 style={{ 
              margin: 0, 
              fontSize: '24px', 
              fontWeight: '600', 
              color: darkMode ? '#f9fafb' : '#1f2937' 
            }}>
              {title}
            </h3>
          </div>

          {/* Navigation buttons - Centered */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <NavigationButtons
              editing={editing}
              rows={rows}
              onNavigateToPrevious={navigateToPrevious}
              onNavigateToNext={navigateToNext}
              darkMode={darkMode}
              itemType={itemType}
            />
          </div>

          {/* Close button - Right aligned */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              onClick={handleClose}
              disabled={busy}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: busy ? 'not-allowed' : 'pointer',
                color: busy ? '#9ca3af' : '#6b7280',
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
          paddingRight: '8px' // Space for scrollbar
        }}>
          {children}
        </div>
      </div>
    </div>
  )
}