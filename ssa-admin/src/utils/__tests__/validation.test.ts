import { describe, it, expect } from 'vitest'
import {
  validateEmail,
  validateUrl,
  validateRequired,
  validateDateRange,
  validateStatus,
  validateDifficulty
} from '../validation'

describe('Validation Utils', () => {
  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'admin@sub.domain.com'
      ]
      
      validEmails.forEach(email => {
        const result = validateEmail(email)
        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })
    })
    
    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        '',
        'invalid-email',
        '@domain.com',
        'user@',
        'user..name@domain.com',
        'user@.com',
        'user@domain.',
        'user name@domain.com',
        'user@@domain.com',
        'user@domain@com'
      ]
      
      invalidEmails.forEach(email => {
        const result = validateEmail(email)
        expect(result.isValid).toBe(false)
        expect(result.errors.length).toBeGreaterThan(0)
      })
    })
    
    it('should require email address', () => {
      const result = validateEmail('')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Email address is required')
    })
  })
  
  describe('validateUrl', () => {
    it('should validate correct URLs', () => {
      const validUrls = [
        'https://example.com',
        'http://sub.domain.com',
        'https://www.example.com/path?query=value'
      ]
      
      validUrls.forEach(url => {
        const result = validateUrl(url)
        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })
    })
    
    it('should reject invalid URLs', () => {
      const invalidUrls = [
        'not-a-url',
        'just-text',
        'htp://invalid',
        'http://',
        '://invalid'
      ]
      
      invalidUrls.forEach(url => {
        const result = validateUrl(url)
        expect(result.isValid).toBe(false)
        expect(result.errors).toContain('Please enter a valid URL')
      })
    })
    
    it('should allow empty URLs (optional)', () => {
      const result = validateUrl('')
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })
  
  describe('validateRequired', () => {
    it('should validate non-empty text', () => {
      const result = validateRequired('Some text', 'Name')
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
    
    it('should reject empty text', () => {
      const result = validateRequired('', 'Name')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Name is required')
    })
    
    it('should reject whitespace-only text', () => {
      const result = validateRequired('   ', 'Name')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Name is required')
    })
  })
  
  describe('validateDateRange', () => {
    it('should validate correct date ranges', () => {
      const result = validateDateRange('2024-01-01', '2024-01-02')
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
    
    it('should allow empty dates', () => {
      const result = validateDateRange('', '')
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
    
    it('should reject invalid date ranges', () => {
      const result = validateDateRange('2024-01-02', '2024-01-01')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('End date must be after start date')
    })
  })
  
  describe('validateStatus', () => {
    it('should validate correct status values', () => {
      const validStatuses = ['draft', 'published', 'archived']
      
      validStatuses.forEach(status => {
        const result = validateStatus(status)
        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })
    })
    
    it('should reject invalid status values', () => {
      const result = validateStatus('invalid')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Status must be one of: draft, published, archived')
    })
  })
  
  describe('validateDifficulty', () => {
    it('should validate correct difficulty values', () => {
      const validDifficulties = ['easy', 'moderate', 'challenging']
      
      validDifficulties.forEach(difficulty => {
        const result = validateDifficulty(difficulty)
        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })
    })
    
    it('should reject invalid difficulty values', () => {
      const result = validateDifficulty('invalid')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Difficulty must be one of: easy, moderate, challenging')
    })
  })
})
