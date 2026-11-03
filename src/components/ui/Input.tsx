import { useId, type InputHTMLAttributes } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  helpText?: string
  error?: string
}

export function Input({
  label,
  helpText,
  error,
  id,
  className = '',
  ...rest
}: InputProps) {
  const generatedId = useId()
  const inputId = id ?? `input-${generatedId}`
  const helpId = `${inputId}-help`
  const errorId = `${inputId}-error`

  const describedByIds: string[] = []
  if (helpText) {
    describedByIds.push(helpId)
  }
  if (error) {
    describedByIds.push(errorId)
  }

  const inputClasses = [
    'ui-input__control',
    error ? 'ui-input__control--error' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="ui-input">
      <label htmlFor={inputId} className="ui-input__label">
        {label}
      </label>
      <input
        id={inputId}
        className={inputClasses}
        aria-invalid={Boolean(error)}
        aria-describedby={describedByIds.length > 0 ? describedByIds.join(' ') : undefined}
        {...rest}
      />
      {helpText ? (
        <p id={helpId} className="ui-input__help">
          {helpText}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="ui-input__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

