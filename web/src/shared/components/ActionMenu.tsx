/**
 * ActionMenu Component
 * 
 * A dropdown menu component for bulk actions on selected items.
 * Used across Locations, Events, and Routes modules for actions like:
 * - Publish selected items
 * - Archive selected items
 * - Delete selected items
 * - Refresh data
 * - Download templates
 * 
 * Features:
 * - Automatically hides items that require selection when none are selected
 * - Supports different visual variants (success, warning, danger)
 * - Closes on outside click or Escape key
 * - Shows selected count for items that require selection
 * 
 * @module ActionMenu
 */
import React, { useState, useRef, useEffect } from 'react'

/**
 * Configuration for a single menu item
 */
export interface ActionMenuItem {
  id: string // Unique identifier for the item
  label: string // Display text
  icon?: string // Emoji or icon to display before label
  onClick: () => void // Callback when item is clicked
  disabled?: boolean // Whether the item is disabled
  requiresSelection?: boolean // Whether item should be hidden when no items are selected
  variant?: 'default' | 'success' | 'warning' | 'danger' // Visual style variant
}

/**
 * Props for ActionMenu component
 */
interface ActionMenuProps {
  items: ActionMenuItem[] // Array of menu items to display
  selectedCount?: number // Number of currently selected items (for requiresSelection items)
  darkMode?: boolean // Whether dark mode is enabled
  disabled?: boolean // Whether the entire menu is disabled
}

/**
 * ActionMenu component
 * 
 * Renders a button that opens a dropdown menu with action items.
 * Items with requiresSelection=true are hidden when selectedCount is 0.
 */
export default function ActionMenu({ items, selectedCount = 0, darkMode = false, disabled = false }: ActionMenuProps) {
  // Menu open/closed state
  const [isOpen, setIsOpen] = useState(false)
  // Refs for detecting clicks outside the menu
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  /**
   * Close menu when clicking outside
   * 
   * Listens for mousedown events and closes the menu if the click
   * is outside both the menu and the button.
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  /**
   * Close menu on Escape key
   * 
   * Provides keyboard accessibility - pressing Escape closes the menu
   */
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  /**
   * Get styles for the menu button
   * 
   * Styles adapt to dark mode and disabled state
   */
  const getButtonStyle = () => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    background: darkMode ? '#374151' : '#ffffff',
    border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
    color: darkMode ? '#f9fafb' : '#374151',
    borderRadius: '6px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    fontSize: '14px',
    fontWeight: '500'
  })

  /**
   * Get styles for a menu item
   * 
   * Applies variant colors (success, warning, danger) and handles
   * disabled/requiresSelection states
   */
  const getItemStyle = (item: ActionMenuItem) => {
    const baseStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 12px',
      width: '100%',
      textAlign: 'left',
      border: 'none',
      background: 'transparent',
      color: darkMode ? '#f9fafb' : '#374151',
      cursor: item.disabled || (item.requiresSelection && selectedCount === 0) ? 'not-allowed' : 'pointer',
      opacity: item.disabled || (item.requiresSelection && selectedCount === 0) ? 0.5 : 1,
      fontSize: '14px',
      transition: 'background-color 0.2s'
    }

    if (item.variant === 'success') {
      baseStyle.color = darkMode ? '#10b981' : '#059669'
    } else if (item.variant === 'warning') {
      baseStyle.color = darkMode ? '#f59e0b' : '#d97706'
    } else if (item.variant === 'danger') {
      baseStyle.color = darkMode ? '#ef4444' : '#dc2626'
    }

    return baseStyle
  }

  /**
   * Handle menu item click
   * 
   * Prevents action if item is disabled or requires selection but none are selected.
   * Closes the menu after clicking.
   */
  const handleItemClick = (item: ActionMenuItem) => {
    if (item.disabled || (item.requiresSelection && selectedCount === 0)) return
    item.onClick()
    setIsOpen(false)
  }

  /**
   * Filter items to show only visible ones
   * 
   * Items with requiresSelection=true are hidden when selectedCount is 0
   */
  const visibleItems = items.filter(item => !item.requiresSelection || selectedCount > 0)

  // Don't render menu if no items are visible
  if (visibleItems.length === 0) return null

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        className="btn"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        style={getButtonStyle()}
        title="Actions menu"
        aria-label="Actions menu"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span>⚙️</span>
        <span>Actions</span>
        <span style={{ fontSize: '10px', marginLeft: '4px' }}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '4px',
            minWidth: '200px',
            background: darkMode ? '#374151' : '#ffffff',
            border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
            borderRadius: '8px',
            boxShadow: darkMode
              ? '0 4px 6px -1px rgba(0, 0, 0, 0.3)'
              : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            zIndex: 10000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
          role="menu"
        >
          {visibleItems.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleItemClick(item)}
              disabled={item.disabled || (item.requiresSelection && selectedCount === 0)}
              style={getItemStyle(item)}
              onMouseEnter={(e) => {
                if (!item.disabled && !(item.requiresSelection && selectedCount === 0)) {
                  e.currentTarget.style.backgroundColor = darkMode ? '#4b5563' : '#f3f4f6'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
              role="menuitem"
            >
              {item.icon && <span>{item.icon}</span>}
              <span>{item.label}</span>
              {item.requiresSelection && selectedCount > 0 && (
                <span style={{ marginLeft: 'auto', fontSize: '12px', opacity: 0.7 }}>
                  ({selectedCount})
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

