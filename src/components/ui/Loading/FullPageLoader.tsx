import React from 'react';
import { Spinner } from './Spinner';

export interface FullPageLoaderProps {
  /** Message to display */
  message?: string;
  /** Sub-message for additional context */
  subMessage?: string;
  /** Show the Wizdi logo */
  showLogo?: boolean;
  /** Custom content */
  children?: React.ReactNode;
}

/**
 * Full Page Loading Overlay
 *
 * Features:
 * - Centered content
 * - Accessible announcements
 * - Optional logo display
 * - Semi-transparent backdrop
 *
 * @example
 * ```tsx
 * <FullPageLoader message="יוצר תוכן..." />
 * ```
 */
export const FullPageLoader: React.FC<FullPageLoaderProps> = ({
  message = 'טוען...',
  subMessage,
  showLogo = true,
  children,
}) => {
  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-busy="true"
      className="
        fixed inset-0
        flex flex-col items-center justify-center
        bg-wizdi-cloud/90 dark:bg-slate-900/90
        backdrop-blur-sm
        z-modal
      "
    >
      <div className="flex flex-col items-center text-center p-8 max-w-md">
        {showLogo && (
          <img
            src="/WizdiLogo.png"
            alt="Wizdi"
            className="w-20 h-20 mb-6 animate-pulse motion-reduce:animate-none"
            loading="eager"
          />
        )}

        {children || (
          <>
            <Spinner size="xl" color="action" label={message} className="mb-4" />

            <h2 className="text-xl font-bold text-wizdi-royal dark:text-white mb-2">
              {message}
            </h2>

            {subMessage && (
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {subMessage}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default FullPageLoader;
