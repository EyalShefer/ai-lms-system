/**
 * Custom Claims Service
 *
 * Manages Firebase Auth Custom Claims for role-based access control.
 * Custom claims are stored in the JWT token, eliminating the need
 * to fetch user roles from Firestore on every request.
 *
 * Benefits:
 * - Performance: No database lookup on every request
 * - Security: Claims are signed by Firebase, can't be forged
 * - Scalability: Reduces Firestore reads significantly
 *
 * Supported Roles:
 * - admin: Full system access
 * - teacher: Can create courses, view students
 * - student: Standard user access
 * - premium: Paid tier with extra features
 *
 * Usage:
 * - Set claims when user registers or role changes
 * - Check claims in security rules and Cloud Functions
 * - Claims automatically sync to client via token refresh
 */

import * as admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';

// ============================================================
// TYPES
// ============================================================

export interface UserClaims {
  role: 'admin' | 'teacher' | 'student';
  premium?: boolean;
  organizationId?: string;
  permissions?: string[];
  claimsVersion?: number;
}

export interface ClaimsSyncResult {
  userId: string;
  success: boolean;
  claims?: UserClaims;
  error?: string;
}

// Current claims version - increment when schema changes
const CLAIMS_VERSION = 1;

// ============================================================
// CLAIM SETTERS
// ============================================================

/**
 * Set custom claims for a user
 *
 * @param userId - Firebase Auth UID
 * @param claims - Claims to set
 * @returns Success status
 */
export async function setUserClaims(
  userId: string,
  claims: Partial<UserClaims>
): Promise<boolean> {
  try {
    const auth = getAuth();

    // Get existing claims to merge
    const user = await auth.getUser(userId);
    const existingClaims = (user.customClaims || {}) as UserClaims;

    // Merge with new claims
    const newClaims: UserClaims = {
      ...existingClaims,
      ...claims,
      claimsVersion: CLAIMS_VERSION
    };

    // Set claims
    await auth.setCustomUserClaims(userId, newClaims);

    logger.info('Custom claims set', {
      userId,
      claims: newClaims
    });

    // Also update Firestore for backup/UI display
    const db = getFirestore();
    await db.collection('users').doc(userId).set({
      claims: newClaims,
      claimsUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return true;
  } catch (error: any) {
    logger.error('Failed to set custom claims', {
      userId,
      error: error.message
    });
    return false;
  }
}

/**
 * Set user role
 */
export async function setUserRole(
  userId: string,
  role: UserClaims['role']
): Promise<boolean> {
  return setUserClaims(userId, { role });
}

/**
 * Grant premium status
 */
export async function grantPremium(userId: string): Promise<boolean> {
  return setUserClaims(userId, { premium: true });
}

/**
 * Revoke premium status
 */
export async function revokePremium(userId: string): Promise<boolean> {
  return setUserClaims(userId, { premium: false });
}

/**
 * Add specific permissions
 */
export async function addPermissions(
  userId: string,
  permissions: string[]
): Promise<boolean> {
  try {
    const auth = getAuth();
    const user = await auth.getUser(userId);
    const existingClaims = (user.customClaims || {}) as UserClaims;

    const existingPermissions = existingClaims.permissions || [];
    const newPermissions = [...new Set([...existingPermissions, ...permissions])];

    return setUserClaims(userId, { permissions: newPermissions });
  } catch (error: any) {
    logger.error('Failed to add permissions', {
      userId,
      error: error.message
    });
    return false;
  }
}

/**
 * Remove specific permissions
 */
export async function removePermissions(
  userId: string,
  permissions: string[]
): Promise<boolean> {
  try {
    const auth = getAuth();
    const user = await auth.getUser(userId);
    const existingClaims = (user.customClaims || {}) as UserClaims;

    const existingPermissions = existingClaims.permissions || [];
    const newPermissions = existingPermissions.filter(p => !permissions.includes(p));

    return setUserClaims(userId, { permissions: newPermissions });
  } catch (error: any) {
    logger.error('Failed to remove permissions', {
      userId,
      error: error.message
    });
    return false;
  }
}

// ============================================================
// CLAIM GETTERS
// ============================================================

/**
 * Get user claims directly from Auth
 */
export async function getUserClaims(userId: string): Promise<UserClaims | null> {
  try {
    const auth = getAuth();
    const user = await auth.getUser(userId);
    return (user.customClaims as UserClaims) || null;
  } catch (error: any) {
    logger.error('Failed to get user claims', {
      userId,
      error: error.message
    });
    return null;
  }
}

/**
 * Check if user has a specific role
 */
export async function hasRole(
  userId: string,
  role: UserClaims['role']
): Promise<boolean> {
  const claims = await getUserClaims(userId);
  return claims?.role === role;
}

/**
 * Check if user is admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
  return hasRole(userId, 'admin');
}

/**
 * Check if user is teacher
 */
export async function isTeacher(userId: string): Promise<boolean> {
  const claims = await getUserClaims(userId);
  return claims?.role === 'teacher' || claims?.role === 'admin';
}

/**
 * Check if user is premium
 */
export async function isPremium(userId: string): Promise<boolean> {
  const claims = await getUserClaims(userId);
  return claims?.premium === true || claims?.role === 'admin';
}

/**
 * Check if user has specific permission
 */
export async function hasPermission(
  userId: string,
  permission: string
): Promise<boolean> {
  const claims = await getUserClaims(userId);
  if (claims?.role === 'admin') return true; // Admins have all permissions
  return claims?.permissions?.includes(permission) || false;
}

// ============================================================
// SYNC UTILITIES
// ============================================================

/**
 * Sync claims from Firestore user document
 * Useful for migration or when Firestore is source of truth
 */
export async function syncClaimsFromFirestore(userId: string): Promise<ClaimsSyncResult> {
  try {
    const db = getFirestore();
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return {
        userId,
        success: false,
        error: 'User document not found'
      };
    }

    const userData = userDoc.data();
    const role = userData?.role || 'student';
    const premium = userData?.premium || userData?.subscription?.active || false;
    const organizationId = userData?.organizationId;

    const claims: UserClaims = {
      role,
      premium,
      organizationId,
      claimsVersion: CLAIMS_VERSION
    };

    await setUserClaims(userId, claims);

    return {
      userId,
      success: true,
      claims
    };
  } catch (error: any) {
    return {
      userId,
      success: false,
      error: error.message
    };
  }
}

/**
 * Bulk sync claims for multiple users
 * Useful for migration
 */
export async function bulkSyncClaims(userIds: string[]): Promise<ClaimsSyncResult[]> {
  const results: ClaimsSyncResult[] = [];

  // Process in batches of 10 to avoid rate limits
  const batchSize = 10;
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(userId => syncClaimsFromFirestore(userId))
    );
    results.push(...batchResults);

    // Small delay between batches
    if (i + batchSize < userIds.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  logger.info('Bulk sync completed', {
    total: userIds.length,
    succeeded,
    failed
  });

  return results;
}

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize claims for a new user
 * Called during user registration
 */
export async function initializeNewUserClaims(
  userId: string,
  options?: {
    role?: UserClaims['role'];
    organizationId?: string;
  }
): Promise<boolean> {
  const claims: UserClaims = {
    role: options?.role || 'student',
    premium: false,
    organizationId: options?.organizationId,
    claimsVersion: CLAIMS_VERSION
  };

  return setUserClaims(userId, claims);
}

// ============================================================
// MIDDLEWARE HELPER
// ============================================================

/**
 * Extract claims from decoded token in Cloud Functions
 * Use with context.auth in onCall functions
 */
export function extractClaimsFromContext(
  auth: { uid: string; token: admin.auth.DecodedIdToken } | undefined
): UserClaims | null {
  if (!auth?.token) return null;

  const { role, premium, organizationId, permissions, claimsVersion } = auth.token as any;

  if (!role) return null;

  return {
    role,
    premium,
    organizationId,
    permissions,
    claimsVersion
  };
}

/**
 * Require specific role in Cloud Function
 * Throws if user doesn't have required role
 */
export function requireRole(
  auth: { uid: string; token: admin.auth.DecodedIdToken } | undefined,
  requiredRole: UserClaims['role'] | UserClaims['role'][]
): UserClaims {
  const claims = extractClaimsFromContext(auth);

  if (!claims) {
    throw new Error('Authentication required');
  }

  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

  // Admin always passes
  if (claims.role === 'admin') {
    return claims;
  }

  if (!roles.includes(claims.role)) {
    throw new Error(`Required role: ${roles.join(' or ')}`);
  }

  return claims;
}

/**
 * Require premium status in Cloud Function
 * Throws if user is not premium
 */
export function requirePremium(
  auth: { uid: string; token: admin.auth.DecodedIdToken } | undefined
): UserClaims {
  const claims = extractClaimsFromContext(auth);

  if (!claims) {
    throw new Error('Authentication required');
  }

  // Admin always passes
  if (claims.role === 'admin') {
    return claims;
  }

  if (!claims.premium) {
    throw new Error('Premium subscription required');
  }

  return claims;
}
