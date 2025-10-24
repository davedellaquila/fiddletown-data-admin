/**
 * Validation utilities for the SSA Admin application
 */

export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

/**
 * Validates email format
 */
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = []
  
  if (!email.trim()) {
    errors.push('Email address is required')
    return { isValid: false, errors }
  }
  
  // More strict email regex that prevents consecutive dots and other invalid patterns
  const emailRegex = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/
  if (!emailRegex.test(email)) {
    errors.push('Please enter a valid email address')
    return { isValid: false, errors }
  }
  
  // Additional check for consecutive dots
  if (email.includes('..')) {
    errors.push('Please enter a valid email address')
    return { isValid: false, errors }
  }
  
  return { isValid: true, errors: [] }
}

/**
 * Validates URL format
 */
export function validateUrl(url: string): ValidationResult {
  const errors: string[] = []
  
  if (!url.trim()) {
    return { isValid: true, errors: [] } // URL is optional
  }
  
  try {
    const urlObj = new URL(url)
    // Require http or https protocol
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      errors.push('Please enter a valid URL')
      return { isValid: false, errors }
    }
    return { isValid: true, errors: [] }
  } catch {
    errors.push('Please enter a valid URL')
    return { isValid: false, errors }
  }
}

/**
 * Validates required text field
 */
export function validateRequired(text: string, fieldName: string): ValidationResult {
  const errors: string[] = []
  
  if (!text.trim()) {
    errors.push(`${fieldName} is required`)
    return { isValid: false, errors }
  }
  
  return { isValid: true, errors: [] }
}

/**
 * Validates date range
 */
export function validateDateRange(startDate: string, endDate: string): ValidationResult {
  const errors: string[] = []
  
  if (!startDate && !endDate) {
    return { isValid: true, errors: [] } // Both dates are optional
  }
  
  if (startDate && endDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    if (start > end) {
      errors.push('End date must be after start date')
      return { isValid: false, errors }
    }
  }
  
  return { isValid: true, errors: [] }
}

/**
 * Validates status enum
 */
export function validateStatus(status: string): ValidationResult {
  const validStatuses = ['draft', 'published', 'archived']
  const errors: string[] = []
  
  if (!validStatuses.includes(status)) {
    errors.push(`Status must be one of: ${validStatuses.join(', ')}`)
    return { isValid: false, errors }
  }
  
  return { isValid: true, errors: [] }
}

/**
 * Validates difficulty enum
 */
export function validateDifficulty(difficulty: string): ValidationResult {
  const validDifficulties = ['easy', 'moderate', 'challenging']
  const errors: string[] = []
  
  if (!validDifficulties.includes(difficulty)) {
    errors.push(`Difficulty must be one of: ${validDifficulties.join(', ')}`)
    return { isValid: false, errors }
  }
  
  return { isValid: true, errors: [] }
}
