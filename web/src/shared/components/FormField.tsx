/**
 * FormField Component
 * 
 * A reusable form field component that supports multiple input types:
 * - text, number, email, url, date (input fields)
 * - textarea (multi-line text)
 * - select (dropdown)
 * 
 * Features:
 * - Consistent styling across all field types
 * - Dark mode support
 * - Focus/blur handlers for validation
 * - Optional end icon (e.g., for clear buttons)
 * - Required field indicator
 * 
 * Used throughout the application in edit dialogs for consistent form UX.
 * 
 * @module FormField
 */
import React from 'react'

/**
 * Props for FormField component
 */
interface FormFieldProps {
  label: string // Field label displayed above the input
  name: string // Field name (used for form identification)
  value: string | number // Current field value
  onChange: (value: string | number) => void // Callback when value changes
  onInput?: (value: string | number) => void // Callback on input event (fires on every keystroke)
  onBlur?: (value: string | number) => void // Callback when field loses focus
  type?: 'text' | 'number' | 'email' | 'url' | 'textarea' | 'select' | 'date' // Input type
  options?: { value: string; label: string }[] // Options for select dropdown
  required?: boolean // Whether field is required (shows asterisk)
  placeholder?: string // Placeholder text
  minHeight?: string // Minimum height (for textarea)
  resize?: 'vertical' | 'horizontal' | 'both' | 'none' // Resize behavior for textarea
  editingId?: string // ID of item being edited (used for unique key generation)
  darkMode?: boolean // Whether dark mode is enabled
  endIcon?: React.ReactNode // Icon/button to display at end of input
  onEndIconClick?: () => void // Callback when end icon is clicked
  endIconTitle?: string // Tooltip text for end icon
}

/**
 * FormField component
 * 
 * Renders a labeled form field with consistent styling and behavior.
 * Automatically handles type conversion for number fields.
 */
export default function FormField({
  label,
  name,
  value,
  onChange,
  onInput,
  onBlur,
  type = 'text',
  options = [],
  required = false,
  placeholder,
  minHeight,
  resize = 'vertical',
  editingId,
  darkMode = false,
  endIcon,
  onEndIconClick,
  endIconTitle
}: FormFieldProps) {
  // Unique key for this field instance (helps React track field state when editing different items)
  const fieldKey = `${name}-${editingId || 'new'}`
  
  /**
   * Base styles applied to all field types
   * Adapts to dark mode
   */
  const commonStyle = {
    width: '100%',
    padding: '12px',
    border: darkMode ? '1px solid #4b5563' : '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    background: darkMode ? '#374151' : '#fff',
    color: darkMode ? '#f9fafb' : '#000',
    transition: 'all 0.2s ease',
    outline: 'none'
  }

  /**
   * Styles applied when field is focused
   * Adds blue border and subtle shadow for visual feedback
   */
  const focusStyle = {
    ...commonStyle,
    border: darkMode ? '1px solid #3b82f6' : '1px solid #3b82f6',
    boxShadow: darkMode ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : '0 0 0 3px rgba(59, 130, 246, 0.1)'
  }

  /**
   * Handle value changes
   * 
   * Automatically converts number fields to numbers, others remain strings
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (type === 'number') {
      onChange(Number(e.target.value))
    } else {
      onChange(e.target.value)
    }
  }

  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    if (onInput) {
      if (type === 'number') {
        onInput(Number(e.currentTarget.value))
      } else {
        onInput(e.currentTarget.value)
      }
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (onBlur) {
      if (type === 'number') {
        onBlur(Number(e.target.value))
      } else {
        onBlur(e.target.value)
      }
    }
  }

  /**
   * Render the appropriate input element based on type
   * 
   * Handles three main categories:
   * - textarea: Multi-line text input
   * - select: Dropdown with options
   * - default: Single-line input (text, number, email, url, date)
   */
  const renderField = () => {
    const baseStyle = {
      ...commonStyle,
      ':hover': {
        border: darkMode ? '1px solid #6b7280' : '1px solid #9ca3af'
      }
    }

    switch (type) {
      case 'textarea':
        return (
          <textarea
            key={fieldKey}
            value={(value as any) ?? ''}
            onChange={handleChange}
            onFocus={(e) => {
              Object.assign(e.target.style, focusStyle)
            }}
            onBlur={(e) => {
              Object.assign(e.target.style, commonStyle)
              if (onBlur) {
                onBlur(e.target.value)
              }
            }}
            style={{
              ...baseStyle,
              minHeight: minHeight || '80px',
              resize
            }}
            placeholder={placeholder}
          />
        )
      
      case 'select':
        return (
          <select
            key={fieldKey}
            value={(value as any) ?? ''}
            onChange={handleChange}
            onFocus={(e) => {
              Object.assign(e.target.style, focusStyle)
            }}
            onBlur={(e) => {
              Object.assign(e.target.style, commonStyle)
            }}
            style={baseStyle}
          >
            {options.map(option => (
              <option key={option.value} value={option.value} style={{
                background: darkMode ? '#374151' : '#fff',
                color: darkMode ? '#f9fafb' : '#000'
              }}>
                {option.label}
              </option>
            ))}
          </select>
        )
      
      default:
        return (
          <div style={{ position: 'relative' }}>
            <input
              key={fieldKey}
              type={type}
              value={(value as any) ?? ''}
              onChange={handleChange}
              onInput={handleInput}
              onFocus={(e) => {
                Object.assign(e.target.style, focusStyle)
              }}
              onBlur={(e) => {
                Object.assign(e.target.style, commonStyle)
                if (onBlur) {
                  if (type === 'number') {
                    onBlur(Number(e.target.value))
                  } else {
                    onBlur(e.target.value)
                  }
                }
              }}
              style={{
                ...baseStyle,
                paddingRight: endIcon ? '44px' : baseStyle.padding
              }}
              placeholder={placeholder}
            />
            {endIcon && (
              <button
                type="button"
                onClick={onEndIconClick}
                title={endIconTitle}
                style={{
                  position: 'absolute',
                  right: '6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  border: darkMode ? '1px solid #4b5563' : '1px solid #d1d5db',
                  background: darkMode ? '#374151' : '#f3f4f6',
                  color: darkMode ? '#f9fafb' : '#374151',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: onEndIconClick ? 'pointer' : 'default'
                }}
              >
                {endIcon}
              </button>
            )}
          </div>
        )
    }
  }

  return (
    <div>
      <label style={{ 
        display: 'block', 
        marginBottom: '6px', 
        fontSize: '14px', 
        fontWeight: '500', 
        color: darkMode ? '#f9fafb' : '#374151' 
      }}>
        {label} {required && '*'}
      </label>
      {renderField()}
    </div>
  )
}
