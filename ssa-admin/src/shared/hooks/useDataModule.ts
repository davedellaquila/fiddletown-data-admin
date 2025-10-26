import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { BaseEntity, ModuleState, ImportPreview } from '../types'
import { parseCSV, toCSV, downloadCSV } from '../utils/csv'

export interface UseDataModuleOptions<T extends BaseEntity> {
  tableName: string
  searchFields: string[]
  exportFields: string[]
  onLoad?: (data: T[]) => void
  onError?: (error: string) => void
}

export function useDataModule<T extends BaseEntity>({
  tableName,
  searchFields,
  exportFields,
  onLoad,
  onError
}: UseDataModuleOptions<T>) {
  const [state, setState] = useState<ModuleState<T>>({
    rows: [],
    loading: false,
    error: null,
    editing: null,
    searchQuery: '',
    importing: false,
    importPreview: null,
    selectedIds: new Set()
  })

  // Load data from Supabase
  const load = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      let query = supabase
        .from(tableName)
        .select('*')
        .is('deleted_at', null)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })

      // Apply search filters
      if (state.searchQuery.trim()) {
        const searchTerm = `%${state.searchQuery}%`
        const orConditions = searchFields.map(field => `${field}.ilike.${searchTerm}`).join(',')
        query = query.or(orConditions)
      }

      const { data, error } = await query
      
      if (error) {
        throw new Error(error.message)
      }

      setState(prev => ({ 
        ...prev, 
        rows: data || [], 
        loading: false 
      }))
      
      onLoad?.(data || [])
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to load data'
      setState(prev => ({ 
        ...prev, 
        error: errorMessage, 
        loading: false 
      }))
      onError?.(errorMessage)
    }
  }, [tableName, searchFields, state.searchQuery, onLoad, onError])

  // Create new record
  const create = useCallback(async (data: Partial<T>) => {
    try {
      const { data: result, error } = await supabase
        .from(tableName)
        .insert(data)
        .select()
        .single()

      if (error) throw new Error(error.message)
      
      await load()
      return result
    } catch (error: any) {
      onError?.(error.message)
      throw error
    }
  }, [tableName, load, onError])

  // Update existing record
  const update = useCallback(async (id: string, data: Partial<T>) => {
    try {
      const { error } = await supabase
        .from(tableName)
        .update(data)
        .eq('id', id)

      if (error) throw new Error(error.message)
      
      await load()
    } catch (error: any) {
      onError?.(error.message)
      throw error
    }
  }, [tableName, load, onError])

  // Soft delete record
  const softDelete = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from(tableName)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw new Error(error.message)
      
      await load()
    } catch (error: any) {
      onError?.(error.message)
      throw error
    }
  }, [tableName, load, onError])

  // Export data to CSV
  const exportCSV = useCallback(async (filename: string) => {
    try {
      const data = state.rows.map(row => {
        const exportRow: any = {}
        exportFields.forEach(field => {
          exportRow[field] = (row as any)[field]
        })
        return exportRow
      })
      
      downloadCSV(data, exportFields, filename)
    } catch (error: any) {
      onError?.(error.message)
    }
  }, [state.rows, exportFields, onError])

  // Import data from CSV
  const importCSV = useCallback(async (file: File) => {
    setState(prev => ({ ...prev, importing: true }))
    
    try {
      const text = await file.text()
      const rows = parseCSV(text)
      
      if (rows.length < 2) {
        throw new Error('CSV must have header + at least one data row')
      }

      const headers = rows[0].map(h => h.trim().toLowerCase())
      const data = rows.slice(1).map((cols, i) => {
        const obj: any = {}
        headers.forEach((h, idx) => {
          obj[h] = (cols[idx] ?? '').trim()
        })
        return obj
      })

      // Validate data
      const errors: string[] = []
      data.forEach((row, i) => {
        if (!row.name) {
          errors.push(`Row ${i + 2}: Name is required`)
        }
      })

      setState(prev => ({
        ...prev,
        importPreview: { data, errors, warnings: [] },
        importing: false
      }))
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message,
        importing: false
      }))
    }
  }, [])

  // Confirm import
  const confirmImport = useCallback(async () => {
    if (!state.importPreview) return
    
    try {
      const { data: session } = await supabase.auth.getSession()
      const uid = session.session?.user.id ?? null

      const payload = state.importPreview.data.map(row => ({
        ...row,
        created_by: uid
      }))

      const { error } = await supabase
        .from(tableName)
        .upsert(payload, { onConflict: 'slug' })

      if (error) throw new Error(error.message)

      setState(prev => ({
        ...prev,
        importPreview: null,
        importing: false
      }))
      
      await load()
    } catch (error: any) {
      onError?.(error.message)
    }
  }, [state.importPreview, tableName, load, onError])

  // Update search query
  const setSearchQuery = useCallback((query: string) => {
    setState(prev => ({ ...prev, searchQuery: query }))
  }, [])

  // Set editing record
  const setEditing = useCallback((record: T | null) => {
    setState(prev => ({ ...prev, editing: record }))
  }, [])

  // Toggle selection
  const toggleSelection = useCallback((id: string, selected: boolean) => {
    setState(prev => {
      const newSelectedIds = new Set(prev.selectedIds)
      if (selected) {
        newSelectedIds.add(id)
      } else {
        newSelectedIds.delete(id)
      }
      return { ...prev, selectedIds: newSelectedIds }
    })
  }, [])

  // Load data when search query changes
  useEffect(() => {
    load()
  }, [load])

  return {
    state,
    actions: {
      load,
      create,
      update,
      softDelete,
      exportCSV,
      importCSV,
      confirmImport,
      setSearchQuery,
      setEditing,
      toggleSelection
    }
  }
}
