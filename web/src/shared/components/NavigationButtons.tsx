/**
 * NavigationButtons Component
 * 
 * Compact navigation buttons for moving between records in edit dialogs.
 * Displays Previous/Next arrows with keyboard shortcut hints.
 * 
 * Features:
 * - Disables buttons at first/last record
 * - Shows keyboard shortcuts in tooltips
 * - Compact arrow-only design
 * - Dark mode support
 * 
 * Used in AutoSaveEditDialog for navigating between records while editing.
 * 
 * @module NavigationButtons
 */
import React, { useRef } from 'react'

/**
 * Props for NavigationButtons component
 * 
 * @template T - Type of record being navigated (must have an 'id' field)
 */
interface NavigationButtonsProps<T> {
  editing: T | null // Currently editing record
  rows: T[] // Array of all records to navigate through
  onNavigateToPrevious: () => Promise<void> // Callback for previous button
  onNavigateToNext: () => Promise<void> // Callback for next button
  darkMode: boolean // Whether dark mode is enabled
  itemType: string // Type name for tooltips (e.g., "event", "location", "route")
}

/**
 * NavigationButtons component
 * 
 * Renders Previous (←) and Next (→) buttons for navigating between records.
 * Buttons are disabled when at the first or last record.
 * 
 * Keyboard shortcuts:
 * - ⌘/Ctrl + ← : Previous record
 * - ⌘/Ctrl + → : Next record
 */
export function NavigationButtons<T extends Record<string, any>>({
  editing,
  rows,
  onNavigateToPrevious,
  onNavigateToNext,
  darkMode,
  itemType
}: NavigationButtonsProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Don't render if no record is being edited (e.g., creating new record)
  if (!editing?.id) return null

  // Find current record position in the rows array
  const currentIndex = rows.findIndex(r => r.id === editing.id)
  const isFirst = currentIndex === 0 // At first record
  const isLast = currentIndex === rows.length - 1 // At last record

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

