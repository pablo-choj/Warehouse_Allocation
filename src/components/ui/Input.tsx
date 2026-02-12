import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  hint?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, className = '', id, name, ...rest }, ref) => {
    const controlId = id ?? name
    const controlClassName = [
      'ui-input__control',
      error ? 'ui-input__control--error' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')
      .trim()

    return (
      <label className="ui-input" htmlFor={controlId}>
        {label && <span className="ui-input__label">{label}</span>}
        <input id={controlId} ref={ref} className={controlClassName} name={name} {...rest} />
        {(hint || error) && (
          <span className={['ui-input__hint', error ? 'ui-input__hint--error' : ''].join(' ').trim()}>
            {error ?? hint}
          </span>
        )}
      </label>
    )
  },
)

Input.displayName = 'Input'
