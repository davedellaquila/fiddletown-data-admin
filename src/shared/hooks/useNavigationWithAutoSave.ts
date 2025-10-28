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
    if (!editing?.id || rows.length === 0) return

    try {
      // Auto-save current changes before navigating
      await saveFunction()

      const currentIndex = rows.findIndex(r => r.id === editing.id)
      if (currentIndex >= 0 && currentIndex < rows.length - 1) {
        // Immediately set the new editing item to prevent dialog from closing
        setEditing(rows[currentIndex + 1])
      }
    } catch (error) {
      console.error('Error during navigation to next:', error)
    }
  }, [editing, rows, saveFunction, setEditing])

  const navigateToPrevious = useCallback(async () => {
    if (!editing?.id || rows.length === 0) return

    try {
      // Auto-save current changes before navigating
      await saveFunction()

      const currentIndex = rows.findIndex(r => r.id === editing.id)
      if (currentIndex > 0) {
        // Immediately set the new editing item to prevent dialog from closing
        setEditing(rows[currentIndex - 1])
      }
    } catch (error) {
      console.error('Error during navigation to previous:', error)
    }
  }, [editing, rows, saveFunction, setEditing])

  return {
    navigateToNext,
    navigateToPrevious
  }
}

