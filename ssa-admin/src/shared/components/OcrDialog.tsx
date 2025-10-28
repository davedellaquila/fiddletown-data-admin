import React, { useState, useRef, useEffect } from 'react'
import { SmoothDialog } from './SmoothDialog'

interface OcrDialogProps {
  isOpen: boolean
  onClose: () => void
  darkMode: boolean
  onSave: (eventData: any) => Promise<void>
  ocrLoading: boolean
  setOcrLoading: (loading: boolean) => void
  ocrError: string | null
  setOcrError: (error: string | null) => void
  ocrRawText: string
  setOcrRawText: (text: string) => void
  ocrImageUrl: string | null
  setOcrImageUrl: (url: string | null) => void
  ocrDraft: any
  setOcrDraft: (draft: any) => void
  // Additional props for OCR functions
  handleFileSelect?: (e: React.ChangeEvent<HTMLInputElement>) => void
  handlePaste?: (ev: React.ClipboardEvent<HTMLDivElement>) => void
  parseEventText?: (text: string) => any
  updateOcrDraft?: (updates: any) => void
  pasteRef?: React.RefObject<HTMLDivElement>
}

export const OcrDialog: React.FC<OcrDialogProps> = ({
  isOpen,
  onClose,
  darkMode,
  onSave,
  ocrLoading,
  setOcrLoading,
  ocrError,
  setOcrError,
  ocrRawText,
  setOcrRawText,
  ocrImageUrl,
  setOcrImageUrl,
  ocrDraft,
  setOcrDraft,
  handleFileSelect,
  handlePaste,
  parseEventText,
  updateOcrDraft,
  pasteRef
}) => {
  const fileRef = useRef<HTMLInputElement>(null)
  const internalPasteRef = useRef<HTMLDivElement>(null)
  const actualPasteRef = pasteRef || internalPasteRef

  const handleClose = () => {
    setOcrDraft(null)
    setOcrRawText('')
    setOcrImageUrl(null)
    setOcrError(null)
    onClose()
  }

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setOcrError('Please select an image file')
      return
    }

    setOcrLoading(true)
    setOcrError(null)

    try {
      const imageUrl = URL.createObjectURL(file)
      setOcrImageUrl(imageUrl)

      // Use the existing OCR logic if available, otherwise simulate
      if (handleFileSelect) {
        // Create a mock event object
        const mockEvent = {
          target: {
            files: [file],
            value: ''
          }
        } as React.ChangeEvent<HTMLInputElement>
        handleFileSelect(mockEvent)
      } else {
        // Fallback simulation
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        const mockOcrText = `Event Name: Sample Event
Date: 2024-01-15
Time: 7:00 PM
Location: Community Center
Description: This is a sample event created from OCR`
        
        setOcrRawText(mockOcrText)
        
        if (parseEventText && updateOcrDraft) {
          const parsed = parseEventText(mockOcrText)
          updateOcrDraft(parsed)
        }
      }
    } catch (error) {
      setOcrError('Failed to process image')
    } finally {
      setOcrLoading(false)
    }
  }

  const handleSave = async () => {
    if (!ocrDraft) return
    
    try {
      await onSave(ocrDraft)
      handleClose()
    } catch (error) {
      setOcrError('Failed to save event')
    }
  }

  const handleParseAgain = () => {
    if (parseEventText && updateOcrDraft && ocrRawText) {
      const parsed = parseEventText(ocrRawText)
      updateOcrDraft(parsed)
    }
  }

  const handlePasteFallback = async (ev: React.ClipboardEvent<HTMLDivElement>) => {
    const items = ev.clipboardData?.items
    if (!items) return
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          setOcrLoading(true)
          setOcrError(null)
          
          try {
            const imageUrl = URL.createObjectURL(file)
            setOcrImageUrl(imageUrl)
            
            // Use the existing OCR logic if available
            if (handleFileSelect) {
              const mockEvent = {
                target: {
                  files: [file],
                  value: ''
                }
              } as React.ChangeEvent<HTMLInputElement>
              handleFileSelect(mockEvent)
            } else {
              // Fallback: simulate OCR processing
              await new Promise(resolve => setTimeout(resolve, 2000))
              
              const mockOcrText = `Event Name: Pasted Event
Date: 2024-01-15
Time: 7:00 PM
Location: Community Center
Description: This event was created from a pasted image`
              
              setOcrRawText(mockOcrText)
              
              if (parseEventText && updateOcrDraft) {
                const parsed = parseEventText(mockOcrText)
                updateOcrDraft(parsed)
              }
            }
          } catch (error) {
            setOcrError('Failed to process pasted image')
          } finally {
            setOcrLoading(false)
          }
          break
        }
      }
    }
  }

  const handlePasteEvent = (ev: React.ClipboardEvent<HTMLDivElement>) => {
    // Try the passed handlePaste function first
    if (handlePaste) {
      handlePaste(ev)
    } else {
      // Use fallback
      handlePasteFallback(ev)
    }
  }

  return (
    <SmoothDialog
      isOpen={isOpen}
      onOverlayClick={handleClose}
      darkMode={darkMode}
      maxWidth="900px"
    >
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '24px'
      }}>
        <h3 style={{ 
          margin: 0, 
          fontSize: '24px', 
          fontWeight: '600', 
          color: darkMode ? '#f9fafb' : '#1f2937' 
        }}>
          📷 Add Event from Image
        </h3>
        <button 
          onClick={handleClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: darkMode ? '#6b7280' : '#6b7280',
            padding: '4px'
          }}
          title="Close dialog"
        >
          ✕
        </button>
      </div>

      {/* Image Upload Section */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ 
          border: `2px dashed ${darkMode ? '#6b7280' : '#c8b68a'}`,
          padding: '20px',
          borderRadius: '8px',
          background: darkMode ? '#374151' : '#fff9ef',
          textAlign: 'center',
          transition: 'all 0.2s ease',
          position: 'relative'
        }}>
          <div
            ref={actualPasteRef}
            onPaste={handlePasteEvent}
            onClick={() => actualPasteRef.current?.focus()}
            tabIndex={0}
            style={{
              display: 'grid',
              gridTemplateColumns: '120px 1fr',
              gap: 16,
              alignItems: 'center',
              minHeight: 120,
              cursor: 'pointer',
              outline: 'none',
              borderRadius: '8px',
              padding: '8px',
              transition: 'background-color 0.2s ease'
            }}
            onFocus={(e) => {
              e.currentTarget.style.backgroundColor = darkMode ? '#4b5563' : '#f9fafb'
            }}
            onBlur={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <div style={{ textAlign: 'center' }}>
              {ocrImageUrl ? (
                <img 
                  src={ocrImageUrl} 
                  alt="pasted" 
                  style={{ 
                    maxWidth: 120, 
                    maxHeight: 120, 
                    objectFit: 'contain', 
                    borderRadius: 6, 
                    border: '1px solid #eee' 
                  }} 
                />
              ) : (
                <div style={{ color: '#8b6b34', fontSize: '48px' }}>📋</div>
              )}
            </div>
            <div>
              <div style={{ marginBottom: 8 }}>
                <input 
                  ref={fileRef}
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileSelect || ((e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileUpload(file)
                  })}
                  style={{ display: 'none' }}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={ocrLoading}
                  style={{
                    padding: '8px 16px',
                    background: darkMode ? '#4b5563' : '#f3f4f6',
                    border: `1px solid ${darkMode ? '#6b7280' : '#d1d5db'}`,
                    borderRadius: '6px',
                    color: darkMode ? '#f9fafb' : '#374151',
                    cursor: ocrLoading ? 'not-allowed' : 'pointer',
                    fontSize: '14px'
                  }}
                >
                  📁 Choose File
                </button>
              </div>
              <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: darkMode ? '#d1d5db' : '#6b7280' }}>
                Paste an image here (⌘/Ctrl+V) or choose a file. We'll OCR the text, parse it, and let you verify before saving.
              </p>
              <small style={{ color: darkMode ? '#9ca3af' : '#8b6b34', fontSize: '12px' }}>
                💡 <strong>Tip:</strong> Click in this area and press <strong>⌘/Ctrl+V</strong> to paste from clipboard.
              </small>
              <div style={{ 
                marginTop: '8px', 
                padding: '8px', 
                background: darkMode ? '#1f2937' : '#f3f4f6', 
                borderRadius: '4px',
                fontSize: '11px',
                color: darkMode ? '#9ca3af' : '#6b7280'
              }}>
                📋 Works with screenshots, copied images, and image files
              </div>
            </div>
          </div>

          {ocrLoading && (
            <div style={{ marginTop: 12, color: '#059669', fontWeight: '500' }}>🔄 Running OCR…</div>
          )}
          {ocrError && (
            <div style={{ marginTop: 12, color: '#dc2626', fontWeight: '500' }}>❌ Error: {ocrError}</div>
          )}
        </div>
      </div>

      {/* Form Fields - Only show when we have OCR data */}
      {(ocrRawText || ocrDraft) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          {/* Left side - Form fields */}
          <div>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: darkMode ? '#f9fafb' : '#374151' }}>
              Event Details
            </h4>
            <div style={{ display: 'grid', gap: '16px' }}>
              {/* Name and Slug row */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                    Event Name *
                  </label>
                  <input 
                    value={ocrDraft?.name ?? ''} 
                    onChange={e => updateOcrDraft ? updateOcrDraft({ name: e.target.value }) : setOcrDraft({...ocrDraft, name: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: darkMode ? '#374151' : '#ffffff',
                      color: darkMode ? '#ffffff' : '#000000'
                    }} 
                    placeholder="Enter event name"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                    Slug
                  </label>
                  <input 
                    value={ocrDraft?.slug ?? ''} 
                    onChange={e => updateOcrDraft ? updateOcrDraft({ slug: e.target.value }) : setOcrDraft({...ocrDraft, slug: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: darkMode ? '#374151' : '#ffffff',
                      color: darkMode ? '#ffffff' : '#000000'
                    }} 
                    placeholder="event-slug"
                  />
                </div>
              </div>

              {/* Host Org and Location row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                    Host Organization
                  </label>
                  <input 
                    value={ocrDraft?.host_org ?? ''} 
                    onChange={e => updateOcrDraft ? updateOcrDraft({ host_org: e.target.value }) : setOcrDraft({...ocrDraft, host_org: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: darkMode ? '#374151' : '#ffffff',
                      color: darkMode ? '#ffffff' : '#000000'
                    }} 
                    placeholder="Host organization"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                    Location
                  </label>
                  <input 
                    value={ocrDraft?.location ?? ''} 
                    onChange={e => updateOcrDraft ? updateOcrDraft({ location: e.target.value }) : setOcrDraft({...ocrDraft, location: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: darkMode ? '#374151' : '#ffffff',
                      color: darkMode ? '#ffffff' : '#000000'
                    }} 
                    placeholder="Event location"
                  />
                </div>
              </div>

              {/* Date and Time row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                    Start Date
                  </label>
                  <input 
                    type="date" 
                    value={ocrDraft?.start_date ?? ''} 
                    onChange={e => updateOcrDraft ? updateOcrDraft({ start_date: e.target.value }) : setOcrDraft({...ocrDraft, start_date: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: darkMode ? '#374151' : '#ffffff',
                      color: darkMode ? '#ffffff' : '#000000'
                    }} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                    End Date
                  </label>
                  <input 
                    type="date" 
                    value={ocrDraft?.end_date ?? ''} 
                    onChange={e => updateOcrDraft ? updateOcrDraft({ end_date: e.target.value }) : setOcrDraft({...ocrDraft, end_date: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: darkMode ? '#374151' : '#ffffff',
                      color: darkMode ? '#ffffff' : '#000000'
                    }} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                    Start Time
                  </label>
                  <input 
                    type="time" 
                    value={ocrDraft?.start_time ?? ''} 
                    onChange={e => updateOcrDraft ? updateOcrDraft({ start_time: e.target.value }) : setOcrDraft({...ocrDraft, start_time: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: darkMode ? '#374151' : '#ffffff',
                      color: darkMode ? '#ffffff' : '#000000'
                    }} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                    End Time
                  </label>
                  <input 
                    type="time" 
                    value={ocrDraft?.end_time ?? ''} 
                    onChange={e => updateOcrDraft ? updateOcrDraft({ end_time: e.target.value }) : setOcrDraft({...ocrDraft, end_time: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: darkMode ? '#374151' : '#ffffff',
                      color: darkMode ? '#ffffff' : '#000000'
                    }} 
                  />
                </div>
              </div>

              {/* Website and Status row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                    Website URL
                  </label>
                  <input 
                    type="url" 
                    value={ocrDraft?.website_url ?? ''} 
                    onChange={e => updateOcrDraft ? updateOcrDraft({ website_url: e.target.value }) : setOcrDraft({...ocrDraft, website_url: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: darkMode ? '#374151' : '#ffffff',
                      color: darkMode ? '#ffffff' : '#000000'
                    }} 
                    placeholder="https://example.com"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                    Status
                  </label>
                  <select 
                    value={ocrDraft?.status ?? 'draft'} 
                    onChange={e => updateOcrDraft ? updateOcrDraft({ status: e.target.value }) : setOcrDraft({...ocrDraft, status: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: darkMode ? '#374151' : '#ffffff',
                      color: darkMode ? '#ffffff' : '#000000'
                    }}
                  >
                    <option value="draft">📝 Draft</option>
                    <option value="published">✅ Published</option>
                    <option value="archived">📦 Archived</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Raw OCR text */}
          <div>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: darkMode ? '#f9fafb' : '#374151' }}>
              Raw OCR Text
            </h4>
            <textarea 
              value={ocrRawText} 
              onChange={e => {
                setOcrRawText(e.target.value)
                if (parseEventText && updateOcrDraft) {
                  const parsed = parseEventText(e.target.value)
                  updateOcrDraft(parsed)
                }
              }} 
              style={{ 
                width: '100%', 
                height: 300, 
                padding: '12px', 
                border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                borderRadius: '8px',
                fontSize: '12px',
                fontFamily: 'monospace',
                background: darkMode ? '#374151' : '#f9fafb',
                color: darkMode ? '#ffffff' : '#000000'
              }} 
              placeholder="OCR text will appear here..."
            />
            <div style={{ 
              marginTop: 12, 
              padding: 12, 
              background: darkMode ? '#4b5563' : '#f3f4f6', 
              borderRadius: 8, 
              fontSize: '12px', 
              color: darkMode ? '#d1d5db' : '#6b7280' 
            }}>
              <div style={{ marginBottom: 8, fontWeight: '600' }}>
                <strong>Parsed from OCR:</strong>
              </div>
              <div style={{ marginBottom: 4 }}>
                <strong>Name:</strong> {ocrDraft?.name || '—'}
              </div>
              <div style={{ marginBottom: 4 }}>
                <strong>Date:</strong> {ocrDraft?.start_date || '—'}
              </div>
              <div style={{ marginBottom: 4 }}>
                <strong>Time:</strong> {ocrDraft?.start_time || '—'}
              </div>
              <div style={{ marginBottom: 4 }}>
                <strong>Location:</strong> {ocrDraft?.location || '—'}
              </div>
              <div style={{ marginBottom: 4 }}>
                <strong>Host:</strong> {ocrDraft?.host_org || '—'}
              </div>
            </div>
            {parseEventText && (
              <button 
                onClick={handleParseAgain}
                style={{
                  marginTop: 12,
                  padding: '8px 16px',
                  background: '#3b82f6',
                  border: '1px solid #3b82f6',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                🔄 Parse Again
              </button>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        justifyContent: 'flex-end',
        paddingTop: '20px',
        borderTop: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`
      }}>
        <button 
          className="btn" 
          onClick={handleClose}
          disabled={ocrLoading}
          style={{
            padding: '12px 24px',
            fontSize: '14px',
            background: darkMode ? '#374151' : '#f9fafb',
            border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
            borderRadius: '8px',
            color: darkMode ? '#f9fafb' : '#374151',
            cursor: ocrLoading ? 'not-allowed' : 'pointer',
            opacity: ocrLoading ? 0.6 : 1
          }}
        >
          Cancel
        </button>
        <button 
          className="btn primary" 
          onClick={handleSave}
          disabled={!ocrDraft || !ocrDraft.name || ocrLoading}
          style={{
            padding: '12px 24px',
            fontSize: '14px',
            background: (!ocrDraft || !ocrDraft.name || ocrLoading) ? '#9ca3af' : '#3b82f6',
            border: `1px solid ${(!ocrDraft || !ocrDraft.name || ocrLoading) ? '#9ca3af' : '#3b82f6'}`,
            borderRadius: '8px',
            color: 'white',
            fontWeight: '500',
            cursor: (!ocrDraft || !ocrDraft.name || ocrLoading) ? 'not-allowed' : 'pointer'
          }}
        >
          {ocrLoading ? '⏳ Processing...' : '💾 Save Event'}
        </button>
      </div>
    </SmoothDialog>
  )
}
