import { describe, it, expect } from 'vitest'
import { generateSlug, ensureUniqueSlug, isValidSlug } from '../slug'

describe('Slug Utils', () => {
  describe('generateSlug', () => {
    it('should generate basic slugs', () => {
      expect(generateSlug('Hello World')).toBe('hello-world')
      expect(generateSlug('Test Event')).toBe('test-event')
      expect(generateSlug('Wine Tasting')).toBe('wine-tasting')
    })
    
    it('should handle special characters', () => {
      expect(generateSlug('Event & Festival!')).toBe('event-festival')
      expect(generateSlug('Wine & Cheese (2024)')).toBe('wine-cheese-2024')
      expect(generateSlug('Route #1 - Easy')).toBe('route-1-easy')
    })
    
    it('should handle multiple spaces and hyphens', () => {
      expect(generateSlug('Multiple   Spaces')).toBe('multiple-spaces')
      expect(generateSlug('Multiple---Hyphens')).toBe('multiple-hyphens')
      expect(generateSlug('  Leading and trailing  ')).toBe('leading-and-trailing')
    })
    
    it('should handle empty or invalid input', () => {
      expect(generateSlug('')).toBe('')
      expect(generateSlug('   ')).toBe('')
      expect(generateSlug('!@#$%')).toBe('')
    })
    
    it('should handle unicode and accented characters', () => {
      expect(generateSlug('Café & Restaurant')).toBe('caf-restaurant')
      expect(generateSlug('Naïve Wine')).toBe('nave-wine')
    })
  })
  
  describe('ensureUniqueSlug', () => {
    it('should return original slug if unique', () => {
      const existingSlugs = ['existing-slug', 'another-slug']
      const result = ensureUniqueSlug(existingSlugs, 'new-slug')
      expect(result).toBe('new-slug')
    })
    
    it('should append number for duplicate slugs', () => {
      const existingSlugs = ['test-slug', 'another-slug']
      const result = ensureUniqueSlug(existingSlugs, 'test-slug')
      expect(result).toBe('test-slug-1')
    })
    
    it('should increment number for multiple duplicates', () => {
      const existingSlugs = ['test-slug', 'test-slug-1', 'test-slug-2']
      const result = ensureUniqueSlug(existingSlugs, 'test-slug')
      expect(result).toBe('test-slug-3')
    })
    
    it('should exclude specified slug from uniqueness check', () => {
      const existingSlugs = ['test-slug', 'test-slug-1']
      const result = ensureUniqueSlug(existingSlugs, 'test-slug', 'test-slug')
      expect(result).toBe('test-slug')
    })
  })
  
  describe('isValidSlug', () => {
    it('should validate correct slugs', () => {
      const validSlugs = [
        'hello-world',
        'test-123',
        'valid-slug',
        'a',
        '123'
      ]
      
      validSlugs.forEach(slug => {
        expect(isValidSlug(slug)).toBe(true)
      })
    })
    
    it('should reject invalid slugs', () => {
      const invalidSlugs = [
        '',
        'Hello World', // uppercase and spaces
        'test_slug', // underscores
        '-invalid', // leading hyphen
        'invalid-', // trailing hyphen
        'test@slug', // special characters
        'test slug' // spaces
      ]
      
      invalidSlugs.forEach(slug => {
        expect(isValidSlug(slug)).toBe(false)
      })
    })
  })
})
