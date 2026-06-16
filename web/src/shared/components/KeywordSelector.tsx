/**
 * KeywordSelector Component
 *
 * Tag-based keyword input with autocomplete suggestions (Events module).
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'

interface KeywordSelectorProps {
  label: string
  value: string[]
  onChange: (keywords: string[]) => void
  existingKeywords?: string[]
  darkMode?: boolean
  editingId?: string
}

function filterSuggestions(
  query: string,
  selected: string[],
  existingKeywords: string[]
): string[] {
  const trimmed = query.trim()
  if (!trimmed) return []
  const lowerInput = trimmed.toLowerCase()
  const selectedLower = new Set(selected.map(k => k.toLowerCase()))
  return existingKeywords
    .filter(kw => kw.toLowerCase().includes(lowerInput) && !selectedLower.has(kw.toLowerCase()))
    .slice(0, 10)
}

export default function KeywordSelector({
  label,
  value = [],
  onChange,
  existingKeywords = [],
  darkMode = false,
}: KeywordSelectorProps) {
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([])
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const filteredSuggestionsRef = useRef<string[]>([])
  const highlightedIndexRef = useRef(-1)

  const buildSuggestions = useCallback(
    (query: string) => filterSuggestions(query, value, existingKeywords),
    [existingKeywords, value]
  )

  const setHighlight = (index: number) => {
    highlightedIndexRef.current = index
    setHighlightedIndex(index)
  }

  useEffect(() => {
    const filtered = buildSuggestions(inputValue)
    filteredSuggestionsRef.current = filtered
    setFilteredSuggestions(filtered)
    setShowSuggestions(filtered.length > 0)
    setHighlight(-1)
  }, [inputValue, buildSuggestions])

  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return
    const item = listRef.current.children[highlightedIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex, filteredSuggestions])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const addKeyword = (keyword: string) => {
    const trimmed = keyword.trim().toLowerCase()
    if (trimmed && !value.some(v => v.toLowerCase() === trimmed)) {
      onChange([...value, trimmed])
      setInputValue('')
      setShowSuggestions(false)
      setHighlight(-1)
    }
  }

  const removeKeyword = (keywordToRemove: string) => {
    onChange(value.filter(kw => kw !== keywordToRemove))
  }

  const resolveSuggestionList = (query: string): string[] => {
    const fresh = buildSuggestions(query)
    if (fresh.length > 0) return fresh
    if (showSuggestions && filteredSuggestionsRef.current.length > 0) {
      return filteredSuggestionsRef.current
    }
    return filteredSuggestions
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const query = e.currentTarget.value
    const suggestions = resolveSuggestionList(query)

    if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault()
      e.stopPropagation()
      filteredSuggestionsRef.current = suggestions
      setFilteredSuggestions(suggestions)
      setShowSuggestions(true)
      const next =
        highlightedIndexRef.current < 0
          ? 0
          : highlightedIndexRef.current < suggestions.length - 1
            ? highlightedIndexRef.current + 1
            : 0
      setHighlight(next)
      return
    }

    if (e.key === 'ArrowUp' && suggestions.length > 0) {
      e.preventDefault()
      e.stopPropagation()
      filteredSuggestionsRef.current = suggestions
      setFilteredSuggestions(suggestions)
      setShowSuggestions(true)
      const next =
        highlightedIndexRef.current <= 0
          ? suggestions.length - 1
          : highlightedIndexRef.current - 1
      setHighlight(next)
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      const idx = highlightedIndexRef.current
      const pick =
        (idx >= 0 && suggestions[idx]) ||
        (suggestions.length === 1 ? suggestions[0] : null)
      if (pick) {
        addKeyword(pick)
      } else if (query.trim()) {
        addKeyword(query)
      }
      setTimeout(() => inputRef.current?.focus(), 0)
      return
    }

    if (e.key === 'Tab' && query.trim()) {
      e.preventDefault()
      e.stopPropagation()
      const idx = highlightedIndexRef.current
      const pick =
        (idx >= 0 && suggestions[idx]) ||
        (suggestions.length === 1 ? suggestions[0] : null)
      if (pick) {
        addKeyword(pick)
      } else {
        addKeyword(query)
      }
      return
    }

    if (e.key === 'Backspace' && !query && value.length > 0) {
      removeKeyword(value[value.length - 1])
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setShowSuggestions(false)
      setHighlight(-1)
    }
  }

  const commonStyle = {
    padding: '12px',
    border: darkMode ? '1px solid #4b5563' : '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    background: darkMode ? '#374151' : '#fff',
    color: darkMode ? '#f9fafb' : '#000',
    transition: 'all 0.2s ease',
    outline: 'none',
  }

  const focusStyle = {
    ...commonStyle,
    border: '1px solid #3b82f6',
    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
  }

  return (
    <div>
      <label
        style={{
          display: 'block',
          marginBottom: '6px',
          fontSize: '14px',
          fontWeight: '500',
          color: darkMode ? '#f9fafb' : '#374151',
        }}
      >
        {label}
      </label>
      <div ref={containerRef} style={{ position: 'relative' }}>
        {value.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              marginBottom: '8px',
              padding: '8px',
              background: darkMode ? '#1f2937' : '#f9fafb',
              borderRadius: '6px',
              minHeight: '40px',
            }}
          >
            {value.map(keyword => (
              <span
                key={keyword}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  background: '#3b82f6',
                  color: '#ffffff',
                  borderRadius: '16px',
                  fontSize: '13px',
                  fontWeight: '500',
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
                    padding: 0,
                    marginLeft: '4px',
                    fontSize: '16px',
                    lineHeight: '1',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                  }}
                  title="Remove keyword"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={showSuggestions}
            aria-autocomplete="list"
            aria-controls="keyword-suggestion-list"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onFocus={() => {
              if (inputValue.trim() && filteredSuggestions.length > 0) {
                setShowSuggestions(true)
              }
              if (inputRef.current) {
                Object.assign(inputRef.current.style, focusStyle)
              }
            }}
            onBlur={() => {
              setTimeout(() => {
                setShowSuggestions(false)
                if (inputRef.current) {
                  Object.assign(inputRef.current.style, commonStyle)
                }
              }, 200)
            }}
            placeholder="Type keyword and press Enter or Tab..."
            style={commonStyle}
            onKeyDown={handleKeyDown}
          />

          {showSuggestions && filteredSuggestions.length > 0 && (
            <div
              id="keyword-suggestion-list"
              ref={listRef}
              role="listbox"
              style={{
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
                zIndex: 1100,
                maxHeight: '200px',
                overflowY: 'auto',
              }}
            >
              {filteredSuggestions.map((suggestion, index) => (
                <button
                  key={suggestion}
                  type="button"
                  role="option"
                  aria-selected={index === highlightedIndex}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => addKeyword(suggestion)}
                  onMouseEnter={() => setHighlight(index)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    textAlign: 'left',
                    background:
                      index === highlightedIndex
                        ? darkMode
                          ? '#4b5563'
                          : '#dbeafe'
                        : 'transparent',
                    border: 'none',
                    color: darkMode ? '#f9fafb' : '#374151',
                    cursor: 'pointer',
                    fontSize: '14px',
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
