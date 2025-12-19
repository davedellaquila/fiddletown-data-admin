/**
 * KeywordSelector Component
 * 
 * A tag-based keyword input component with autocomplete suggestions.
 * Used in Events module for managing event keywords.
 * 
 * Features:
 * - Type-ahead autocomplete from existing keywords
 * - Add keywords by pressing Enter or Tab
 * - Remove keywords by clicking X on tag
 * - Remove last keyword with Backspace on empty input
 * - Keyboard navigation (Escape to close suggestions)
 * - Visual tag display with remove buttons
 * 
 * @module KeywordSelector
 */
import React, { useState, useEffect, useRef } from 'react'

/**
 * Props for KeywordSelector component
 */
interface KeywordSelectorProps {
  label: string // Field label
  value: string[] // Currently selected keywords
  onChange: (keywords: string[]) => void // Callback when keywords change
  existingKeywords?: string[] // Available keywords for autocomplete
  darkMode?: boolean // Whether dark mode is enabled
  editingId?: string // ID of item being edited (for unique key generation)
}

/**
 * KeywordSelector component
 * 
 * Renders an input field with tag-based keyword display and autocomplete dropdown.
 */
export default function KeywordSelector({
  label,
  value = [],
  onChange,
  existingKeywords = [],
  darkMode = false,
  editingId
}: KeywordSelectorProps) {
  // Input field value
  const [inputValue, setInputValue] = useState('')
  // Whether to show autocomplete suggestions dropdown
  const [showSuggestions, setShowSuggestions] = useState(false)
  // Filtered list of suggestions matching current input
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([])
  // Refs for DOM elements
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  /**
   * Filter suggestions based on input value
   * 
   * Shows up to 10 suggestions that:
   * - Match the input text (case-insensitive)
   * - Are not already selected
   */
  useEffect(() => {
    if (inputValue.trim()) {
      const lowerInput = inputValue.toLowerCase()
      const filtered = existingKeywords
        .filter(kw => 
          kw.toLowerCase().includes(lowerInput) && 
          !value.includes(kw)
        )
        .slice(0, 10) // Limit to 10 suggestions for performance
      setFilteredSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
    } else {
      setFilteredSuggestions([])
      setShowSuggestions(false)
    }
  }, [inputValue, existingKeywords, value])

  /**
   * Close suggestions when clicking outside the component
   * 
   * Improves UX by automatically closing dropdown when user clicks elsewhere
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  /**
   * Add a keyword to the selected list
   * 
   * Normalizes the keyword (trim, lowercase) and prevents duplicates
   */
  const addKeyword = (keyword: string) => {
    const trimmed = keyword.trim().toLowerCase()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
      setInputValue('')
      setShowSuggestions(false)
    }
  }

  /**
   * Remove a keyword from the selected list
   */
  const removeKeyword = (keywordToRemove: string) => {
    onChange(value.filter(kw => kw !== keywordToRemove))
  }

  /**
   * Handle keyboard input
   * 
   * Keyboard shortcuts:
   * - Enter: Add current input as keyword
   * - Tab: Add current input as keyword (prevents tabbing away)
   * - Backspace (on empty input): Remove last keyword
   * - Escape: Close suggestions and blur input
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault()
      addKeyword(inputValue)
      // Refocus the input field after adding keyword for rapid entry
      setTimeout(() => {
        inputRef.current?.focus()
      }, 0)
    } else if (e.key === 'Tab' && inputValue.trim()) {
      e.preventDefault()
      addKeyword(inputValue)
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      // Remove last keyword when backspace is pressed on empty input
      removeKeyword(value[value.length - 1])
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      inputRef.current?.blur()
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    addKeyword(suggestion)
  }

  const commonStyle = {
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

  return (
    <div>
      <label style={{ 
        display: 'block', 
        marginBottom: '6px', 
        fontSize: '14px', 
        fontWeight: '500', 
        color: darkMode ? '#f9fafb' : '#374151' 
      }}>
        {label}
      </label>
      <div ref={containerRef} style={{ position: 'relative' }}>
        {/* Selected keywords as chips */}
        {value.length > 0 && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            marginBottom: '8px',
            padding: '8px',
            background: darkMode ? '#1f2937' : '#f9fafb',
            borderRadius: '6px',
            minHeight: '40px'
          }}>
            {value.map((keyword) => (
              <span
                key={keyword}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  background: darkMode ? '#3b82f6' : '#3b82f6',
                  color: '#ffffff',
                  borderRadius: '16px',
                  fontSize: '13px',
                  fontWeight: '500'
                }}
              >
                {keyword}
                <button
                  type="button"
                  onClick={() => removeKeyword(keyword)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    padding: '0',
                    marginLeft: '4px',
                    fontSize: '16px',
                    lineHeight: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                  title="Remove keyword"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Input field */}
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (inputValue.trim() && filteredSuggestions.length > 0) {
                setShowSuggestions(true)
              }
              if (inputRef.current) {
                Object.assign(inputRef.current.style, focusStyle)
              }
            }}
            onBlur={(e) => {
              // Delay to allow suggestion clicks
              setTimeout(() => {
                setShowSuggestions(false)
                if (inputRef.current) {
                  Object.assign(inputRef.current.style, commonStyle)
                }
              }, 200)
            }}
            placeholder="Type keyword and press Enter or Tab..."
            style={commonStyle}
          />

          {/* Autocomplete suggestions */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '4px',
              background: darkMode ? '#374151' : '#fff',
              border: darkMode ? '1px solid #4b5563' : '1px solid #d1d5db',
              borderRadius: '8px',
              boxShadow: darkMode 
                ? '0 4px 6px -1px rgba(0, 0, 0, 0.3)' 
                : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              zIndex: 1000,
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              {filteredSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleSuggestionClick(suggestion)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    color: darkMode ? '#f9fafb' : '#374151',
                    cursor: 'pointer',
                    fontSize: '14px',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = darkMode ? '#4b5563' : '#f3f4f6'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


