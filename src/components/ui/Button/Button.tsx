import React, { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

/**
 * Button variants matching Wizdi design system
 */
export type ButtonVariant = 'action' | 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant */
  variant?: ButtonVariant;
  /** Size of the button */
  size?: ButtonSize;
  /** Full width button */
  fullWidth?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Left icon */
  leftIcon?: ReactNode;
  /** Right icon */
  rightIcon?: ReactNode;
  /** Children content */
  children: ReactNode;
}

/**
 * Accessible Button Component
 *
 * Features:
 * - WCAG AA compliant contrast ratios
 * - Minimum 44px touch target
 * - Focus-visible states
 * - Keyboard accessible
 * - Loading state support
 * - RTL compatible
 *
 * @example
 * ```tsx
 * <Button variant="action" onClick={handleClick}>
 *   התחל עכשיו
 * </Button>
 * ```
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      className = '',
      type = 'button',
      ...props
    },
    ref
  ) => {
    // Base styles with accessibility
    const baseStyles = `
      inline-flex items-center justify-center gap-2
      font-bold rounded-full
      transition-all duration-150
      cursor-pointer select-none
      disabled:opacity-50 disabled:cursor-not-allowed
      focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wizdi-cyan
    `;

    // Size variants (all meet 44px touch target minimum)
    const sizeStyles: Record<ButtonSize, string> = {
      sm: 'min-h-[44px] px-4 py-2 text-sm',
      md: 'min-h-[44px] px-6 py-3 text-base',
      lg: 'min-h-[52px] px-8 py-4 text-lg',
    };

    // Variant styles
    const variantStyles: Record<ButtonVariant, string> = {
      action: `
        bg-wizdi-action text-white
        border-b-[6px] border-wizdi-action-dark
        uppercase tracking-wide
        hover:bg-wizdi-action-hover hover:brightness-105
        active:translate-y-[6px] active:border-b-0 active:mt-[6px]
        shadow-md hover:shadow-lg
      `,
      primary: `
        bg-wizdi-royal text-white
        border-b-[6px] border-wizdi-royal-dark
        hover:bg-wizdi-royal-dark
        active:translate-y-[6px] active:border-b-0 active:mt-[6px]
        shadow-md hover:shadow-lg
      `,
      secondary: `
        bg-white text-wizdi-royal
        border-2 border-wizdi-royal
        hover:bg-wizdi-cloud
        active:bg-wizdi-royal-light
      `,
      ghost: `
        bg-transparent text-wizdi-royal
        hover:bg-wizdi-cloud
        dark:text-slate-200 dark:hover:bg-slate-800
      `,
      danger: `
        bg-error text-white
        border-b-[6px] border-red-700
        hover:bg-red-600
        active:translate-y-[6px] active:border-b-0 active:mt-[6px]
      `,
    };

    // Width styles
    const widthStyles = fullWidth ? 'w-full' : '';

    // Loading spinner component
    const LoadingSpinner = () => (
      <svg
        className="animate-spin h-5 w-5"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    );

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`
          ${baseStyles}
          ${sizeStyles[size]}
          ${variantStyles[variant]}
          ${widthStyles}
          ${className}
        `.replace(/\s+/g, ' ').trim()}
        aria-busy={isLoading}
        aria-disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <LoadingSpinner />
            <span className="sr-only">טוען...</span>
            {children}
          </>
        ) : (
          <>
            {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
