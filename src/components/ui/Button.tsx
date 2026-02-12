import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

const variantClassName: Record<ButtonVariant, string> = {
  primary: 'ui-button--primary',
  secondary: 'ui-button--secondary',
  ghost: 'ui-button--ghost',
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', children, variant = 'primary', ...rest }, ref) => {
    const mergedClassName = ['ui-button', variantClassName[variant], className]
      .filter(Boolean)
      .join(' ')
      .trim()

    return (
      <button ref={ref} className={mergedClassName} {...rest}>
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
