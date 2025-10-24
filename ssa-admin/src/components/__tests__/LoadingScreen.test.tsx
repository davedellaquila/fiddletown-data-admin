import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import LoadingScreen from '../LoadingScreen'

describe('LoadingScreen', () => {
  it('should render loading screen with title', () => {
    const mockOnComplete = vi.fn()
    render(<LoadingScreen onComplete={mockOnComplete} />)
    
    expect(screen.getByText('SSA Admin')).toBeInTheDocument()
    expect(screen.getByText('Fiddletown Data Management')).toBeInTheDocument()
  })
  
  it('should show progress bar', () => {
    const mockOnComplete = vi.fn()
    render(<LoadingScreen onComplete={mockOnComplete} />)
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })
  
  it('should show loading messages', () => {
    const mockOnComplete = vi.fn()
    render(<LoadingScreen onComplete={mockOnComplete} />)
    
    expect(screen.getByText('Initializing...')).toBeInTheDocument()
  })
  
  it('should call onComplete after timeout', async () => {
    const mockOnComplete = vi.fn()
    
    render(<LoadingScreen onComplete={mockOnComplete} />)
    
    // Wait for the callback to be called (using real timers for this test)
    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalled()
    }, { timeout: 3000 })
  })
  
  it('should show progress percentage', () => {
    const mockOnComplete = vi.fn()
    render(<LoadingScreen onComplete={mockOnComplete} />)
    
    expect(screen.getByText('0%')).toBeInTheDocument()
  })
  
  it('should have proper accessibility attributes', () => {
    const mockOnComplete = vi.fn()
    render(<LoadingScreen onComplete={mockOnComplete} />)
    
    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-label', 'Loading progress')
  })
})
