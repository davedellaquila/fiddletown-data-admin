// Shared validation utilities
export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

export function validateEmail(email: string): ValidationResult {
  const errors: string[] = []

  if (!email.trim()) {
    errors.push('Email address is required')
    return { isValid: false, errors }
  }

  const emailRegex = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/
  if (!emailRegex.test(email)) {
    errors.push('Please enter a valid email address')
    return { isValid: false, errors }
  }

  if (email.includes('..')) {
    errors.push('Please enter a valid email address')
    return { isValid: false, errors }
  }

  return { isValid: true, errors: [] }
}

export function validateUrl(url: string): ValidationResult {
  const errors: string[] = []

  if (!url.trim()) {
    return { isValid: true, errors: [] } // URL is optional
  }

  try {
    const urlObj = new URL(url)
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

export function validateRequired(value: any, fieldName: string): ValidationResult {
  if (!value || (typeof value === 'string' && !value.trim())) {
    return { 
      isValid: false, 
      errors: [`${fieldName} is required`] 
    }
  }
  return { isValid: true, errors: [] }
}

export function validateNumber(value: any, fieldName: string, min?: number, max?: number): ValidationResult {
  const errors: string[] = []
  const num = Number(value)
  
  if (isNaN(num)) {
    errors.push(`${fieldName} must be a valid number`)
    return { isValid: false, errors }
  }
  
  if (min !== undefined && num < min) {
    errors.push(`${fieldName} must be at least ${min}`)
  }
  
  if (max !== undefined && num > max) {
    errors.push(`${fieldName} must be at most ${max}`)
  }
  
  return { isValid: errors.length === 0, errors }
}
