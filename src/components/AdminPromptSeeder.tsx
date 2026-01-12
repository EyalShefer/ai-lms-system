/**
 * Admin component to seed new prompts to the library
 * Only visible to admin users
 */

import React, { useState } from 'react';
import { IconDatabaseImport, IconCheck, IconAlertCircle, IconLoader } from '@tabler/icons-react';
import { addNewPromptsToLibrary, NEW_PROMPTS } from '../data/newPrompts';

interface AdminPromptSeederProps {
  isAdmin: boolean;
}

export default function AdminPromptSeeder({ isAdmin }: AdminPromptSeederProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<string[]>([]);

  if (!isAdmin) return null;

  const handleSeedPrompts = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const ids = await addNewPromptsToLibrary();
      setAddedIds(ids);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add prompts');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4 mb-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <IconDatabaseImport className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">כלי אדמין - הוספת פרומפטים</h3>
            <p className="text-sm text-slate-500">
              {NEW_PROMPTS.length} פרומפטים חדשים מוכנים להוספה
            </p>
          </div>
        </div>

        <button
          onClick={handleSeedPrompts}
          disabled={loading || success}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
            success
              ? 'bg-green-500 text-white'
              : loading
              ? 'bg-slate-300 text-slate-500 cursor-wait'
              : 'bg-purple-600 text-white hover:bg-purple-700'
          }`}
        >
          {loading ? (
            <>
              <IconLoader className="w-5 h-5 animate-spin" />
              <span>מוסיף...</span>
            </>
          ) : success ? (
            <>
              <IconCheck className="w-5 h-5" />
              <span>נוספו {addedIds.length} פרומפטים!</span>
            </>
          ) : (
            <>
              <IconDatabaseImport className="w-5 h-5" />
              <span>הוסף פרומפטים</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-red-600 text-sm">
          <IconAlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mt-3 text-sm text-green-600">
          הפרומפטים נוספו בהצלחה! רענן את הדף כדי לראות אותם.
        </div>
      )}
    </div>
  );
}
