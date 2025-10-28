import React, { useState } from 'react'
import { NavigationButtons } from './NavigationButtons'

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
  // Always render the dialog but control visibility with CSS to prevent jarring transitions
  const [isNavigating, setIsNavigating] = useState(false)

  // Enhanced navigation functions with loading state
  const navigateToNext = async () => {
    if (!editing?.id || rows.length === 0) return
    setIsNavigating(true)
    try {
      await saveFunction()
      const currentIndex = rows.findIndex(r => r.id === editing.id)
      if (currentIndex >= 0 && currentIndex < rows.length - 1) {
        setEditing(rows[currentIndex + 1])
      }
    } catch (error) {
      console.error('Error during navigation to next:', error)
    } finally {
      // Small delay to prevent flash
      setTimeout(() => setIsNavigating(false), 100)
    }
  }

  const navigateToPrevious = async () => {
    if (!editing?.id || rows.length === 0) return
    setIsNavigating(true)
    try {
      await saveFunction()
      const currentIndex = rows.findIndex(r => r.id === editing.id)
      if (currentIndex > 0) {
        setEditing(rows[currentIndex - 1])
      }
    } catch (error) {
      console.error('Error during navigation to previous:', error)
    } finally {
      // Small delay to prevent flash
      setTimeout(() => setIsNavigating(false), 100)
    }
  }

  // Enhanced close handler that auto-saves before closing (only for existing records)
  const handleClose = async () => {
    if (busy) return
    
    try {
      // Only auto-save if it's an existing record (has an ID)
      // For new records, just close without saving
      if (editing?.id) {
        await saveFunction()
      }
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
        // Soft translucent overlay so list remains visible underneath
        background: darkMode ? 'rgba(17,24,39,0.35)' : 'rgba(255,255,255,0.25)',
        backdropFilter: 'blur(4px) saturate(0.9)',
        WebkitBackdropFilter: 'blur(4px) saturate(0.9)',
        zIndex: 1000, 
        display: isOpen ? 'flex' : 'none', // Control visibility with CSS instead of conditional rendering
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '20px',
        transition: 'background-color 120ms ease',
        willChange: 'backdrop-filter'
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

          {/* Save and Close buttons - Right aligned */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button 
              onClick={saveFunction}
              disabled={busy}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: busy ? 'not-allowed' : 'pointer',
                color: busy ? '#9ca3af' : '#10b981',
                padding: '4px',
                borderRadius: '4px',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!busy) {
                  e.currentTarget.style.backgroundColor = darkMode ? '#374151' : '#f3f4f6'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
              title="Save changes"
            >
              ✓
            </button>
            <button 
              onClick={handleClose}
              disabled={busy}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: busy ? 'not-allowed' : 'pointer',
                color: busy ? '#9ca3af' : '#6b7280',
                padding: '4px',
                borderRadius: '4px',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!busy) {
                  e.currentTarget.style.backgroundColor = darkMode ? '#374151' : '#f3f4f6'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
              title="Close dialog"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div 
          key={editing?.id || 'new'} // Key changes when editing changes to prevent flash
          style={{
            flex: 1,
            overflowY: 'auto',
            paddingRight: '8px', // Space for scrollbar
            position: 'relative'
          }}
        >
          {isNavigating && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: darkMode ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)'
            }}>
              <div style={{
                color: darkMode ? '#f9fafb' : '#374151',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                Navigating...
              </div>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}