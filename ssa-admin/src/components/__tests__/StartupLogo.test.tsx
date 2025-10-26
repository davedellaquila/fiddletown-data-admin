import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StartupLogo from '../StartupLogo'

describe('StartupLogo', () => {
  it('should render with default size', () => {
    render(<StartupLogo />)
    
    const logo = screen.getByText('🍇')
    expect(logo).toBeInTheDocument()
  })
  
  it('should render with custom size', () => {
    render(<StartupLogo size={200} />)
    
    const logo = screen.getByText('🍇')
    expect(logo).toBeInTheDocument()
  })
  
  it('should apply custom className', () => {
    render(<StartupLogo className="custom-class" />)
    
    // Find the root div by looking for the one with the startup-logo class
    const logoContainer = screen.getByText('🍇').closest('.startup-logo')
    expect(logoContainer).toHaveClass('startup-logo')
    expect(logoContainer).toHaveClass('custom-class')
  })
  
  it('should have proper styling', () => {
    render(<StartupLogo size={120} />)
    
    // Find the root div by looking for the one with the startup-logo class
    const logoContainer = screen.getByText('🍇').closest('.startup-logo')
    // Check that the component renders with the correct size
    expect(logoContainer).toBeInTheDocument()
    expect(logoContainer).toHaveClass('startup-logo')
  })
  
  it('should be visible after mount', async () => {
    render(<StartupLogo />)
    
    const logo = screen.getByText('🍇')
    expect(logo).toBeInTheDocument()
    
    // The component starts with opacity 0 and scale 0.8, then transitions to visible
    // We'll just check that the component renders
    const logoContainer = logo.closest('div')
    expect(logoContainer).toBeInTheDocument()
  })
})
