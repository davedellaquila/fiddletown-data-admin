import React from 'react'
import { Location } from '../shared/types'
import { locationsConfig } from '../shared/config/modules'
import BaseDataModule from '../shared/components/BaseDataModule'

interface LocationsRefactoredProps {
  darkMode?: boolean
}

export default function LocationsRefactored({ darkMode = false }: LocationsRefactoredProps) {
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this location? (soft delete)')) return
    // Delete logic will be handled by the base module
  }

  const renderForm = ({ record, darkMode, onSave, onCancel, loading }: any) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: '#1f2937' }}>
          {record?.id ? '✏️ Edit Location' : '➕ New Location'}
        </h3>
        <button 
          onClick={onCancel}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#6b7280',
            padding: '4px'
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ display: 'grid', gap: '20px' }}>
        {/* Name and Slug */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Location Name *
            </label>
            <input 
              value={record?.name || ''} 
              onChange={(e) => {
                // Handle name change
                const updatedRecord = { ...record, name: e.target.value }
                // Update the record in parent state
              }}
              style={{ 
                width: '100%', 
                padding: '12px', 
                border: '1px solid #d1d5db', 
                borderRadius: '8px',
                fontSize: '14px',
                background: '#fff'
              }}
              placeholder="Enter location name"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Slug
            </label>
            <input 
              value={record?.slug || ''} 
              onChange={(e) => {
                // Handle slug change
              }}
              style={{ 
                width: '100%', 
                padding: '12px', 
                border: '1px solid #d1d5db', 
                borderRadius: '8px',
                fontSize: '14px',
                background: '#fff'
              }}
              placeholder="location-slug"
            />
          </div>
        </div>

        {/* Region and Website */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Region
            </label>
            <input 
              value={record?.region || ''} 
              onChange={(e) => {
                // Handle region change
              }}
              style={{ 
                width: '100%', 
                padding: '12px', 
                border: '1px solid #d1d5db', 
                borderRadius: '8px',
                fontSize: '14px',
                background: '#fff'
              }}
              placeholder="Region name"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Website URL
            </label>
            <input 
              value={record?.website_url || ''} 
              onChange={(e) => {
                // Handle website change
              }}
              style={{ 
                width: '100%', 
                padding: '12px', 
                border: '1px solid #d1d5db', 
                borderRadius: '8px',
                fontSize: '14px',
                background: '#fff'
              }}
              placeholder="https://example.com"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
            Short Description
          </label>
          <textarea 
            value={record?.short_description || ''} 
            onChange={(e) => {
              // Handle description change
            }}
            style={{ 
              width: '100%', 
              padding: '12px', 
              border: '1px solid #d1d5db', 
              borderRadius: '8px',
              fontSize: '14px',
              background: '#fff',
              minHeight: '80px',
              resize: 'vertical'
            }}
            placeholder="Brief description of the location"
          />
        </div>

        {/* Status and Sort Order */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Status
            </label>
            <select 
              value={record?.status || 'draft'} 
              onChange={(e) => {
                // Handle status change
              }}
              style={{ 
                width: '100%', 
                padding: '12px', 
                border: '1px solid #d1d5db', 
                borderRadius: '8px',
                fontSize: '14px',
                background: '#fff'
              }}
            >
              <option value="draft">📝 Draft</option>
              <option value="published">✅ Published</option>
              <option value="archived">📦 Archived</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Sort Order
            </label>
            <input 
              type="number" 
              value={record?.sort_order || 1000} 
              onChange={(e) => {
                // Handle sort order change
              }}
              style={{ 
                width: '100%', 
                padding: '12px', 
                border: '1px solid #d1d5db', 
                borderRadius: '8px',
                fontSize: '14px',
                background: '#fff'
              }}
              placeholder="1000"
            />
          </div>
        </div>
      </div>

      <div style={{ 
        marginTop: '32px', 
        display: 'flex', 
        gap: '12px', 
        justifyContent: 'flex-end',
        paddingTop: '20px',
        borderTop: '1px solid #e5e7eb'
      }}>
        <button 
          className="btn" 
          onClick={onCancel}
          style={{ 
            padding: '12px 24px', 
            fontSize: '14px',
            background: '#f9fafb',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            color: '#374151'
          }}
        >
          Cancel
        </button>
        <button 
          className="btn primary" 
          onClick={() => onSave(record)}
          disabled={loading}
          style={{ 
            padding: '12px 24px', 
            fontSize: '14px',
            background: '#3b82f6',
            border: '1px solid #3b82f6',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '500'
          }}
        >
          💾 Save Location
        </button>
      </div>
    </div>
  )

  return (
    <BaseDataModule<Location>
      config={locationsConfig}
      darkMode={darkMode}
      renderForm={renderForm}
      onDelete={handleDelete}
    />
  )
}
