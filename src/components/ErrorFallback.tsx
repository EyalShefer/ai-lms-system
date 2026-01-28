/**
 * Error Fallback Component
 *
 * Displayed when a React error boundary catches an error.
 * Provides user-friendly error message and recovery options.
 */

import React from 'react';
import type { FallbackProps } from '../services/errorMonitoring';

interface ErrorFallbackComponentProps {
  error: Error;
  resetError?: () => void;
}

export const ErrorFallback: React.FC<ErrorFallbackComponentProps> = ({
  error,
  resetError
}) => {
  const isDev = import.meta.env.DEV;

  return (
    <div
      role="alert"
      className="min-h-screen flex items-center justify-center bg-gray-50 p-4"
      dir="rtl"
    >
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
        {/* Error Icon */}
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          אופס! משהו השתבש
        </h2>

        {/* Message */}
        <p className="text-gray-600 mb-4">
          אירעה שגיאה בלתי צפויה. הצוות שלנו כבר קיבל התראה ועובד על פתרון.
        </p>

        {/* Error details (dev only) */}
        {isDev && (
          <div className="bg-gray-100 rounded p-3 mb-4 text-left text-sm overflow-auto max-h-32">
            <code className="text-red-600 whitespace-pre-wrap">
              {error.message}
            </code>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {resetError && (
            <button
              onClick={resetError}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              נסה שוב
            </button>
          )}

          <button
            onClick={() => window.location.reload()}
            className="w-full py-2 px-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            רענון הדף
          </button>

          <button
            onClick={() => window.history.back()}
            className="w-full py-2 px-4 text-gray-500 hover:text-gray-700 transition-colors"
          >
            חזרה לדף הקודם
          </button>
        </div>

        {/* Support */}
        <p className="text-sm text-gray-400 mt-4">
          אם הבעיה נמשכת, צרו קשר עם התמיכה
        </p>
      </div>
    </div>
  );
};

/**
 * Wrapper for Sentry's FallbackProps
 */
export const SentryErrorFallback: React.FC<FallbackProps> = ({
  error,
  resetError
}) => {
  return <ErrorFallback error={error} resetError={resetError} />;
};

export default ErrorFallback;
