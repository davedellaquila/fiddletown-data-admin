import { useEffect } from 'react'

/**
 * Custom hook to reset table row styling when dark mode changes
 * Prevents visual artifacts where some rows remain in old theme colors
 * due to stale mouse hover states
 */
export function useDarkModeRowReset(darkMode: boolean) {
  useEffect(() => {
    const tableRows = document.querySelectorAll('tbody tr')
    tableRows.forEach(row => {
      const element = row as HTMLElement
      // Reset to default background color based on current dark mode
      element.style.backgroundColor = darkMode ? '#1f2937' : '#ffffff'
    })
  }, [darkMode])
}
