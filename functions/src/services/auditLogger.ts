/**
 * Security Audit Logger
 *
 * SECURITY: Logs all security-sensitive operations for monitoring and forensics.
 * Stores logs in Firestore for persistence and queryability.
 */

import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions/v2';

// Firestore reference
let db: admin.firestore.Firestore | null = null;

function getFirestore(): admin.firestore.Firestore {
  if (!db) {
    db = admin.firestore();
  }
  return db;
}

// Audit event types
export type AuditEventType =
  // Authentication events
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILURE'
  | 'AUTH_LOGOUT'
  | 'AUTH_TOKEN_REFRESH'
  | 'AUTH_TOKEN_INVALID'
  | 'AUTH_SESSION_EXPIRED'

  // Wizdi integration events
  | 'WIZDI_LOGIN_SUCCESS'
  | 'WIZDI_LOGIN_FAILURE'
  | 'WIZDI_API_ACCESS'
  | 'WIZDI_INVALID_CREDENTIALS'

  // Data access events
  | 'DATA_READ'
  | 'DATA_WRITE'
  | 'DATA_DELETE'
  | 'DATA_EXPORT'

  // Admin actions
  | 'ADMIN_USER_CREATED'
  | 'ADMIN_USER_DELETED'
  | 'ADMIN_ROLE_CHANGED'
  | 'ADMIN_CONFIG_CHANGED'

  // Security events
  | 'SECURITY_RATE_LIMIT_EXCEEDED'
  | 'SECURITY_INVALID_INPUT'
  | 'SECURITY_UNAUTHORIZED_ACCESS'
  | 'SECURITY_SUSPICIOUS_ACTIVITY'
  | 'SECURITY_XSS_ATTEMPT'
  | 'SECURITY_INJECTION_ATTEMPT'

  // System events
  | 'SYSTEM_ERROR'
  | 'SYSTEM_STARTUP'
  | 'SYSTEM_SHUTDOWN';

// Severity levels
export type AuditSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

// Audit log entry interface
export interface AuditLogEntry {
  id?: string;
  timestamp: admin.firestore.Timestamp;
  eventType: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  result: 'SUCCESS' | 'FAILURE' | 'BLOCKED';
  details?: Record<string, any>;
  metadata?: {
    functionName?: string;
    requestId?: string;
    traceId?: string;
  };
}

/**
 * Log an audit event
 */
export async function logAuditEvent(
  eventType: AuditEventType,
  options: {
    severity?: AuditSeverity;
    userId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    resource?: string;
    action?: string;
    result?: 'SUCCESS' | 'FAILURE' | 'BLOCKED';
    details?: Record<string, any>;
    metadata?: Record<string, string>;
  } = {}
): Promise<string | null> {
  const severity = options.severity || getSeverityForEvent(eventType);

  const logEntry: AuditLogEntry = {
    timestamp: admin.firestore.Timestamp.now(),
    eventType,
    severity,
    userId: options.userId,
    sessionId: options.sessionId,
    ipAddress: sanitizeIpAddress(options.ipAddress),
    userAgent: sanitizeUserAgent(options.userAgent),
    resource: options.resource,
    action: options.action,
    result: options.result || 'SUCCESS',
    details: sanitizeDetails(options.details),
    metadata: options.metadata,
  };

  // Always log to Cloud Functions logger for immediate visibility
  const logFn = getLoggerFunction(severity);
  logFn(`[AUDIT] ${eventType}`, {
    ...logEntry,
    timestamp: logEntry.timestamp.toDate().toISOString(),
  });

  // Store in Firestore for persistence
  try {
    const firestore = getFirestore();
    const docRef = await firestore.collection('audit_logs').add(logEntry);

    // For critical events, also create an alert
    if (severity === 'CRITICAL') {
      await createSecurityAlert(logEntry);
    }

    return docRef.id;
  } catch (error) {
    logger.error('Failed to write audit log to Firestore', {
      eventType,
      error,
    });
    return null;
  }
}

/**
 * Log authentication success
 */
export async function logAuthSuccess(
  userId: string,
  options: {
    method?: string;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  } = {}
): Promise<void> {
  await logAuditEvent('AUTH_LOGIN_SUCCESS', {
    userId,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    sessionId: options.sessionId,
    result: 'SUCCESS',
    details: {
      method: options.method || 'standard',
    },
  });
}

/**
 * Log authentication failure
 */
export async function logAuthFailure(
  options: {
    attemptedUserId?: string;
    reason: string;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  await logAuditEvent('AUTH_LOGIN_FAILURE', {
    severity: 'WARNING',
    userId: options.attemptedUserId,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    result: 'FAILURE',
    details: {
      reason: options.reason,
    },
  });
}

/**
 * Log Wizdi integration events
 */
export async function logWizdiEvent(
  eventType: 'WIZDI_LOGIN_SUCCESS' | 'WIZDI_LOGIN_FAILURE' | 'WIZDI_API_ACCESS' | 'WIZDI_INVALID_CREDENTIALS',
  options: {
    wizdiUserId?: string;
    schoolId?: string;
    apiKey?: string;
    endpoint?: string;
    ipAddress?: string;
    result?: 'SUCCESS' | 'FAILURE' | 'BLOCKED';
    details?: Record<string, any>;
  } = {}
): Promise<void> {
  await logAuditEvent(eventType, {
    userId: options.wizdiUserId,
    ipAddress: options.ipAddress,
    result: options.result,
    resource: options.endpoint,
    details: {
      schoolId: options.schoolId,
      apiKeyPrefix: options.apiKey ? options.apiKey.substring(0, 10) + '...' : undefined,
      ...options.details,
    },
  });
}

/**
 * Log security events (rate limiting, unauthorized access, etc.)
 */
export async function logSecurityEvent(
  eventType: 'SECURITY_RATE_LIMIT_EXCEEDED' | 'SECURITY_INVALID_INPUT' | 'SECURITY_UNAUTHORIZED_ACCESS' | 'SECURITY_SUSPICIOUS_ACTIVITY' | 'SECURITY_XSS_ATTEMPT' | 'SECURITY_INJECTION_ATTEMPT',
  options: {
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    resource?: string;
    details?: Record<string, any>;
  } = {}
): Promise<void> {
  await logAuditEvent(eventType, {
    severity: eventType.includes('SUSPICIOUS') || eventType.includes('INJECTION') || eventType.includes('XSS')
      ? 'CRITICAL'
      : 'WARNING',
    userId: options.userId,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    resource: options.resource,
    result: 'BLOCKED',
    details: options.details,
  });
}

/**
 * Log data access events
 */
export async function logDataAccess(
  action: 'READ' | 'WRITE' | 'DELETE' | 'EXPORT',
  options: {
    userId: string;
    resource: string;
    resourceId?: string;
    ipAddress?: string;
    details?: Record<string, any>;
  }
): Promise<void> {
  await logAuditEvent(`DATA_${action}` as AuditEventType, {
    severity: action === 'EXPORT' ? 'WARNING' : 'INFO',
    userId: options.userId,
    ipAddress: options.ipAddress,
    resource: options.resource,
    action,
    result: 'SUCCESS',
    details: {
      resourceId: options.resourceId,
      ...options.details,
    },
  });
}

/**
 * Query audit logs (for admin dashboard)
 */
export async function queryAuditLogs(
  filters: {
    userId?: string;
    eventType?: AuditEventType;
    severity?: AuditSeverity;
    startDate?: Date;
    endDate?: Date;
    resource?: string;
    limit?: number;
  } = {}
): Promise<AuditLogEntry[]> {
  const firestore = getFirestore();
  let query: admin.firestore.Query = firestore.collection('audit_logs');

  if (filters.userId) {
    query = query.where('userId', '==', filters.userId);
  }

  if (filters.eventType) {
    query = query.where('eventType', '==', filters.eventType);
  }

  if (filters.severity) {
    query = query.where('severity', '==', filters.severity);
  }

  if (filters.startDate) {
    query = query.where('timestamp', '>=', admin.firestore.Timestamp.fromDate(filters.startDate));
  }

  if (filters.endDate) {
    query = query.where('timestamp', '<=', admin.firestore.Timestamp.fromDate(filters.endDate));
  }

  if (filters.resource) {
    query = query.where('resource', '==', filters.resource);
  }

  query = query.orderBy('timestamp', 'desc').limit(filters.limit || 100);

  const snapshot = await query.get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  } as AuditLogEntry));
}

/**
 * Create security alert for critical events
 */
async function createSecurityAlert(logEntry: AuditLogEntry): Promise<void> {
  const firestore = getFirestore();

  try {
    await firestore.collection('security_alerts').add({
      timestamp: logEntry.timestamp,
      eventType: logEntry.eventType,
      severity: logEntry.severity,
      userId: logEntry.userId,
      ipAddress: logEntry.ipAddress,
      details: logEntry.details,
      status: 'NEW',
      auditLogId: logEntry.id,
    });

    logger.warn('Security alert created', {
      eventType: logEntry.eventType,
      userId: logEntry.userId,
    });
  } catch (error) {
    logger.error('Failed to create security alert', { error });
  }
}

/**
 * Get default severity for event type
 */
function getSeverityForEvent(eventType: AuditEventType): AuditSeverity {
  if (eventType.includes('FAILURE') || eventType.includes('INVALID') || eventType.includes('EXPIRED')) {
    return 'WARNING';
  }

  if (eventType.includes('SECURITY_') && !eventType.includes('RATE_LIMIT')) {
    return 'CRITICAL';
  }

  if (eventType.includes('ADMIN_') || eventType.includes('DELETE') || eventType.includes('EXPORT')) {
    return 'WARNING';
  }

  if (eventType.includes('ERROR')) {
    return 'ERROR';
  }

  return 'INFO';
}

/**
 * Get appropriate logger function based on severity
 */
function getLoggerFunction(severity: AuditSeverity): typeof logger.info {
  switch (severity) {
    case 'CRITICAL':
    case 'ERROR':
      return logger.error;
    case 'WARNING':
      return logger.warn;
    default:
      return logger.info;
  }
}

/**
 * Sanitize IP address for storage (hash or truncate for privacy)
 */
function sanitizeIpAddress(ip?: string): string | undefined {
  if (!ip) return undefined;

  // For IPv4, keep first 3 octets
  if (ip.includes('.') && !ip.includes(':')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
    }
  }

  // For IPv6, keep first 4 groups
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 4) {
      return parts.slice(0, 4).join(':') + ':xxxx:xxxx:xxxx:xxxx';
    }
  }

  return ip;
}

/**
 * Sanitize user agent (truncate for storage)
 */
function sanitizeUserAgent(ua?: string): string | undefined {
  if (!ua) return undefined;
  return ua.length > 200 ? ua.substring(0, 200) + '...' : ua;
}

/**
 * Sanitize details object (remove sensitive data)
 */
function sanitizeDetails(details?: Record<string, any>): Record<string, any> | undefined {
  if (!details) return undefined;

  const sanitized: Record<string, any> = {};
  const sensitiveKeys = ['password', 'secret', 'token', 'apiKey', 'apiSecret', 'creditCard'];

  for (const [key, value] of Object.entries(details)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sk) => lowerKey.includes(sk.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeDetails(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export default {
  logAuditEvent,
  logAuthSuccess,
  logAuthFailure,
  logWizdiEvent,
  logSecurityEvent,
  logDataAccess,
  queryAuditLogs,
};
