/**
 * useNavigationWithAutoSave Hook
 * 
 * Custom React hook that provides navigation functions with automatic save functionality.
 * Used in edit dialogs to navigate between records while preserving unsaved changes.
 * 
 * Features:
 * - Auto-saves current record before navigating
 * - Prevents data loss when moving between records
 * - Handles edge cases (no current record, first/last record)
 * - Memoized callbacks for performance
 * 
 * Usage:
 * ```typescript
 * const { navigateToNext, navigateToPrevious } = useNavigationWithAutoSave(
 *   editing,
 *   rows,
 *   saveFunction,
 *   setEditing
 * )
 * ```
 * 
 * @template T - Type of the record being edited (must have an 'id' field)
 * @param editing - Currently editing record (null if creating new)
 * @param rows - Array of all records to navigate through
 * @param saveFunction - Async function to save current changes
 * @param setEditing - Function to update the editing state
 * @returns Object with navigateToNext and navigateToPrevious functions
 * 
 * @module useNavigationWithAutoSave
 */
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
  /**
   * Navigate to the next record
   * 
   * Process:
   * 1. Auto-saves current changes
   * 2. Finds current record index in rows array
   * 3. If not at last record, moves to next record
   * 
   * The dialog stays open because setEditing is called immediately after save,
   * preventing the dialog from closing between save and navigation.
   */
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

  /**
   * Navigate to the previous record
   * 
   * Process:
   * 1. Auto-saves current changes
   * 2. Finds current record index in rows array
   * 3. If not at first record, moves to previous record
   * 
   * The dialog stays open because setEditing is called immediately after save,
   * preventing the dialog from closing between save and navigation.
   */
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

