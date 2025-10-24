import React from 'react'
import { BaseEntity, ColumnConfig } from '../types'

interface DataTableProps<T extends BaseEntity> {
  data: T[]
  columns: ColumnConfig[]
  darkMode: boolean
  loading?: boolean
  onEdit?: (record: T) => void
  onDelete?: (id: string) => void
  onSelect?: (id: string, selected: boolean) => void
  selectedIds?: Set<string>
  renderActions?: (record: T) => React.ReactNode
}

export default function DataTable<T extends BaseEntity>({
  data,
  columns,
  darkMode,
  loading = false,
  onEdit,
  onDelete,
  onSelect,
  selectedIds = new Set(),
  renderActions
}: DataTableProps<T>) {
  const getCellValue = (record: T, column: ColumnConfig) => {
    const value = (record as any)[column.key]
    
    if (column.type === 'date' && value) {
      return new Date(value).toLocaleDateString()
    }
    
    if (column.type === 'url' && value) {
      return (
        <a 
          href={value} 
          target="_blank" 
          rel="noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            background: '#e3f2fd',
            border: '1px solid #bbdefb',
            borderRadius: '4px',
            textDecoration: 'none',
            color: '#1976d2',
            fontSize: '12px',
            fontWeight: '500'
          }}
        >
          <span>🔗</span>
          Open
        </a>
      )
    }
    
    if (column.type === 'image' && value) {
      return (
        <img 
          src={value} 
          alt={record.name} 
          style={{ 
            width: 40, 
            height: 40, 
            objectFit: 'cover', 
            borderRadius: '4px',
            border: '1px solid #ddd'
          }} 
        />
      )
    }
    
    return value || '—'
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      published: { 
        icon: '✅', 
        label: 'Published', 
        bg: '#e8f5e8', 
        color: '#2e7d32', 
        border: '#c8e6c9' 
      },
      archived: { 
        icon: '📦', 
        label: 'Archived', 
        bg: '#fff3e0', 
        color: '#f57c00', 
        border: '#ffcc02' 
      },
      draft: { 
        icon: '📝', 
        label: 'Draft', 
        bg: '#f5f5f5', 
        color: '#666', 
        border: '#e0e0e0' 
      }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft
    
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 8px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '500',
        background: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`
      }}>
        {config.icon}
        {config.label}
      </span>
    )
  }

  return (
    <table style={{ 
      width: '100%', 
      borderCollapse: 'collapse',
      position: 'relative'
    }}>
      <thead style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: darkMode ? '#1f2937' : '#ffffff'
      }}>
        <tr>
          {onSelect && (
            <th style={{
              padding: '12px 8px',
              textAlign: 'left',
              fontWeight: '600',
              fontSize: '14px',
              color: darkMode ? '#f9fafb' : '#1f2937',
              background: darkMode ? '#1f2937' : '#ffffff',
              borderBottom: `2px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
              position: 'sticky',
              top: 0,
              zIndex: 10
            }}>
              <input 
                type="checkbox" 
                onChange={(e) => {
                  data.forEach(record => onSelect(record.id, e.target.checked))
                }}
                style={{
                  accentColor: darkMode ? '#3b82f6' : '#3b82f6'
                }}
              />
            </th>
          )}
          {columns.map(column => (
            <th 
              key={column.key}
              style={{
                padding: '12px 8px',
                textAlign: 'left',
                fontWeight: '600',
                fontSize: '14px',
                color: darkMode ? '#f9fafb' : '#1f2937',
                background: darkMode ? '#1f2937' : '#ffffff',
                borderBottom: `2px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
                position: 'sticky',
                top: 0,
                zIndex: 10,
                width: column.width
              }}
            >
              {column.label}
            </th>
          ))}
          {renderActions && (
            <th style={{
              padding: '12px 8px',
              textAlign: 'left',
              fontWeight: '600',
              fontSize: '14px',
              color: darkMode ? '#f9fafb' : '#1f2937',
              background: darkMode ? '#1f2937' : '#ffffff',
              borderBottom: `2px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
              position: 'sticky',
              top: 0,
              zIndex: 10
            }}>
              Actions
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {data.map(record => (
          <tr key={record.id}>
            {onSelect && (
              <td style={{ 
                padding: '8px 6px', 
                borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}`,
                background: darkMode ? '#1f2937' : '#ffffff'
              }}>
                <input 
                  type="checkbox" 
                  checked={selectedIds.has(record.id)} 
                  onChange={(e) => onSelect(record.id, e.target.checked)} 
                  style={{
                    accentColor: darkMode ? '#3b82f6' : '#3b82f6'
                  }}
                />
              </td>
            )}
            {columns.map(column => (
              <td 
                key={column.key}
                style={{ 
                  padding: '8px 6px', 
                  borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}`,
                  background: darkMode ? '#1f2937' : '#ffffff'
                }}
              >
                {column.key === 'status' ? 
                  getStatusBadge((record as any)[column.key]) : 
                  getCellValue(record, column)
                }
              </td>
            ))}
            {renderActions && (
              <td style={{ 
                padding: '8px 6px', 
                borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}`,
                background: darkMode ? '#1f2937' : '#ffffff'
              }}>
                {renderActions(record)}
              </td>
            )}
          </tr>
        ))}
        {data.length === 0 && !loading && (
          <tr>
            <td 
              colSpan={columns.length + (onSelect ? 1 : 0) + (renderActions ? 1 : 0)}
              style={{ 
                padding: '20px', 
                textAlign: 'center',
                color: darkMode ? '#9ca3af' : '#6b7280'
              }}
            >
              No records found.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}
