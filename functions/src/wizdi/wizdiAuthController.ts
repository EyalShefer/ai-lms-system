/**
 * Wizdi Authentication Controller
 * Handles login, token refresh, and session management for Wizdi integration
 */

import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import * as crypto from "crypto";
import {
  WizdiLoginRequest,
  WizdiLoginResponse,
  WizdiRefreshRequest,
  WizdiUser,
  WizdiSession,
  WizdiErrorCode
} from "./types";

const db = getFirestore();
const auth = getAuth();

// Configuration - in production, store these in Firebase secrets
const WIZDI_API_KEY = process.env.WIZDI_API_KEY || "wizdi_pk_live_xxxxx";
const WIZDI_API_SECRET = process.env.WIZDI_API_SECRET || "wizdi_sk_live_xxxxx";
const TOKEN_EXPIRY_HOURS = 1;

/**
 * Validate Wizdi API credentials
 */
function validateCredentials(apiKey: string, apiSecret: string): boolean {
  // In production, compare against stored credentials
  return apiKey === WIZDI_API_KEY && apiSecret === WIZDI_API_SECRET;
}

/**
 * Generate a secure token
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Create error response
 */
function errorResponse(code: WizdiErrorCode, message: string): WizdiLoginResponse {
  return {
    status: "error",
    code,
    message
  };
}

/**
 * Login endpoint - called by Wizdi to authenticate a user
 * POST /wizdiAuth/login
 */
export const wizdiLogin = onRequest(
  {
    cors: true,
    region: "us-central1"
  },
  async (req, res) => {
    // Only allow POST
    if (req.method !== "POST") {
      res.status(405).json(errorResponse("INVALID_CREDENTIALS", "Method not allowed"));
      return;
    }

    try {
      const body = req.body as WizdiLoginRequest;

      // Validate required fields
      if (!body.apiKey || !body.apiSecret) {
        res.status(400).json(errorResponse("MISSING_PARAMS", "Missing apiKey or apiSecret"));
        return;
      }

      if (!body.uid) {
        res.status(400).json(errorResponse("MISSING_PARAMS", "Missing uid"));
        return;
      }

      if (!body.schoolId || !body.schoolName) {
        res.status(400).json(errorResponse("MISSING_PARAMS", "Missing schoolId or schoolName"));
        return;
      }

      if (!body.classes || body.classes.length === 0) {
        res.status(400).json(errorResponse("MISSING_PARAMS", "Missing classes"));
        return;
      }

      // Validate credentials
      if (!validateCredentials(body.apiKey, body.apiSecret)) {
        logger.warn("Invalid Wizdi credentials attempt", { apiKey: body.apiKey });
        res.status(401).json(errorResponse("INVALID_CREDENTIALS", "Invalid API key or secret"));
        return;
      }

      // Check if Wizdi user already exists in our system
      const wizdiUsersRef = db.collection("wizdi_users");
      const existingUserQuery = await wizdiUsersRef
        .where("wizdiUid", "==", body.uid)
        .limit(1)
        .get();

      let ourUserId: string;
      let wizdiUserDoc: FirebaseFirestore.DocumentReference;

      if (!existingUserQuery.empty) {
        // User exists - update last login
        wizdiUserDoc = existingUserQuery.docs[0].ref;
        ourUserId = existingUserQuery.docs[0].id;

        await wizdiUserDoc.update({
          lastLoginAt: FieldValue.serverTimestamp(),
          // Update potentially changed fields
          displayName: body.displayName || existingUserQuery.docs[0].data().displayName,
          email: body.email || existingUserQuery.docs[0].data().email,
          classes: body.classes,
          groups: body.groups || [],
          isTeacher: body.isTeacher,
          locale: body.locale || "he"
        });

        logger.info("Wizdi user login", { wizdiUid: body.uid, ourUserId });
      } else {
        // Create new user
        const newUserData: Omit<WizdiUser, "id"> = {
          wizdiUid: body.uid,
          isTeacher: body.isTeacher,
          locale: body.locale || "he",
          displayName: body.displayName,
          email: body.email,
          classes: body.classes,
          groups: body.groups || [],
          schoolName: body.schoolName,
          schoolId: body.schoolId,
          createdAt: Timestamp.now(),
          lastLoginAt: Timestamp.now()
        };

        wizdiUserDoc = await wizdiUsersRef.add(newUserData);
        ourUserId = wizdiUserDoc.id;

        // Also create a Firebase Auth user (anonymous or custom)
        try {
          await auth.createUser({
            uid: ourUserId,
            displayName: body.displayName || `Wizdi User ${body.uid}`,
            email: body.email || undefined
          });
        } catch (authError: any) {
          // User might already exist in Auth
          if (authError.code !== "auth/uid-already-exists") {
            logger.warn("Could not create Firebase Auth user", { error: authError.message });
          }
        }

        logger.info("New Wizdi user created", { wizdiUid: body.uid, ourUserId });
      }

      // Create session token
      const token = generateToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + TOKEN_EXPIRY_HOURS);

      // Store session
      const sessionData: Omit<WizdiSession, "id"> = {
        wizdiUserId: body.uid,
        ourUserId,
        token,
        expiresAt: Timestamp.fromDate(expiresAt),
        createdAt: Timestamp.now(),
        isActive: true
      };

      await db.collection("wizdi_sessions").add(sessionData);

      // Create Firebase custom token for client-side auth
      let firebaseToken: string;
      try {
        firebaseToken = await auth.createCustomToken(ourUserId, {
          wizdiUser: true,
          isTeacher: body.isTeacher,
          schoolId: body.schoolId
        });
      } catch (tokenError) {
        logger.error("Failed to create Firebase custom token", tokenError);
        firebaseToken = token; // Fallback to our token
      }

      // Return success response
      const response: WizdiLoginResponse = {
        status: "success",
        token: firebaseToken,
        uid: ourUserId,
        expiresIn: TOKEN_EXPIRY_HOURS * 3600
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error("Wizdi login error", error);
      res.status(500).json(errorResponse("INTERNAL_ERROR", "Internal server error"));
    }
  }
);

/**
 * Token refresh endpoint
 * POST /wizdiAuth/refresh
 */
export const wizdiRefresh = onRequest(
  {
    cors: true,
    region: "us-central1"
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json(errorResponse("INVALID_CREDENTIALS", "Method not allowed"));
      return;
    }

    try {
      const body = req.body as WizdiRefreshRequest;

      // Validate credentials
      if (!validateCredentials(body.apiKey, body.apiSecret)) {
        res.status(401).json(errorResponse("INVALID_CREDENTIALS", "Invalid API key or secret"));
        return;
      }

      if (!body.token) {
        res.status(400).json(errorResponse("MISSING_PARAMS", "Missing token"));
        return;
      }

      // Find the session
      const sessionsRef = db.collection("wizdi_sessions");
      const sessionQuery = await sessionsRef
        .where("token", "==", body.token)
        .where("isActive", "==", true)
        .limit(1)
        .get();

      if (sessionQuery.empty) {
        res.status(401).json(errorResponse("TOKEN_EXPIRED", "Token not found or expired"));
        return;
      }

      const session = sessionQuery.docs[0].data() as WizdiSession;

      // Check expiry
      if (session.expiresAt.toDate() < new Date()) {
        // Deactivate old session
        await sessionQuery.docs[0].ref.update({ isActive: false });
        res.status(401).json(errorResponse("TOKEN_EXPIRED", "Token has expired"));
        return;
      }

      // Generate new token
      const newToken = generateToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + TOKEN_EXPIRY_HOURS);

      // Deactivate old session
      await sessionQuery.docs[0].ref.update({ isActive: false });

      // Create new session
      const newSessionData: Omit<WizdiSession, "id"> = {
        wizdiUserId: session.wizdiUserId,
        ourUserId: session.ourUserId,
        token: newToken,
        expiresAt: Timestamp.fromDate(expiresAt),
        createdAt: Timestamp.now(),
        isActive: true
      };

      await sessionsRef.add(newSessionData);

      // Create new Firebase custom token
      let firebaseToken: string;
      try {
        firebaseToken = await auth.createCustomToken(session.ourUserId);
      } catch (tokenError) {
        firebaseToken = newToken;
      }

      res.status(200).json({
        status: "success",
        token: firebaseToken,
        expiresIn: TOKEN_EXPIRY_HOURS * 3600
      });
    } catch (error) {
      logger.error("Wizdi refresh error", error);
      res.status(500).json(errorResponse("INTERNAL_ERROR", "Internal server error"));
    }
  }
);

/**
 * Validate token middleware helper
 * Used by other Wizdi API endpoints
 */
export async function validateWizdiToken(token: string): Promise<{ valid: boolean; userId?: string; error?: WizdiErrorCode }> {
  try {
    // First try Firebase token validation
    try {
      const decodedToken = await auth.verifyIdToken(token);
      return { valid: true, userId: decodedToken.uid };
    } catch {
      // Not a Firebase token, check our sessions
    }

    // Check our session tokens
    const sessionsRef = db.collection("wizdi_sessions");
    const sessionQuery = await sessionsRef
      .where("token", "==", token)
      .where("isActive", "==", true)
      .limit(1)
      .get();

    if (sessionQuery.empty) {
      return { valid: false, error: "TOKEN_EXPIRED" };
    }

    const session = sessionQuery.docs[0].data() as WizdiSession;

    if (session.expiresAt.toDate() < new Date()) {
      await sessionQuery.docs[0].ref.update({ isActive: false });
      return { valid: false, error: "TOKEN_EXPIRED" };
    }

    return { valid: true, userId: session.ourUserId };
  } catch (error) {
    logger.error("Token validation error", error);
    return { valid: false, error: "INTERNAL_ERROR" };
  }
}

/**
 * Validate API credentials middleware helper
 */
export function validateWizdiApiCredentials(apiKey: string, apiSecret: string): boolean {
  return validateCredentials(apiKey, apiSecret);
}
