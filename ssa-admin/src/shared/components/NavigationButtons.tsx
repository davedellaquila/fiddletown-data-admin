import React, { useState, useEffect, useRef } from 'react'

interface NavigationButtonsProps<T> {
  editing: T | null
  rows: T[]
  onNavigateToPrevious: () => void
  onNavigateToNext: () => void
  darkMode: boolean
  itemType: string // e.g., "event", "location", "route"
}

export function NavigationButtons<T extends { id?: number | string }>({
  editing,
  rows,
  onNavigateToPrevious,
  onNavigateToNext,
  darkMode,
  itemType
}: NavigationButtonsProps<T>) {
  const [isCompact, setIsCompact] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const checkSpace = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth
        // If container is less than 300px wide, use compact mode
        setIsCompact(containerWidth < 300)
      }
    }

    checkSpace()
    window.addEventListener('resize', checkSpace)
    return () => window.removeEventListener('resize', checkSpace)
  }, [])

  if (!editing?.id) return null

  const currentIndex = rows.findIndex(r => r.id === editing.id)
  const isFirst = currentIndex === 0
  const isLast = currentIndex === rows.length - 1

  const buttonStyle = {
    background: darkMode ? '#374151' : '#f3f4f6',
    border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
    borderRadius: '6px',
    padding: isCompact ? '6px' : '6px 12px',
    cursor: 'pointer',
    color: darkMode ? '#f9fafb' : '#374151',
    minWidth: isCompact ? '32px' : '100px',
    textAlign: 'center' as const,
    fontSize: isCompact ? '14px' : '14px'
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
        onClick={onNavigateToPrevious}
        disabled={isFirst}
        style={isFirst ? disabledStyle : buttonStyle}
        title={isCompact ? `Previous ${itemType}` : `Previous ${itemType}`}
      >
        {isCompact ? '←' : '← Previous'}
      </button>
      <button 
        onClick={onNavigateToNext}
        disabled={isLast}
        style={isLast ? disabledStyle : buttonStyle}
        title={isCompact ? `Next ${itemType}` : `Next ${itemType}`}
      >
        {isCompact ? '→' : 'Next →'}
      </button>
    </div>
  )
}
