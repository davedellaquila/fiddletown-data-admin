import React, { useState } from 'react'
import { BaseEntity, ModuleConfig } from '../types'
import { useDataModule } from '../hooks/useDataModule'
import StickyToolbar from './StickyToolbar'
import DataTable from './DataTable'

interface BaseDataModuleProps<T extends BaseEntity> {
  config: ModuleConfig
  darkMode: boolean
  renderToolbar?: (props: ToolbarProps) => React.ReactNode
  renderForm?: (props: FormProps<T>) => React.ReactNode
  renderActions?: (record: T) => React.ReactNode
  onEdit?: (record: T) => void
  onDelete?: (id: string) => void
  onBulkAction?: (action: string, selectedIds: Set<string>) => void
}

interface ToolbarProps {
  darkMode: boolean
  loading: boolean
  importing: boolean
  onNew: () => void
  onRefresh: () => void
  onExport: () => void
  onImport: (file: File) => void
  onBulkAction: (action: string) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedCount: number
}

interface FormProps<T extends BaseEntity> {
  record: T | null
  darkMode: boolean
  onSave: (data: Partial<T>) => void
  onCancel: () => void
  loading: boolean
}

export default function BaseDataModule<T extends BaseEntity>({
  config,
  darkMode,
  renderToolbar,
  renderForm,
  renderActions,
  onEdit,
  onDelete,
  onBulkAction
}: BaseDataModuleProps<T>) {
  const { state, actions } = useDataModule<T>({
    tableName: config.tableName,
    searchFields: config.searchFields,
    exportFields: config.exportFields
  })

  const [showForm, setShowForm] = useState(false)

  const handleNew = () => {
    actions.setEditing({} as T)
    setShowForm(true)
  }

  const handleEdit = (record: T) => {
    actions.setEditing(record)
    setShowForm(true)
    onEdit?.(record)
  }

  const handleSave = async (data: Partial<T>) => {
    try {
      if (state.editing?.id) {
        await actions.update(state.editing.id, data)
      } else {
        await actions.create(data)
      }
      setShowForm(false)
      actions.setEditing(null)
    } catch (error) {
      console.error('Save error:', error)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    actions.setEditing(null)
  }

  const handleExport = () => {
    actions.exportCSV(`${config.tableName}-export.csv`)
  }

  const handleImport = (file: File) => {
    actions.importCSV(file)
  }

  const handleBulkAction = (action: string) => {
    onBulkAction?.(action, state.selectedIds)
  }

  const defaultToolbar = (props: ToolbarProps) => (
    <StickyToolbar darkMode={darkMode}>
      {/* Action Buttons Row */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
        marginBottom: 12
      }}>
        <button 
          className="btn" 
          onClick={props.onNew}
          disabled={props.importing}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            padding: '8px 12px'
          }}
        >
          <span>➕</span>
          <span>New</span>
        </button>
        
        <button 
          className="btn" 
          onClick={props.onRefresh}
          disabled={props.loading || props.importing}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            padding: '8px 12px'
          }}
        >
          <span>{props.loading ? '⏳' : '🔄'}</span>
          <span>{props.loading ? 'Loading…' : 'Refresh'}</span>
        </button>
        
        <button 
          className="btn" 
          onClick={props.onExport}
          disabled={props.importing}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            padding: '8px 12px'
          }}
        >
          <span>📤</span>
          <span>Export</span>
        </button>
        
        <label 
          className="btn" 
          style={{ 
            cursor: 'pointer', 
            opacity: props.importing ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 12px'
          }}
        >
          <span>📥</span>
          <span>Import</span>
          <input 
            type="file" 
            accept=".csv,.tsv,text/csv,text/tab-separated-values" 
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) props.onImport(file)
            }}
            style={{ display: 'none' }} 
            disabled={props.importing} 
          />
        </label>
      </div>

      {/* Search Controls Row */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center'
      }}>
        <input 
          placeholder="Search..." 
          value={props.searchQuery} 
          onChange={(e) => props.onSearchChange(e.target.value)} 
          style={{ 
            flex: 1, 
            minWidth: 220, 
            padding: 8,
            background: darkMode ? '#374151' : '#ffffff',
            border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
            borderRadius: '6px',
            color: darkMode ? '#f9fafb' : '#1f2937'
          }} 
        />
      </div>
    </StickyToolbar>
  )

  const defaultActions = (record: T) => (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <button 
        className="btn" 
        onClick={() => handleEdit(record)}
        style={{ 
          padding: '6px 10px', 
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}
      >
        <span>✏️</span>
        Edit
      </button>
      <button 
        className="btn" 
        onClick={() => onDelete?.(record.id)}
        style={{ 
          padding: '6px 10px', 
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: '#ffebee',
          border: '1px solid #ffcdd2',
          color: '#c62828'
        }}
      >
        <span>🗑️</span>
        Delete
      </button>
    </div>
  )

  return (
    <div style={{ 
      background: darkMode ? '#111827' : '#ffffff',
      color: darkMode ? '#f9fafb' : '#1f2937'
    }}>
      <h2 style={{ 
        color: darkMode ? '#f9fafb' : '#1f2937',
        marginBottom: '24px',
        fontSize: '28px',
        fontWeight: '600'
      }}>
        {config.icon} {config.displayName}
      </h2>

      {/* Toolbar */}
      {renderToolbar ? 
        renderToolbar({
          darkMode,
          loading: state.loading,
          importing: state.importing,
          onNew: handleNew,
          onRefresh: actions.load,
          onExport: handleExport,
          onImport: handleImport,
          onBulkAction: handleBulkAction,
          searchQuery: state.searchQuery,
          onSearchChange: actions.setSearchQuery,
          selectedCount: state.selectedIds.size
        }) : 
        defaultToolbar({
          darkMode,
          loading: state.loading,
          importing: state.importing,
          onNew: handleNew,
          onRefresh: actions.load,
          onExport: handleExport,
          onImport: handleImport,
          onBulkAction: handleBulkAction,
          searchQuery: state.searchQuery,
          onSearchChange: actions.setSearchQuery,
          selectedCount: state.selectedIds.size
        })
      }

      {/* Import Preview */}
      {state.importing && state.importPreview && (
        <div style={{ 
          border: '1px solid #e5e7eb', 
          borderRadius: 12, 
          padding: 12, 
          marginBottom: 12, 
          background: '#fbfbfb' 
        }}>
          <h3 style={{ marginTop: 0 }}>Import Preview</h3>
          <p>{state.importPreview.data.length} rows parsed.</p>
          {state.importPreview.errors.length > 0 && (
            <div style={{ color: '#b91c1c', margin: '8px 0' }}>
              <strong>Issues:</strong>
              <ul>{state.importPreview.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <button 
              className="btn primary" 
              onClick={actions.confirmImport} 
              disabled={state.importPreview.errors.length > 0}
            >
              Confirm Import
            </button>
            <button 
              className="btn" 
              onClick={() => {
                actions.setEditing(null)
                // Reset import state
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Data Table */}
      <DataTable
        data={state.rows}
        columns={config.columns}
        darkMode={darkMode}
        loading={state.loading}
        onEdit={handleEdit}
        onDelete={onDelete}
        onSelect={actions.toggleSelection}
        selectedIds={state.selectedIds}
        renderActions={renderActions || defaultActions}
      />

      {/* Form Modal */}
      {showForm && state.editing && renderForm && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(0,0,0,0.5)', 
          zIndex: 1000, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{ 
            background: 'white', 
            padding: '32px', 
            borderRadius: '12px', 
            maxWidth: '800px', 
            width: '100%', 
            maxHeight: '90vh', 
            overflow: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            {renderForm({
              record: state.editing,
              darkMode,
              onSave: handleSave,
              onCancel: handleCancel,
              loading: state.loading
            })}
          </div>
        </div>
      )}
    </div>
  )
}
