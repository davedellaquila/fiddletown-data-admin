import React from 'react'

interface FormFieldProps {
  label: string
  name: string
  value: string | number
  onChange: (value: string | number) => void
  onInput?: (value: string | number) => void
  onBlur?: (value: string | number) => void
  type?: 'text' | 'number' | 'email' | 'url' | 'textarea' | 'select' | 'date'
  options?: { value: string; label: string }[]
  required?: boolean
  placeholder?: string
  minHeight?: string
  resize?: 'vertical' | 'horizontal' | 'both' | 'none'
  editingId?: string
  darkMode?: boolean
}

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
  darkMode = false
}: FormFieldProps) {
  const fieldKey = `${name}-${editingId || 'new'}`
  
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

  const focusStyle = {
    ...commonStyle,
    border: darkMode ? '1px solid #3b82f6' : '1px solid #3b82f6',
    boxShadow: darkMode ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : '0 0 0 3px rgba(59, 130, 246, 0.1)'
  }

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
            defaultValue={value || ''}
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
            defaultValue={value || ''}
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
          <input
            key={fieldKey}
            type={type}
            defaultValue={value || ''}
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
            style={baseStyle}
            placeholder={placeholder}
          />
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
