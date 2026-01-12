/**
 * Admin component to migrate courses - add createdAt to existing courses
 * Run once to fix courses that don't have createdAt timestamp
 */

import React, { useState } from 'react';
import { IconDatabaseImport, IconCheck, IconAlertCircle, IconLoader } from '@tabler/icons-react';
import { collection, getDocs, updateDoc, doc, serverTimestamp, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

interface AdminCourseMigrationProps {
  isAdmin: boolean;
}

export default function AdminCourseMigration({ isAdmin }: AdminCourseMigrationProps) {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ total: number; updated: number; skipped: number } | null>(null);

  if (!isAdmin || !currentUser) return null;

  const handleMigration = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    setStats(null);

    try {
      // Fetch only MY courses (to avoid permission issues)
      const coursesQuery = query(
        collection(db, "courses"),
        where("teacherId", "==", currentUser.uid)
      );
      const coursesSnapshot = await getDocs(coursesQuery);

      let total = 0;
      let updated = 0;
      let skipped = 0;

      for (const courseDoc of coursesSnapshot.docs) {
        total++;
        const data = courseDoc.data();

        // Check if createdAt is a valid timestamp (has seconds property)
        const hasValidTimestamp = data.createdAt?.seconds || data.createdAt?.toMillis;

        if (!hasValidTimestamp) {
          // Add createdAt with current timestamp (or use lastUpdated if available)
          const newTimestamp = (data.lastUpdated?.seconds || data.lastUpdated?.toMillis)
            ? data.lastUpdated
            : serverTimestamp();

          await updateDoc(doc(db, "courses", courseDoc.id), {
            createdAt: newTimestamp
          });
          updated++;
          console.log(`✅ Updated course: ${courseDoc.id} - ${data.title} (had invalid createdAt:`, data.createdAt, `)`);
        } else {
          skipped++;
        }
      }

      setStats({ total, updated, skipped });
      setSuccess(true);
    } catch (err) {
      console.error("Migration error:", err);
      setError(err instanceof Error ? err.message : 'Migration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 mb-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <IconDatabaseImport className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">מיגרציה - הוספת createdAt לקורסים</h3>
            <p className="text-sm text-slate-500">
              תיקון קורסים קיימים שאין להם תאריך יצירה
            </p>
          </div>
        </div>

        <button
          onClick={handleMigration}
          disabled={loading}
          className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
            success
              ? 'bg-green-100 text-green-700 cursor-default'
              : loading
              ? 'bg-slate-100 text-slate-400 cursor-wait'
              : 'bg-amber-500 text-white hover:bg-amber-600'
          }`}
        >
          {loading ? (
            <>
              <IconLoader className="w-4 h-4 animate-spin" />
              מעדכן...
            </>
          ) : success ? (
            <>
              <IconCheck className="w-4 h-4" />
              הושלם!
            </>
          ) : (
            <>
              <IconDatabaseImport className="w-4 h-4" />
              הרץ מיגרציה
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <IconAlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {success && stats && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700">
            <strong>סה"כ קורסים:</strong> {stats.total} |
            <strong> עודכנו:</strong> {stats.updated} |
            <strong> דולגו (כבר היה):</strong> {stats.skipped}
          </p>
        </div>
      )}
    </div>
  );
}
