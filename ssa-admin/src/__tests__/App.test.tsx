import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

// Mock the Supabase client
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithOtp: vi.fn(),
      signOut: vi.fn()
    }
  }
}))

describe('App Component', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // Mock successful session
    const { supabase } = await import('../lib/supabaseClient')
    supabase.auth.getSession.mockResolvedValue({
      data: { session: null }
    })
    supabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    })
    
    // Mock the setTimeout to immediately resolve
    vi.useFakeTimers()
  })
  
  afterEach(() => {
    vi.useRealTimers()
  })
  
  it('should show loading screen initially', () => {
    render(<App />)
    
    expect(screen.getByText('SSA Admin')).toBeInTheDocument()
  })
  
  it('should show login form when not authenticated', async () => {
    render(<App />)
    
    // Wait for loading screen to complete and login form to appear
    await waitFor(() => {
      expect(screen.getByText('Sign in to manage your datasets and content.')).toBeInTheDocument()
    }, { timeout: 3000 })
  })
  
  it('should handle email input', async () => {
    const user = userEvent.setup()
    render(<App />)
    
    // Wait for loading screen to complete and login form to appear
    await waitFor(() => {
      expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
    }, { timeout: 3000 })
    
    const emailInput = screen.getByLabelText('Email Address')
    await user.type(emailInput, 'test@example.com')
    
    expect(emailInput).toHaveValue('test@example.com')
  })
  
  it('should validate email format', async () => {
    const user = userEvent.setup()
    render(<App />)
    
    // Advance timers to complete loading
    vi.advanceTimersByTime(1000)
    
    await waitFor(() => {
      expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
    })
    
    const emailInput = screen.getByLabelText('Email Address')
    const submitButton = screen.getByText('Send Magic Link')
    
    await user.type(emailInput, 'invalid-email')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
    })
  })
  
  it('should handle magic link submission', async () => {
    const user = userEvent.setup()
    const { supabase } = await import('../lib/supabaseClient')
    supabase.auth.signInWithOtp.mockResolvedValue({ data: {}, error: null })
    
    render(<App />)
    
    // Advance timers to complete loading
    vi.advanceTimersByTime(1000)
    
    await waitFor(() => {
      expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
    })
    
    const emailInput = screen.getByLabelText('Email Address')
    const submitButton = screen.getByText('Send Magic Link')
    
    await user.type(emailInput, 'test@example.com')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'test@example.com'
      })
    })
  })
  
  it('should handle Enter key submission', async () => {
    const user = userEvent.setup()
    const { supabase } = await import('../lib/supabaseClient')
    supabase.auth.signInWithOtp.mockResolvedValue({ data: {}, error: null })
    
    render(<App />)
    
    // Advance timers to complete loading
    vi.advanceTimersByTime(1000)
    
    await waitFor(() => {
      expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
    })
    
    const emailInput = screen.getByLabelText('Email Address')
    await user.type(emailInput, 'test@example.com')
    await user.keyboard('{Enter}')
    
    await waitFor(() => {
      expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'test@example.com'
      })
    })
  })
  
  it('should toggle dark mode', async () => {
    const user = userEvent.setup()
    render(<App />)
    
    // Advance timers to complete loading
    vi.advanceTimersByTime(1000)
    
    await waitFor(() => {
      expect(screen.getByTitle('Switch to light mode')).toBeInTheDocument()
    })
    
    const themeToggle = screen.getByTitle('Switch to light mode')
    await user.click(themeToggle)
    
    // Check that the theme toggle changes
    expect(screen.getByTitle('Switch to dark mode')).toBeInTheDocument()
  })
  
  it('should show error message on failed authentication', async () => {
    const user = userEvent.setup()
    const { supabase } = await import('../lib/supabaseClient')
    supabase.auth.signInWithOtp.mockResolvedValue({
      data: null,
      error: { message: 'Invalid email' }
    })
    
    render(<App />)
    
    // Advance timers to complete loading
    vi.advanceTimersByTime(1000)
    
    await waitFor(() => {
      expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
    })
    
    const emailInput = screen.getByLabelText('Email Address')
    const submitButton = screen.getByText('Send Magic Link')
    
    await user.type(emailInput, 'test@example.com')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Error: Invalid email')).toBeInTheDocument()
    })
  })
  
  it('should show success message on successful authentication', async () => {
    const user = userEvent.setup()
    const { supabase } = await import('../lib/supabaseClient')
    supabase.auth.signInWithOtp.mockResolvedValue({ data: {}, error: null })
    
    render(<App />)
    
    // Advance timers to complete loading
    vi.advanceTimersByTime(1000)
    
    await waitFor(() => {
      expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
    })
    
    const emailInput = screen.getByLabelText('Email Address')
    const submitButton = screen.getByText('Send Magic Link')
    
    await user.type(emailInput, 'test@example.com')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Magic Link Sent!')).toBeInTheDocument()
      expect(screen.getByText('Check your email for the magic link')).toBeInTheDocument()
    })
  })
})
