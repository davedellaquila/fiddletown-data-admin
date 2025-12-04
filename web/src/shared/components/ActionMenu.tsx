import React, { useState, useRef, useEffect } from 'react'

export interface ActionMenuItem {
  id: string
  label: string
  icon?: string
  onClick: () => void
  disabled?: boolean
  requiresSelection?: boolean
  variant?: 'default' | 'success' | 'warning' | 'danger'
}

interface ActionMenuProps {
  items: ActionMenuItem[]
  selectedCount?: number
  darkMode?: boolean
  disabled?: boolean
}

export default function ActionMenu({ items, selectedCount = 0, darkMode = false, disabled = false }: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close menu when clicking outside
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

  // Close menu on Escape key
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

  const handleItemClick = (item: ActionMenuItem) => {
    if (item.disabled || (item.requiresSelection && selectedCount === 0)) return
    item.onClick()
    setIsOpen(false)
  }

  const visibleItems = items.filter(item => !item.requiresSelection || selectedCount > 0)

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

