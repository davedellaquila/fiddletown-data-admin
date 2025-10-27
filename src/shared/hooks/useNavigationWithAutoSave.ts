import { useCallback } from 'react'

/**
 * Custom hook that provides navigation functions with auto-save functionality
 * Eliminates code duplication across modules for navigation logic
 */
export function useNavigationWithAutoSave<T extends Record<string, any>>(
  editing: T | null,
  rows: T[],
  saveFunction: () => Promise<void>,
  setEditing: (item: T | null) => void
) {
  const navigateToNext = useCallback(async () => {
    if (!editing?.id) return
    
    // Auto-save current changes before navigating
    await saveFunction()
    
    const currentIndex = rows.findIndex(r => r.id === editing.id)
    if (currentIndex < rows.length - 1) {
      setEditing(rows[currentIndex + 1])
    }
  }, [editing, rows, saveFunction, setEditing])

  const navigateToPrevious = useCallback(async () => {
    if (!editing?.id) return
    
    // Auto-save current changes before navigating
    await saveFunction()
    
    const currentIndex = rows.findIndex(r => r.id === editing.id)
    if (currentIndex > 0) {
      setEditing(rows[currentIndex - 1])
    }
  }, [editing, rows, saveFunction, setEditing])

  return {
    navigateToNext,
    navigateToPrevious
  }
}
