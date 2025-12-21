import React from 'react'

interface IconActionButtonProps {
  icon: React.ReactNode
  onClick: (e: React.MouseEvent) => void
  title: string
  darkMode?: boolean
  'aria-label'?: string
}

/**
 * Shared icon-only action button component matching the Events module style.
 * Used for Archive and Delete actions in table rows.
 */
export default function IconActionButton({
  icon,
  onClick,
  title,
  darkMode = false,
  'aria-label': ariaLabel
}: IconActionButtonProps) {
  return (
    <button
      className="btn icon-action-btn"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel || title}
      style={{
        width: 32,
        height: 32,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        background: 'transparent',
        border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
        color: darkMode ? '#e5e7eb' : '#374151',
        cursor: 'pointer'
      }}
    >
      {icon}
    </button>
  )
}

