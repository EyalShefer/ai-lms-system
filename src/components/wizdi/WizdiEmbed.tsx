/**
 * Wizdi Embed Component
 * Wrapper component for embedding our app in Wizdi's iframe
 */

import React, { useEffect, useState } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import {
  getWizdiParams,
  initWizdiListener,
  notifyApplicationLoaded,
  notifyError,
  onWizdiCommand
} from '../../services/wizdiIntegration';
import type { WizdiCommand } from '../../services/wizdiIntegration';

// Lazy load the actual components
const StudentHome = React.lazy(() => import('../StudentHome'));
const TeacherDashboard = React.lazy(() => import('../TeacherDashboard'));

interface WizdiEmbedProps {
  view: 'teacher' | 'student';
}

interface WizdiUserData {
  id: string;
  isTeacher: boolean;
  displayName?: string;
  locale: string;
  schoolId?: string;
  classes: Array<{ id: string; name: string }>;
}

export const WizdiEmbed: React.FC<WizdiEmbedProps> = ({ view }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<WizdiUserData | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const { userId, token, locale } = getWizdiParams();

    if (!userId || !token) {
      setError('חסרים פרמטרים נדרשים (userId, ctoken)');
      setLoading(false);
      notifyError('MISSING_PARAMS', 'Missing userId or ctoken');
      return;
    }

    // Initialize Wizdi message listener
    const cleanupListener = initWizdiListener();

    // Subscribe to commands from Wizdi
    const unsubscribeCommands = onWizdiCommand((command: WizdiCommand) => {
      handleWizdiCommand(command);
    });

    // Authenticate with Firebase
    authenticateUser(token, userId, locale);

    return () => {
      cleanupListener();
      unsubscribeCommands();
    };
  }, []);

  const authenticateUser = async (token: string, userId: string, locale: string) => {
    try {
      // Try to sign in with the custom token from Wizdi
      await signInWithCustomToken(auth, token);

      // Get user data from Firestore
      const wizdiUserDoc = await getDoc(doc(db, 'wizdi_users', userId));

      if (wizdiUserDoc.exists()) {
        const data = wizdiUserDoc.data();
        setUserData({
          id: userId,
          isTeacher: data.isTeacher,
          displayName: data.displayName,
          locale: data.locale || locale,
          schoolId: data.schoolId,
          classes: data.classes || []
        });
      } else {
        // Fallback: try regular users collection
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData({
            id: userId,
            isTeacher: view === 'teacher',
            displayName: data.displayName,
            locale,
            classes: []
          });
        } else {
          // User not found but token is valid - create minimal user data
          setUserData({
            id: userId,
            isTeacher: view === 'teacher',
            locale,
            classes: []
          });
        }
      }

      setIsAuthenticated(true);
      setLoading(false);

      // Notify Wizdi that we're loaded
      notifyApplicationLoaded(userId, view === 'teacher');

    } catch (err: any) {
      console.error('Wizdi auth error:', err);

      // Check if it's a token error
      if (err.code === 'auth/invalid-custom-token' || err.code === 'auth/custom-token-mismatch') {
        setError('טוקן לא תקין או פג תוקף');
        notifyError('TOKEN_EXPIRED', 'Invalid or expired token');
      } else {
        setError('שגיאה באימות: ' + err.message);
        notifyError('INTERNAL_ERROR', err.message);
      }

      setLoading(false);
    }
  };

  const handleWizdiCommand = (command: WizdiCommand) => {
    console.log('[WizdiEmbed] Received command:', command);

    switch (command.type) {
      case 'NAVIGATE_TO_TASK':
        if (command.taskId) {
          // Navigate to specific task - this would need routing integration
          window.location.hash = `#task=${command.taskId}`;
        }
        break;

      case 'NAVIGATE_TO_COURSE':
        if (command.courseId) {
          window.location.hash = `#course=${command.courseId}`;
        }
        break;

      case 'REFRESH_DATA':
        // Trigger a refresh - could use a context or state update
        window.location.reload();
        break;
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">טוען...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">שגיאה</h2>
          <p className="text-slate-600 mb-4">{error}</p>
          <p className="text-sm text-slate-400">
            אנא נסה לטעון מחדש או פנה לתמיכה
          </p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !userData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md text-center">
          <div className="text-yellow-500 text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">אימות נדרש</h2>
          <p className="text-slate-600">
            אנא התחבר דרך Wizdi כדי לגשת למערכת
          </p>
        </div>
      </div>
    );
  }

  // Render the appropriate view
  return (
    <div className="wizdi-embed-container" dir="rtl">
      <React.Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        }
      >
        {view === 'teacher' ? (
          <WizdiTeacherView userData={userData} />
        ) : (
          <WizdiStudentView userData={userData} />
        )}
      </React.Suspense>
    </div>
  );
};

// Teacher view wrapper
const WizdiTeacherView: React.FC<{ userData: WizdiUserData }> = ({ userData }) => {
  return (
    <div className="wizdi-teacher-view">
      {/*
        Here we would render the TeacherDashboard with Wizdi context
        For now, showing a placeholder that explains what will be shown
      */}
      <div className="p-6">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">
            שלום, {userData.displayName || 'מורה'}
          </h1>
          <p className="text-slate-600">
            ברוכים הבאים למערכת הלמידה החכמה
          </p>
        </div>

        {/* Quick stats for teacher */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard title="קורסים" value="-" icon="📚" />
          <StatCard title="תלמידים" value="-" icon="👥" />
          <StatCard title="משימות השבוע" value="-" icon="📝" />
          <StatCard title="הגשות ממתינות" value="-" icon="📥" />
        </div>

        {/*
          In full implementation, render:
          <TeacherDashboard wizdiMode={true} wizdiUser={userData} />
        */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-blue-700">
            הדשבורד המלא יוצג כאן - כולל ניהול קורסים, מעקב תלמידים, ונתונים סטטיסטיים
          </p>
        </div>
      </div>
    </div>
  );
};

// Student view wrapper
const WizdiStudentView: React.FC<{ userData: WizdiUserData }> = ({ userData }) => {
  return (
    <div className="wizdi-student-view">
      <div className="p-6">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">
            שלום, {userData.displayName || 'תלמיד'}
          </h1>
          <p className="text-slate-600">
            המשימות שלך ממתינות לך
          </p>
        </div>

        {/* Quick stats for student */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard title="משימות פתוחות" value="-" icon="📝" />
          <StatCard title="ציון ממוצע" value="-" icon="⭐" />
          <StatCard title="נקודות XP" value="-" icon="💎" />
          <StatCard title="ימי רצף" value="-" icon="🔥" />
        </div>

        {/*
          In full implementation, render:
          <StudentHome wizdiMode={true} wizdiUser={userData} />
        */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p className="text-green-700">
            רשימת המשימות שלך תוצג כאן - כולל משימות פתוחות, התקדמות, וציונים
          </p>
        </div>
      </div>
    </div>
  );
};

// Reusable stat card component
const StatCard: React.FC<{ title: string; value: string; icon: string }> = ({ title, value, icon }) => (
  <div className="bg-white rounded-lg shadow p-4 text-center">
    <div className="text-2xl mb-1">{icon}</div>
    <div className="text-2xl font-bold text-slate-800">{value}</div>
    <div className="text-sm text-slate-500">{title}</div>
  </div>
);

export default WizdiEmbed;
