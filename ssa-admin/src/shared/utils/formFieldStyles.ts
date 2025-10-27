/**
 * Shared form field styling utilities for consistent dark mode appearance
 */

export interface FormFieldStyleProps {
  darkMode?: boolean
}

/**
 * Get the base styling for form fields (input, select, textarea)
 */
export const getFormFieldStyles = (darkMode: boolean = false) => ({
  width: '100%',
  padding: '12px',
  border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
  borderRadius: '8px',
  fontSize: '14px',
  background: darkMode ? '#1e1e1e' : '#ffffff',
  color: darkMode ? '#ffffff !important' : '#000000 !important',
  WebkitTextFillColor: darkMode ? '#ffffff !important' : '#000000 !important',
  WebkitOpacity: 1,
  caretColor: darkMode ? '#ffffff !important' : '#000000 !important'
})

/**
 * Get the styling for labels
 */
export const getLabelStyles = (darkMode: boolean = false) => ({
  display: 'block',
  marginBottom: '6px',
  fontSize: '14px',
  fontWeight: '500',
  color: darkMode ? '#f9fafb' : '#374151'
})

/**
 * Get the CSS class name for form fields based on dark mode
 */
export const getFormFieldClassName = (darkMode: boolean = false): string => {
  return darkMode ? 'form-field-white-text' : ''
}

/**
 * Get common props for form fields including className and style
 */
export const getFormFieldProps = (darkMode: boolean = false) => ({
  className: getFormFieldClassName(darkMode),
  style: getFormFieldStyles(darkMode)
})

/**
 * Get common props for labels including style
 */
export const getLabelProps = (darkMode: boolean = false) => ({
  style: getLabelStyles(darkMode)
})
