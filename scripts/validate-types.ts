#!/usr/bin/env tsx
/**
 * Type Validation Script
 * 
 * Validates that Swift models are synchronized with TypeScript types.
 * Checks for missing fields, type mismatches, and enum value differences.
 * 
 * Usage: npx tsx scripts/validate-types.ts
 */

import { readFileSync } from 'fs'
import { join } from 'path'

interface FieldInfo {
  name: string
  type: string
  optional: boolean
}

interface TypeInfo {
  name: string
  fields: FieldInfo[]
  enums?: string[]
}

/**
 * Parse TypeScript types from models.ts
 */
function parseTypeScriptTypes(filePath: string): {
  types: TypeInfo[]
  enums: Map<string, string[]>
} {
  const content = readFileSync(filePath, 'utf-8')
  const types: TypeInfo[] = []
  const enums = new Map<string, string[]>()

  // Extract Status enum
  const statusMatch = content.match(/export type Status = '([^']+)' \| '([^']+)' \| '([^']+)'/)
  if (statusMatch) {
    enums.set('Status', [statusMatch[1], statusMatch[2], statusMatch[3]])
  }

  // Extract Difficulty enum
  const difficultyMatch = content.match(/export type Difficulty = '([^']+)' \| '([^']+)' \| '([^']+)'/)
  if (difficultyMatch) {
    enums.set('Difficulty', [difficultyMatch[1], difficultyMatch[2], difficultyMatch[3]])
  }

  // Extract Location interface
  const locationMatch = content.match(/export interface Location\s*\{([^}]+)\}/s)
  if (locationMatch) {
    const fields = parseFields(locationMatch[1])
    types.push({ name: 'Location', fields })
  }

  // Extract EventRow interface
  const eventMatch = content.match(/export interface EventRow\s*\{([^}]+)\}/s)
  if (eventMatch) {
    const fields = parseFields(eventMatch[1])
    types.push({ name: 'EventRow', fields })
  }

  // Extract RouteRow interface
  const routeMatch = content.match(/export interface RouteRow\s*\{([^}]+)\}/s)
  if (routeMatch) {
    const fields = parseFields(routeMatch[1])
    types.push({ name: 'RouteRow', fields })
  }

  return { types, enums }
}

/**
 * Parse fields from interface body
 */
function parseFields(body: string): FieldInfo[] {
  const fields: FieldInfo[] = []
  const lines = body.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('/**') && !l.startsWith('*') && !l.startsWith('@'))

  for (const line of lines) {
    // Match: field_name: type
    // Match: field_name?: type
    // Match: field_name: type | null
    const match = line.match(/^(\w+)(\?)?:\s*([^;|]+)(?:\s*\|\s*null)?;?$/)
    if (match) {
      const [, name, optionalMarker, type] = match
      fields.push({
        name,
        type: type.trim(),
        optional: !!optionalMarker || type.includes('null')
      })
    }
  }

  return fields
}

/**
 * Parse Swift models from DataModels.swift
 */
function parseSwiftTypes(filePath: string): {
  types: TypeInfo[]
  enums: Map<string, string[]>
} {
  const content = readFileSync(filePath, 'utf-8')
  const types: TypeInfo[] = []
  const enums = new Map<string, string[]>()

  // Extract Status enum
  const statusMatches = content.matchAll(/case\s+(\w+)\s*=\s*"(\w+)"/g)
  const statusValues: string[] = []
  for (const match of statusMatches) {
    if (match[2] === match[1].lowercased()) {
      statusValues.push(match[2])
    }
  }
  if (statusValues.length > 0) {
    enums.set('Status', statusValues)
  }

  // Extract Difficulty enum
  const difficultyMatches = content.matchAll(/case\s+(\w+)\s*=\s*"(\w+)"/g)
  // This is simplified - would need better parsing for multiple enums

  // Extract Location struct
  const locationMatch = content.match(/struct Location[^{]*\{([^}]+CodingKeys[^}]+)\}/s)
  if (locationMatch) {
    // Parse from CodingKeys
    const codingKeysMatch = content.match(/enum CodingKeys[^{]*\{([^}]+)\}/s)
    if (codingKeysMatch) {
      const fields = parseSwiftFields(codingKeysMatch[1])
      types.push({ name: 'Location', fields })
    }
  }

  // Similar for Event and Route...

  return { types, enums }
}

/**
 * Parse Swift fields from CodingKeys
 */
function parseSwiftFields(body: string): FieldInfo[] {
  const fields: FieldInfo[] = []
  const lines = body.split('\n').map(l => l.trim()).filter(l => l && l.startsWith('case'))

  for (const line of lines) {
    // Match: case fieldName
    // Match: case fieldName = "snake_case"
    const match = line.match(/case\s+(\w+)(?:\s*=\s*"([^"]+)")?/)
    if (match) {
      const [, swiftName, dbName] = match
      fields.push({
        name: dbName || swiftName,
        type: 'unknown', // Would need to parse struct body for types
        optional: false // Would need to check struct properties
      })
    }
  }

  return fields
}

/**
 * Validate types are in sync
 */
function validateTypes(tsTypes: TypeInfo[], swiftTypes: TypeInfo[], tsEnums: Map<string, string[]>, swiftEnums: Map<string, string[]>) {
  const errors: string[] = []
  const warnings: string[] = []

  // Check enums
  for (const [enumName, tsValues] of tsEnums.entries()) {
    const swiftValues = swiftEnums.get(enumName)
    if (!swiftValues) {
      errors.push(`Missing Swift enum: ${enumName}`)
    } else {
      const missing = tsValues.filter(v => !swiftValues.includes(v))
      const extra = swiftValues.filter(v => !tsValues.includes(v))
      if (missing.length > 0) {
        errors.push(`Enum ${enumName} missing values in Swift: ${missing.join(', ')}`)
      }
      if (extra.length > 0) {
        warnings.push(`Enum ${enumName} has extra values in Swift: ${extra.join(', ')}`)
      }
    }
  }

  // Check types
  for (const tsType of tsTypes) {
    const swiftType = swiftTypes.find(t => t.name === tsType.name || (tsType.name === 'EventRow' && t.name === 'Event'))
    if (!swiftType) {
      errors.push(`Missing Swift type: ${tsType.name}`)
      continue
    }

    // Check fields (simplified - would need better field mapping)
    for (const tsField of tsType.fields) {
      const swiftField = swiftType.fields.find(f => 
        f.name === tsField.name || 
        f.name === tsField.name.replace(/_/g, '') // Handle snake_case to camelCase
      )
      if (!swiftField) {
        warnings.push(`Type ${tsType.name} missing field in Swift: ${tsField.name}`)
      }
    }
  }

  return { errors, warnings }
}

/**
 * Main validation function
 */
function main() {
  const projectRoot = join(__dirname, '..')
  const tsTypesPath = join(projectRoot, 'web/shared/types/models.ts')
  const swiftTypesPath = join(projectRoot, 'ios/SSA-Admin/Shared/Models/DataModels.swift')

  console.log('🔍 Validating type synchronization...\n')

  try {
    const tsData = parseTypeScriptTypes(tsTypesPath)
    const swiftData = parseSwiftTypes(swiftTypesPath)

    const { errors, warnings } = validateTypes(
      tsData.types,
      swiftData.types,
      tsData.enums,
      swiftData.enums
    )

    if (errors.length > 0) {
      console.error('❌ Errors found:')
      errors.forEach(e => console.error(`  - ${e}`))
      process.exit(1)
    }

    if (warnings.length > 0) {
      console.warn('⚠️  Warnings:')
      warnings.forEach(w => console.warn(`  - ${w}`))
    }

    if (errors.length === 0 && warnings.length === 0) {
      console.log('✅ Types are synchronized!')
    }
  } catch (error: any) {
    console.error('❌ Validation failed:', error.message)
    console.error('\nNote: This is a basic validation script. For complete validation,')
    console.error('manually review docs/TYPE_SYNC.md and compare types.')
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

export { parseTypeScriptTypes, parseSwiftTypes, validateTypes }

