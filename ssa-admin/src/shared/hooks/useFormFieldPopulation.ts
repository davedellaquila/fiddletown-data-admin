import { useEffect } from 'react'

interface FormFieldConfig {
  fieldName: string
  selector: string
  formatter?: (value: any) => string
}

interface UseFormFieldPopulationProps {
  editing: any
  fieldConfigs: FormFieldConfig[]
  debugPrefix?: string
}

/**
 * Custom hook that automatically populates form fields with data from the editing state.
 * This eliminates the need to manually implement field population for each form.
 * 
 * @param editing - The current editing state object
 * @param fieldConfigs - Array of field configurations defining how to populate each field
 * @param debugPrefix - Optional prefix for debug logging (e.g., "Events", "Locations")
 */
export function useFormFieldPopulation({
  editing,
  fieldConfigs,
  debugPrefix = 'Form'
}: UseFormFieldPopulationProps) {
  
  useEffect(() => {
    if (!editing) return

    setTimeout(() => {
      console.log(`🔧 ${debugPrefix} - Looking for fields with ID:`, editing.id)
      
      fieldConfigs.forEach(config => {
        const field = document.querySelector(config.selector) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        
        if (field) {
          const rawValue = editing[config.fieldName]
          const formattedValue = config.formatter ? config.formatter(rawValue) : (rawValue || '')
          
          console.log(`🔧 ${debugPrefix} - Manually setting ${config.fieldName} field value:`, formattedValue)
          
          // Set the field value
          field.value = formattedValue
          
          // Ensure text is visible
          field.style.color = '#000000'
          
          console.log(`🔧 ${debugPrefix} - ${config.fieldName} field value after setting:`, field.value)
        } else {
          console.log(`🔧 ${debugPrefix} - ${config.fieldName} field not found!`)
        }
      })
    }, 50)
  }, [editing, fieldConfigs, debugPrefix])
}

/**
 * Helper function to create field configurations for common field types
 */
export const createFieldConfigs = {
  // Text input fields
  text: (fieldName: string, keyPrefix: string = '') => ({
    fieldName,
    selector: `input[data-key="${keyPrefix}${fieldName}-${keyPrefix ? '{editing.id}' : ''}"]`,
    formatter: (value: any) => value || ''
  }),

  // Date fields (formats to YYYY-MM-DD)
  date: (fieldName: string, keyPrefix: string = '') => ({
    fieldName,
    selector: `input[data-key="${keyPrefix}${fieldName}-${keyPrefix ? '{editing.id}' : ''}"]`,
    formatter: (value: any) => value ? value.split('T')[0] : ''
  }),

  // Time fields (formats to HH:MM)
  time: (fieldName: string, keyPrefix: string = '') => ({
    fieldName,
    selector: `input[data-key="${keyPrefix}${fieldName}-${keyPrefix ? '{editing.id}' : ''}"]`,
    formatter: (value: any) => value ? value.substring(0, 5) : ''
  }),

  // Number fields
  number: (fieldName: string, keyPrefix: string = '', defaultValue: number = 0) => ({
    fieldName,
    selector: `input[data-key="${keyPrefix}${fieldName}-${keyPrefix ? '{editing.id}' : ''}"]`,
    formatter: (value: any) => value?.toString() || defaultValue.toString()
  }),

  // Select fields
  select: (fieldName: string, keyPrefix: string = '') => ({
    fieldName,
    selector: `select[data-key="${keyPrefix}${fieldName}-${keyPrefix ? '{editing.id}' : ''}"]`,
    formatter: (value: any) => value || ''
  }),

  // Textarea fields
  textarea: (fieldName: string, keyPrefix: string = '') => ({
    fieldName,
    selector: `textarea[data-key="${keyPrefix}${fieldName}-${keyPrefix ? '{editing.id}' : ''}"]`,
    formatter: (value: any) => value || ''
  })
}

/**
 * Helper function to create field configurations for Events module
 */
export const createEventsFieldConfigs = (editingId: string): FormFieldConfig[] => [
  {
    fieldName: 'name',
    selector: `input[data-key="name-${editingId}"]`,
    formatter: (value: any) => value || ''
  },
  {
    fieldName: 'slug',
    selector: `input[data-key="slug-${editingId}"]`,
    formatter: (value: any) => value || ''
  },
  {
    fieldName: 'host_org',
    selector: `input[data-key="host-org-${editingId}"]`,
    formatter: (value: any) => value || ''
  },
  {
    fieldName: 'location',
    selector: `input[data-key="location-${editingId}"]`,
    formatter: (value: any) => value || ''
  },
  {
    fieldName: 'start_date',
    selector: `input[data-key="start-date-${editingId}"]`,
    formatter: (value: any) => value ? value.split('T')[0] : ''
  },
  {
    fieldName: 'end_date',
    selector: `input[data-key="end-date-${editingId}"]`,
    formatter: (value: any) => value ? value.split('T')[0] : ''
  },
  {
    fieldName: 'start_time',
    selector: `input[data-key="start-time-${editingId}"]`,
    formatter: (value: any) => value ? value.substring(0, 5) : ''
  },
  {
    fieldName: 'end_time',
    selector: `input[data-key="end-time-${editingId}"]`,
    formatter: (value: any) => value ? value.substring(0, 5) : ''
  },
  {
    fieldName: 'website_url',
    selector: `input[data-key="website-url-${editingId}"]`,
    formatter: (value: any) => value || ''
  },
  {
    fieldName: 'recurrence',
    selector: `input[data-key="recurrence-${editingId}"]`,
    formatter: (value: any) => value || ''
  },
  {
    fieldName: 'sort_order',
    selector: `input[data-key="sort-order-${editingId}"]`,
    formatter: (value: any) => value?.toString() || '1000'
  }
]

/**
 * Helper function to create field configurations for Locations module
 */
export const createLocationsFieldConfigs = (editingId: string): FormFieldConfig[] => [
  {
    fieldName: 'name',
    selector: `input[data-key="name-${editingId}"]`,
    formatter: (value: any) => value || ''
  },
  {
    fieldName: 'slug',
    selector: `input[data-key="slug-${editingId}"]`,
    formatter: (value: any) => value || ''
  },
  {
    fieldName: 'region',
    selector: `input[data-key="region-${editingId}"]`,
    formatter: (value: any) => value || ''
  },
  {
    fieldName: 'description',
    selector: `textarea[data-key="description-${editingId}"]`,
    formatter: (value: any) => value || ''
  }
]
