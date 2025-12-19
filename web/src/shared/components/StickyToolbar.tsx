/**
 * StickyToolbar Component
 * 
 * A sticky toolbar container that stays at the top when scrolling.
 * Used in feature modules (Locations, Events, Routes) to keep action buttons
 * and search controls visible while scrolling through data tables.
 * 
 * Features:
 * - Sticky positioning (stays at top when scrolling)
 * - Dark mode support
 * - Consistent styling across modules
 * - High z-index to stay above table content
 * 
 * @module StickyToolbar
 */
import React from 'react'

/**
 * Props for StickyToolbar component
 */
interface StickyToolbarProps {
  darkMode: boolean // Whether dark mode is enabled
  children: React.ReactNode // Toolbar content (buttons, search, etc.)
  className?: string // Additional CSS class names
}

/**
 * StickyToolbar component
 * 
 * Renders a toolbar that sticks to the top of the viewport when scrolling.
 * Provides consistent styling and positioning for module toolbars.
 */
export default function StickyToolbar({ 
  darkMode, 
  children, 
  className = '' 
}: StickyToolbarProps) {
  return (
    <div
      className={`sticky-toolbar ${className}`}
      style={{
        marginBottom: 12,
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: darkMode ? '#1f2937' : '#f8f9fa',
        padding: '12px',
        borderBottom: `1px solid ${darkMode ? '#374151' : '#dee2e6'}`,
        borderRadius: '4px',
        border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`
      }}
    >
      {children}
    </div>
  )
}
