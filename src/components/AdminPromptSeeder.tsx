/**
 * Admin component to seed new prompts to the library
 * Only visible to admin users - renders as a minimal link that expands on click
 */

import React, { useState, useRef, useEffect } from 'react';
import { IconDatabaseImport, IconCheck, IconAlertCircle, IconLoader, IconX } from '@tabler/icons-react';

interface AdminPromptSeederProps {
  isAdmin: boolean;
}

export default function AdminPromptSeeder({ isAdmin }: AdminPromptSeederProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!isAdmin) return null;

  const handleSeedPrompts = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const { getApp } = await import('firebase/app');
      const functions = getFunctions(getApp());
      const seedPromptsLibrary = httpsCallable(functions, 'seedPromptsLibrary');

      const result: any = await seedPromptsLibrary();

      if (result.data.success) {
        setAddedCount(result.data.count || 0);
        setSuccess(true);
        // Auto close after success
        setTimeout(() => {
          setIsOpen(false);
          setSuccess(false);
        }, 2000);
      } else {
        throw new Error('Failed to seed prompts');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add prompts');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative inline-block" dir="rtl">
      {/* Minimal link button - matches other admin links */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-slate-400 text-xs hover:text-violet-600 transition-colors px-2 py-1"
      >
        ניהול פרומפטים
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="absolute top-full right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200/60 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                <IconDatabaseImport className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-sm text-slate-800">ניהול פרומפטים</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
            >
              <IconX className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-500 mb-4">
            הוספת פרומפטי seed למאגר הפרומפטים
          </p>

          {/* Action button */}
          <button
            onClick={handleSeedPrompts}
            disabled={loading || success}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
              success
                ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white'
                : loading
                ? 'bg-slate-200 text-slate-500 cursor-wait'
                : 'bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:shadow-lg hover:shadow-violet-500/25'
            }`}
          >
            {loading ? (
              <>
                <IconLoader className="w-4 h-4 animate-spin" />
                <span>מוסיף...</span>
              </>
            ) : success ? (
              <>
                <IconCheck className="w-4 h-4" />
                <span>נוספו {addedCount} פרומפטים!</span>
              </>
            ) : (
              <>
                <IconDatabaseImport className="w-4 h-4" />
                <span>הוסף פרומפטים</span>
              </>
            )}
          </button>

          {/* Error message */}
          {error && (
            <div className="mt-3 flex items-center gap-2 text-rose-600 text-xs bg-rose-50 p-2 rounded-lg">
              <IconAlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
