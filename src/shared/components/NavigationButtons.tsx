import React, { useRef } from 'react'

interface NavigationButtonsProps<T> {
  editing: T | null
  rows: T[]
  onNavigateToPrevious: () => Promise<void>
  onNavigateToNext: () => Promise<void>
  darkMode: boolean
  itemType: string // e.g., "event", "location", "route"
}

export function NavigationButtons<T extends Record<string, any>>({
  editing,
  rows,
  onNavigateToPrevious,
  onNavigateToNext,
  darkMode,
  itemType
}: NavigationButtonsProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)

  if (!editing?.id) return null

  const currentIndex = rows.findIndex(r => r.id === editing.id)
  const isFirst = currentIndex === 0
  const isLast = currentIndex === rows.length - 1

  // Use compact arrow-only buttons for all item types
  const isCompact = true

  const buttonStyle = {
    background: darkMode ? '#374151' : '#f3f4f6',
    border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
    borderRadius: '6px',
    padding: isCompact ? '6px' : '6px 12px',
    cursor: 'pointer',
    color: darkMode ? '#f9fafb' : '#374151',
    minWidth: isCompact ? '36px' : '100px',
    width: isCompact ? '36px' : 'auto',
    height: isCompact ? '36px' : 'auto',
    textAlign: 'center' as const,
    fontSize: '14px'
  }

  const disabledStyle = {
    ...buttonStyle,
    cursor: 'not-allowed',
    color: darkMode ? '#6b7280' : '#9ca3af',
    opacity: 0.5
  }

  return (
    <div ref={containerRef} style={{ display: 'flex', gap: '8px' }}>
      <button 
        onClick={() => onNavigateToPrevious()}
        disabled={isFirst}
        style={isFirst ? disabledStyle : buttonStyle}
        title={`Previous ${itemType} (⌘← / Ctrl←)`}
      >
        {isCompact ? '←' : '←'}
      </button>
      <button 
        onClick={() => onNavigateToNext()}
        disabled={isLast}
        style={isLast ? disabledStyle : buttonStyle}
        title={`Next ${itemType} (⌘→ / Ctrl→)`}
      >
        {isCompact ? '→' : '→'}
      </button>
    </div>
  )
}

