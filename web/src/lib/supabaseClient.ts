/**
 * Supabase client configuration and initialization.
 * 
 * This module creates and exports a singleton Supabase client instance that is used
 * throughout the application for database operations, authentication, and storage.
 * 
 * Environment variables required:
 * - VITE_SUPABASE_URL: The Supabase project URL
 * - VITE_SUPABASE_ANON_KEY: The anonymous/public API key for Supabase
 * 
 * The client uses placeholder values if environment variables are missing to prevent
 * runtime errors, but operations will fail. This allows the app to load in development
 * even if .env file is not configured.
 */
import { createClient } from '@supabase/supabase-js'

// Read Supabase configuration from environment variables
// VITE_ prefix is required for Vite to expose these variables to the client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Log configuration status (helpful for debugging)
console.log('Supabase URL:', supabaseUrl)
console.log('Supabase Key:', supabaseKey ? 'Present' : 'Missing')

// Warn if required environment variables are missing
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables!')
  console.error('VITE_SUPABASE_URL:', supabaseUrl)
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseKey ? 'Present' : 'Missing')
}

// Create and export the Supabase client singleton
// Uses placeholder values if env vars are missing to prevent immediate crashes
// Note: Actual operations will fail without proper configuration
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key'
)
