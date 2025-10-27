import React from 'react'
import { getFormFieldStyles, getLabelStyles, getFormFieldClassName } from '../utils/formFieldStyles'

interface FormFieldProps {
  label: string
  required?: boolean
  darkMode?: boolean
  children: React.ReactNode
}

export const FormField: React.FC<FormFieldProps> = ({ 
  label, 
  required = false, 
  darkMode = false, 
  children 
}) => {
  return (
    <div>
      <label style={getLabelStyles(darkMode)}>
        {label} {required && '*'}
      </label>
      {children}
    </div>
  )
}

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  darkMode?: boolean
}

export const InputField: React.FC<InputFieldProps> = ({ 
  darkMode = false, 
  style, 
  className, 
  ...props 
}) => {
  return (
    <input
      className={getFormFieldClassName(darkMode)}
      style={{ ...getFormFieldStyles(darkMode), ...style }}
      {...props}
    />
  )
}

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  darkMode?: boolean
}

export const SelectField: React.FC<SelectFieldProps> = ({ 
  darkMode = false, 
  style, 
  className, 
  ...props 
}) => {
  return (
    <select
      className={getFormFieldClassName(darkMode)}
      style={{ ...getFormFieldStyles(darkMode), ...style }}
      {...props}
    />
  )
}

interface TextareaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  darkMode?: boolean
}

export const TextareaField: React.FC<TextareaFieldProps> = ({ 
  darkMode = false, 
  style, 
  className, 
  ...props 
}) => {
  return (
    <textarea
      className={getFormFieldClassName(darkMode)}
      style={{ 
        ...getFormFieldStyles(darkMode), 
        minHeight: '80px',
        resize: 'vertical',
        ...style 
      }}
      {...props}
    />
  )
}
