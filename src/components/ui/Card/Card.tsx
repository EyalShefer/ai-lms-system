import React, { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

/**
 * Card variants
 */
export type CardVariant = 'glass' | 'solid' | 'outline' | 'elevated';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Visual style variant */
  variant?: CardVariant;
  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Interactive card (adds hover effects) */
  interactive?: boolean;
  /** Card is clickable (adds role="button" and keyboard support) */
  clickable?: boolean;
  /** Header content */
  header?: ReactNode;
  /** Footer content */
  footer?: ReactNode;
  /** Children content */
  children: ReactNode;
}

/**
 * Accessible Card Component
 *
 * Features:
 * - Glass morphism effect
 * - Dark mode support
 * - Interactive states
 * - Keyboard accessible when clickable
 * - Semantic structure with header/footer
 *
 * @example
 * ```tsx
 * <Card variant="glass" interactive>
 *   <h3>כותרת</h3>
 *   <p>תוכן הכרטיס</p>
 * </Card>
 * ```
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'glass',
      padding = 'md',
      interactive = false,
      clickable = false,
      header,
      footer,
      children,
      className = '',
      onClick,
      onKeyDown,
      ...props
    },
    ref
  ) => {
    // Base styles
    const baseStyles = 'rounded-3xl transition-all duration-300';

    // Padding styles
    const paddingStyles: Record<typeof padding, string> = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    };

    // Variant styles
    const variantStyles: Record<CardVariant, string> = {
      glass: `
        bg-white/85 backdrop-blur-xl
        border border-white/40
        shadow-glass
        dark:bg-slate-800/85 dark:border-white/10
      `,
      solid: `
        bg-white
        border border-slate-200
        shadow-sm
        dark:bg-slate-800 dark:border-slate-700
      `,
      outline: `
        bg-transparent
        border-2 border-slate-200
        dark:border-slate-700
      `,
      elevated: `
        bg-white
        shadow-xl
        dark:bg-slate-800
      `,
    };

    // Interactive styles
    const interactiveStyles = interactive
      ? `
        hover:shadow-xl hover:-translate-y-1
        cursor-pointer
        active:scale-[0.98]
      `
      : '';

    // Clickable accessibility
    const clickableProps = clickable
      ? {
          role: 'button' as const,
          tabIndex: 0,
          onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
            }
            onKeyDown?.(e);
          },
        }
      : {};

    return (
      <div
        ref={ref}
        className={`
          ${baseStyles}
          ${paddingStyles[padding]}
          ${variantStyles[variant]}
          ${interactiveStyles}
          ${className}
        `.replace(/\s+/g, ' ').trim()}
        onClick={onClick}
        {...clickableProps}
        {...props}
      >
        {header && (
          <div className="mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
            {header}
          </div>
        )}

        <div className="card-content">
          {children}
        </div>

        {footer && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            {footer}
          </div>
        )}
      </div>
    );
  }
);

Card.displayName = 'Card';

/**
 * Card Header Component
 */
export const CardHeader: React.FC<{ children: ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={`flex items-center justify-between ${className}`}>
    {children}
  </div>
);

/**
 * Card Title Component
 */
export const CardTitle: React.FC<{ children: ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <h3 className={`text-xl font-bold text-slate-800 dark:text-slate-100 ${className}`}>
    {children}
  </h3>
);

/**
 * Card Description Component
 */
export const CardDescription: React.FC<{ children: ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <p className={`text-slate-500 dark:text-slate-400 text-sm ${className}`}>
    {children}
  </p>
);

export default Card;
