import React from 'react'

interface StickyToolbarProps {
  darkMode: boolean
  children: React.ReactNode
  className?: string
}

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
        borderRadius: '4px'
      }}
    >
      {children}
    </div>
  )
}
