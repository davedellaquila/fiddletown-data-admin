import { useState, useCallback } from 'react'

interface UseDialogNavigationProps<T> {
  editing: T | null
  rows: T[]
  save: () => Promise<void>
  setEditing: React.Dispatch<React.SetStateAction<T | null>>
  transitionDelay?: number
}

export function useDialogNavigation<T extends { id?: number | string }>({
  editing,
  rows,
  save,
  setEditing,
  transitionDelay = 150
}: UseDialogNavigationProps<T>) {
  const [isNavigating, setIsNavigating] = useState(false)

  const navigateToNext = useCallback(async () => {
    if (!editing?.id) return
    const currentIndex = rows.findIndex(r => r.id === editing.id)
    if (currentIndex < rows.length - 1) {
      setIsNavigating(true)
      await save() // Save current changes
      setTimeout(() => {
        setEditing(rows[currentIndex + 1])
        setIsNavigating(false)
      }, transitionDelay)
    }
  }, [editing, rows, save, setEditing, transitionDelay])

  const navigateToPrevious = useCallback(async () => {
    if (!editing?.id) return
    const currentIndex = rows.findIndex(r => r.id === editing.id)
    if (currentIndex > 0) {
      setIsNavigating(true)
      await save() // Save current changes
      setTimeout(() => {
        setEditing(rows[currentIndex - 1])
        setIsNavigating(false)
      }, transitionDelay)
    }
  }, [editing, rows, save, setEditing, transitionDelay])

  return {
    isNavigating,
    navigateToNext,
    navigateToPrevious
  }
}
