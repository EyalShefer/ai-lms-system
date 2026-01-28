/**
 * Custom Claims Hook
 *
 * Access user roles and permissions from Firebase Auth custom claims.
 * Claims are stored in the JWT token, so no API calls needed!
 *
 * Usage:
 * ```tsx
 * const { claims, isAdmin, isTeacher, isPremium, loading } = useCustomClaims();
 *
 * if (isAdmin) {
 *   // Show admin panel
 * }
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { User, IdTokenResult } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';

// ============================================================
// TYPES
// ============================================================

export interface UserClaims {
  role?: 'admin' | 'teacher' | 'student';
  premium?: boolean;
  organizationId?: string;
  permissions?: string[];
  claimsVersion?: number;
}

export interface ClaimsState {
  claims: UserClaims | null;
  isAdmin: boolean;
  isTeacher: boolean;
  isPremium: boolean;
  loading: boolean;
  error: Error | null;
  refreshClaims: () => Promise<void>;
}

// ============================================================
// HOOK
// ============================================================

/**
 * Hook to access custom claims from the current user's token
 */
export function useCustomClaims(): ClaimsState {
  const { currentUser } = useAuth();
  const [claims, setClaims] = useState<UserClaims | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Extract claims from token result
   */
  const extractClaims = useCallback((tokenResult: IdTokenResult): UserClaims => {
    const { role, premium, organizationId, permissions, claimsVersion } = tokenResult.claims;

    return {
      role: role as UserClaims['role'],
      premium: premium as boolean,
      organizationId: organizationId as string,
      permissions: permissions as string[],
      claimsVersion: claimsVersion as number
    };
  }, []);

  /**
   * Fetch claims from current token
   */
  const fetchClaims = useCallback(async (user: User, forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      // Get token with optional force refresh
      const tokenResult = await user.getIdTokenResult(forceRefresh);
      const extractedClaims = extractClaims(tokenResult);

      setClaims(extractedClaims);
    } catch (err) {
      setError(err as Error);
      setClaims(null);
    } finally {
      setLoading(false);
    }
  }, [extractClaims]);

  /**
   * Force refresh claims from server
   * Call this after role changes to get updated claims
   */
  const refreshClaims = useCallback(async () => {
    if (currentUser) {
      await fetchClaims(currentUser, true);
    }
  }, [currentUser, fetchClaims]);

  // Fetch claims when user changes
  useEffect(() => {
    if (currentUser) {
      fetchClaims(currentUser);
    } else {
      setClaims(null);
      setLoading(false);
    }
  }, [currentUser, fetchClaims]);

  // Derived state
  const isAdmin = claims?.role === 'admin';
  const isTeacher = claims?.role === 'teacher' || claims?.role === 'admin';
  const isPremium = claims?.premium === true || claims?.role === 'admin';

  return {
    claims,
    isAdmin,
    isTeacher,
    isPremium,
    loading,
    error,
    refreshClaims
  };
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Get claims from a Firebase User object (non-hook version)
 */
export async function getClaimsFromUser(user: User): Promise<UserClaims | null> {
  try {
    const tokenResult = await user.getIdTokenResult();
    const { role, premium, organizationId, permissions, claimsVersion } = tokenResult.claims;

    return {
      role: role as UserClaims['role'],
      premium: premium as boolean,
      organizationId: organizationId as string,
      permissions: permissions as string[],
      claimsVersion: claimsVersion as number
    };
  } catch {
    return null;
  }
}

/**
 * Check if current user has a specific role
 */
export async function checkRole(role: UserClaims['role']): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;

  const claims = await getClaimsFromUser(user);
  return claims?.role === role;
}

/**
 * Check if current user has admin access
 */
export async function checkIsAdmin(): Promise<boolean> {
  return checkRole('admin');
}

/**
 * Check if current user has teacher access
 */
export async function checkIsTeacher(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;

  const claims = await getClaimsFromUser(user);
  return claims?.role === 'teacher' || claims?.role === 'admin';
}

/**
 * Check if current user has premium access
 */
export async function checkIsPremium(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;

  const claims = await getClaimsFromUser(user);
  return claims?.premium === true || claims?.role === 'admin';
}

export default useCustomClaims;
