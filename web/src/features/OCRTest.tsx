/**
 * OCR Test Feature Component
 * 
 * Testing and debugging interface for OCR (Optical Character Recognition) functionality.
 * Allows users to test OCR settings and see how event flyers/images are parsed.
 * 
 * Features:
 * - Image upload (file picker or paste from clipboard)
 * - OCR processing with configurable Tesseract settings
 * - Real-time OCR text display
 * - Event data parsing preview
 * - Configurable PSM (Page Segmentation Mode) and OEM (OCR Engine Mode)
 * - Processing time measurement
 * - Error handling and display
 * 
 * Use Cases:
 * - Testing OCR accuracy on different image types
 * - Debugging parsing issues
 * - Finding optimal OCR settings for event flyers
 * - Validating OCR parser improvements
 * 
 * @module OCRTest
 */
import React, { useState, useRef, useEffect } from 'react'
import { parseEventText, ParsedEventData } from '../shared/utils/ocrParser'

/**
 * Props for OCRTest component
 */
interface OCRTestProps {
  darkMode?: boolean // Whether dark mode is enabled
}

/**
 * OCRTest component
 * 
 * Provides an interactive interface for testing OCR functionality
 * and visualizing how event data is extracted from images.
 */
export default function OCRTest({ darkMode = false }: OCRTestProps) {
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [ocrText, setOcrText] = useState<string>('')
  const [parsedData, setParsedData] = useState<ParsedEventData>({})
  const [isProcessing, setIsProcessing] = useState(false)
  const [isReparsing, setIsReparsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [processingTime, setProcessingTime] = useState<number | null>(null)
  const [tesseractConfig, setTesseractConfig] = useState({
    language: 'eng',
    psm: 6 as number, // Page segmentation mode
    oem: 3 as number,  // OCR Engine mode
  })
  
  const pasteAreaRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle paste events
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) {
            await handleImageFile(file)
          }
        }
      }
    }

    const pasteArea = pasteAreaRef.current
    if (pasteArea) {
      pasteArea.addEventListener('paste', handlePaste)
      return () => pasteArea.removeEventListener('paste', handlePaste)
    }
  }, [])

  const handleImageFile = async (file: File) => {
    setError(null)
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    await runOCR(file)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      await handleImageFile(file)
    }
  }

  const runOCR = async (file: File) => {
    setIsProcessing(true)
    setOcrText('')
    setParsedData({})
    setProcessingTime(null)
    const startTime = performance.now()

    try {
      // Dynamic import for better performance
      const Tesseract = await import('tesseract.js')
      
      // Create worker with optimized configuration
      const worker = await Tesseract.createWorker(tesseractConfig.language, 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            // Could show progress here
          }
        }
      })

      // Set page segmentation mode and OCR engine mode
      await worker.setParameters({
        tessedit_pageseg_mode: tesseractConfig.psm.toString(),
        tessedit_ocr_engine_mode: tesseractConfig.oem.toString(),
      } as any)

      // Run OCR with optimized settings
      const { data } = await worker.recognize(file, {
        rectangle: undefined, // Process entire image
      })

      await worker.terminate()

      const text = (data?.text || '').trim()
      setOcrText(text)
      
      // Parse the extracted text
      await parseText(text)

      const endTime = performance.now()
      setProcessingTime(endTime - startTime)
    } catch (e: any) {
      console.error('OCR Error:', e)
      setError(e?.message || 'OCR processing failed')
    } finally {
      setIsProcessing(false)
    }
  }

  const parseText = async (text: string) => {
    const parsed = parseEventText(text)
    // Small delay to show spinner animation
    await new Promise(resolve => setTimeout(resolve, 100))
    setParsedData(parsed)
  }

  const handleReparse = async () => {
    if (ocrText) {
      setIsReparsing(true)
      try {
        await parseText(ocrText)
      } finally {
        setIsReparsing(false)
      }
    }
  }

  const fieldLabels: Record<keyof ParsedEventData, string> = {
    name: 'Event Name',
    start_date: 'Start Date',
    end_date: 'End Date',
    start_time: 'Start Time',
    end_time: 'End Time',
    location: 'Location',
    host_org: 'Host Organization',
    website_url: 'Website URL',
    recurrence: 'Recurrence',
    description: 'Description',
  }

  const containerStyle: React.CSSProperties = {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '24px',
    background: darkMode ? '#1f2937' : '#f9fafb',
    minHeight: '100vh',
  }

  const cardStyle: React.CSSProperties = {
    background: darkMode ? '#374151' : '#ffffff',
    border: `1px solid ${darkMode ? '#4b5563' : '#e5e7eb'}`,
    borderRadius: '8px',
    padding: '24px',
    marginBottom: '24px',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
    borderRadius: '6px',
    background: darkMode ? '#1f2937' : '#ffffff',
    color: darkMode ? '#f9fafb' : '#111827',
    fontSize: '14px',
  }

  return (
    <div style={containerStyle}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <h1 style={{ color: darkMode ? '#f9fafb' : '#111827', marginBottom: '24px' }}>
        OCR Test Page
      </h1>

      {/* Configuration Panel */}
      <div style={cardStyle}>
        <h2 style={{ color: darkMode ? '#f9fafb' : '#111827', marginBottom: '16px', fontSize: '18px' }}>
          OCR Configuration
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: darkMode ? '#d1d5db' : '#374151', fontSize: '14px' }}>
              Language
            </label>
            <select
              value={tesseractConfig.language}
              onChange={(e) => setTesseractConfig({ ...tesseractConfig, language: e.target.value })}
              style={inputStyle}
            >
              <option value="eng">English</option>
              <option value="eng+fra">English + French</option>
              <option value="eng+spa">English + Spanish</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: darkMode ? '#d1d5db' : '#374151', fontSize: '14px' }}>
              Page Segmentation Mode
            </label>
            <select
              value={tesseractConfig.psm}
              onChange={(e) => setTesseractConfig({ ...tesseractConfig, psm: parseInt(e.target.value) })}
              style={inputStyle}
            >
              <option value="6">Uniform block of text</option>
              <option value="3">Fully automatic</option>
              <option value="4">Single column</option>
              <option value="5">Single uniform block</option>
              <option value="7">Single text line</option>
              <option value="8">Single word</option>
              <option value="11">Sparse text</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: darkMode ? '#d1d5db' : '#374151', fontSize: '14px' }}>
              OCR Engine Mode
            </label>
            <select
              value={tesseractConfig.oem}
              onChange={(e) => setTesseractConfig({ ...tesseractConfig, oem: parseInt(e.target.value) })}
              style={inputStyle}
            >
              <option value="3">Default (LSTM + Legacy)</option>
              <option value="1">Neural nets LSTM only</option>
              <option value="0">Legacy engine only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Image Upload Area */}
      <div style={cardStyle}>
        <h2 style={{ color: darkMode ? '#f9fafb' : '#111827', marginBottom: '16px', fontSize: '18px' }}>
          Image Input
        </h2>
        
        {/* Upload Button */}
        <div style={{ marginBottom: '16px' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '12px 24px',
              background: darkMode ? '#3b82f6' : '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = darkMode ? '#2563eb' : '#1d4ed8'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = darkMode ? '#3b82f6' : '#2563eb'
            }}
          >
            📁 Upload Image
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>

        {/* Paste Area */}
        <div
          ref={pasteAreaRef}
          style={{
            border: `2px dashed ${darkMode ? '#4b5563' : '#d1d5db'}`,
            borderRadius: '8px',
            padding: '40px',
            textAlign: 'center',
            cursor: 'text',
            background: darkMode ? '#1f2937' : '#f9fafb',
            transition: 'all 0.2s',
            minHeight: '200px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onDragOver={(e) => {
            e.preventDefault()
            e.currentTarget.style.borderColor = darkMode ? '#3b82f6' : '#2563eb'
            e.currentTarget.style.background = darkMode ? '#374151' : '#f3f4f6'
          }}
          onDragLeave={(e) => {
            e.currentTarget.style.borderColor = darkMode ? '#4b5563' : '#d1d5db'
            e.currentTarget.style.background = darkMode ? '#1f2937' : '#f9fafb'
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.currentTarget.style.borderColor = darkMode ? '#4b5563' : '#d1d5db'
            e.currentTarget.style.background = darkMode ? '#1f2937' : '#f9fafb'
            const file = e.dataTransfer.files[0]
            if (file && file.type.startsWith('image/')) {
              handleImageFile(file)
            }
          }}
          tabIndex={0}
        >
          {imagePreview ? (
            <img
              src={imagePreview}
              alt="Preview"
              style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '8px' }}
            />
          ) : (
            <div>
              <p style={{ color: darkMode ? '#9ca3af' : '#6b7280', marginBottom: '8px', fontSize: '16px' }}>
                Paste image here (Ctrl+V / Cmd+V)
              </p>
              <p style={{ color: darkMode ? '#6b7280' : '#9ca3af', fontSize: '14px' }}>
                Or drag and drop an image
              </p>
              <p style={{ color: darkMode ? '#6b7280' : '#9ca3af', fontSize: '12px', marginTop: '8px' }}>
                Supports: JPG, PNG, GIF, WebP
              </p>
            </div>
          )}
        </div>
        {isProcessing && (
          <div style={{ marginTop: '16px', textAlign: 'center', color: darkMode ? '#3b82f6' : '#2563eb' }}>
            Processing OCR... {processingTime && `(${Math.round(processingTime)}ms)`}
          </div>
        )}
        {error && (
          <div style={{ marginTop: '16px', padding: '12px', background: '#fee2e2', color: '#991b1b', borderRadius: '6px' }}>
            Error: {error}
          </div>
        )}
      </div>

      {/* Extracted Text */}
      {ocrText && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ color: darkMode ? '#f9fafb' : '#111827', fontSize: '18px', margin: 0 }}>
              Extracted Text
            </h2>
            <button
              onClick={handleReparse}
              disabled={isReparsing}
              style={{
                padding: '8px 16px',
                background: isReparsing 
                  ? (darkMode ? '#6b7280' : '#9ca3af')
                  : (darkMode ? '#3b82f6' : '#2563eb'),
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: isReparsing ? 'wait' : 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: isReparsing ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isReparsing) {
                  e.currentTarget.style.background = darkMode ? '#2563eb' : '#1d4ed8'
                }
              }}
              onMouseLeave={(e) => {
                if (!isReparsing) {
                  e.currentTarget.style.background = darkMode ? '#3b82f6' : '#2563eb'
                }
              }}
            >
              {isReparsing ? (
                <>
                  <span style={{
                    display: 'inline-block',
                    width: '14px',
                    height: '14px',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    borderTopColor: '#ffffff',
                    borderRadius: '50%',
                    animation: 'spin 0.6s linear infinite',
                  }} />
                  Parsing...
                </>
              ) : (
                <>🔄 Re-parse</>
              )}
            </button>
          </div>
          <textarea
            value={ocrText}
            readOnly
            style={{
              ...inputStyle,
              minHeight: '200px',
              fontFamily: 'monospace',
              fontSize: '13px',
            }}
          />
          {processingTime && (
            <p style={{ marginTop: '8px', color: darkMode ? '#9ca3af' : '#6b7280', fontSize: '12px' }}>
              Processing time: {Math.round(processingTime)}ms
            </p>
          )}
        </div>
      )}

      {/* Parsed Fields */}
      {Object.keys(parsedData).length > 0 && (
        <div style={cardStyle}>
          <h2 style={{ color: darkMode ? '#f9fafb' : '#111827', marginBottom: '16px', fontSize: '18px' }}>
            Parsed Event Fields
          </h2>
          <div style={{ display: 'grid', gap: '16px' }}>
            {Object.entries(parsedData).map(([key, value]) => (
              <div key={key}>
                <label style={{ display: 'block', marginBottom: '8px', color: darkMode ? '#d1d5db' : '#374151', fontSize: '14px', fontWeight: '500' }}>
                  {fieldLabels[key as keyof ParsedEventData]}
                </label>
                <input
                  type="text"
                  value={value || ''}
                  readOnly
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

