/**
 * StudentContext - Shared context for student gamification and navigation
 * Provides real-time gamification data across all student views
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import {
  syncProgress,
  checkDailyStreak,
  DEFAULT_GAMIFICATION_PROFILE,
  addXp as calculateXp
} from '../services/gamificationService';
import type { GamificationProfile, GamificationEventPayload } from '../shared/types/courseTypes';

export type StudentTab = 'tasks' | 'progress' | 'shop' | 'profile';
export type StudentView = 'dashboard' | 'course';

interface StudentContextType {
  // Gamification
  gamificationProfile: GamificationProfile | null;
  isLoadingProfile: boolean;

  // XP animation trigger
  triggerXp: (amount: number, reason?: string) => Promise<void>;
  pendingXpEvent: GamificationEventPayload | null;
  clearXpEvent: () => void;

  // Navigation
  activeTab: StudentTab;
  setActiveTab: (tab: StudentTab) => void;
  currentView: StudentView;
  setCurrentView: (view: StudentView) => void;

  // Course context (when in course view)
  currentCourseId: string | null;
  currentAssignmentId: string | null;
  setCurrentCourse: (courseId: string | null, assignmentId?: string | null) => void;

  // Navigation helpers
  goToDashboard: () => void;
  goToCourse: (courseId: string, assignmentId?: string) => void;
}

const StudentContext = createContext<StudentContextType | null>(null);

interface StudentProviderProps {
  children: ReactNode;
  uid: string | null;
  initialCourseId?: string | null;
  initialAssignmentId?: string | null;
}

export function StudentProvider({
  children,
  uid,
  initialCourseId = null,
  initialAssignmentId = null
}: StudentProviderProps) {
  // Gamification state
  const [gamificationProfile, setGamificationProfile] = useState<GamificationProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [pendingXpEvent, setPendingXpEvent] = useState<GamificationEventPayload | null>(null);

  // Navigation state
  const [activeTab, setActiveTab] = useState<StudentTab>('tasks');
  const [currentView, setCurrentView] = useState<StudentView>(initialCourseId ? 'course' : 'dashboard');
  const [currentCourseId, setCurrentCourseId] = useState<string | null>(initialCourseId);
  const [currentAssignmentId, setCurrentAssignmentId] = useState<string | null>(initialAssignmentId);

  // Subscribe to gamification profile changes
  useEffect(() => {
    if (!uid) {
      setGamificationProfile(null);
      setIsLoadingProfile(false);
      return;
    }

    setIsLoadingProfile(true);

    const userRef = doc(db, 'users', uid);

    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const profile = {
          ...DEFAULT_GAMIFICATION_PROFILE,
          ...(data.gamification || {})
        };
        setGamificationProfile(profile);
      } else {
        // User doc doesn't exist yet - use defaults
        setGamificationProfile({ ...DEFAULT_GAMIFICATION_PROFILE });
      }
      setIsLoadingProfile(false);
    }, (error) => {
      console.error('Error listening to gamification profile:', error);
      setGamificationProfile({ ...DEFAULT_GAMIFICATION_PROFILE });
      setIsLoadingProfile(false);
    });

    // Check daily streak on mount
    checkDailyStreak(uid).catch(console.error);

    return () => unsubscribe();
  }, [uid]);

  // Trigger XP gain with animation event
  const triggerXp = useCallback(async (amount: number, reason: string = 'activity') => {
    if (!uid || !gamificationProfile) return;

    // Calculate optimistic update for animation
    const { newProfile, events } = calculateXp(gamificationProfile, amount, reason);

    // Create event for animation
    const event: GamificationEventPayload = {
      type: events.includes('LEVEL_UP') ? 'LEVEL_UP' : 'XP_GAIN',
      amount,
      reason,
      newLevel: events.includes('LEVEL_UP') ? newProfile.level : undefined,
      timestamp: Date.now()
    };

    setPendingXpEvent(event);

    // Sync to Firestore (will also trigger onSnapshot update)
    await syncProgress(uid, amount, 0);
  }, [uid, gamificationProfile]);

  const clearXpEvent = useCallback(() => {
    setPendingXpEvent(null);
  }, []);

  // Navigation helpers
  const setCurrentCourse = useCallback((courseId: string | null, assignmentId: string | null = null) => {
    setCurrentCourseId(courseId);
    setCurrentAssignmentId(assignmentId);
  }, []);

  const goToDashboard = useCallback(() => {
    setCurrentView('dashboard');
    setActiveTab('tasks');
  }, []);

  const goToCourse = useCallback((courseId: string, assignmentId?: string) => {
    setCurrentCourseId(courseId);
    setCurrentAssignmentId(assignmentId || null);
    setCurrentView('course');
  }, []);

  const value: StudentContextType = {
    gamificationProfile,
    isLoadingProfile,
    triggerXp,
    pendingXpEvent,
    clearXpEvent,
    activeTab,
    setActiveTab,
    currentView,
    setCurrentView,
    currentCourseId,
    currentAssignmentId,
    setCurrentCourse,
    goToDashboard,
    goToCourse
  };

  return (
    <StudentContext.Provider value={value}>
      {children}
    </StudentContext.Provider>
  );
}

export function useStudentContext() {
  const context = useContext(StudentContext);
  if (!context) {
    throw new Error('useStudentContext must be used within a StudentProvider');
  }
  return context;
}

// Optional hook that returns null instead of throwing if used outside provider
export function useOptionalStudentContext() {
  return useContext(StudentContext);
}
