/**
 * GCP Budget Alerts Handler
 *
 * Handles budget alert notifications from Pub/Sub and takes
 * appropriate actions based on spending thresholds.
 *
 * Actions at different thresholds:
 * - 50%: Log warning
 * - 80%: Send Slack/email notification
 * - 100%: Reduce service limits, alert admins
 * - 120%: Emergency mode - disable non-critical services
 *
 * Setup:
 * 1. Create budget in Cloud Console
 * 2. Link to Pub/Sub topic: budget-alerts
 * 3. Deploy this function
 */

import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions/v2';

// ============================================================
// TYPES
// ============================================================

interface BudgetNotification {
  budgetDisplayName: string;
  alertThresholdExceeded: number; // e.g., 0.5, 0.8, 1.0
  costAmount: number;
  costIntervalStart: string;
  budgetAmount: number;
  budgetAmountType: string;
  currencyCode: string;
}

interface ParsedMessage {
  data: BudgetNotification;
}

// ============================================================
// CONFIGURATION
// ============================================================

// Admin emails to notify
const ADMIN_EMAILS = [
  'admin@yourdomain.com',
  // Add more as needed
];

// Slack webhook URL (optional)
const SLACK_WEBHOOK_URL = process.env.SLACK_BUDGET_WEBHOOK || '';

// ============================================================
// ALERT HANDLERS
// ============================================================

/**
 * Handle 50% threshold - Warning level
 */
async function handleWarningThreshold(notification: BudgetNotification): Promise<void> {
  logger.warn('⚠️ Budget at 50%', {
    budget: notification.budgetDisplayName,
    spent: notification.costAmount,
    total: notification.budgetAmount,
  });

  // Log to Firestore for dashboard
  await logBudgetEvent(notification, 'warning');
}

/**
 * Handle 80% threshold - Alert level
 */
async function handleAlertThreshold(notification: BudgetNotification): Promise<void> {
  logger.warn('🔶 Budget at 80%', {
    budget: notification.budgetDisplayName,
    spent: notification.costAmount,
    total: notification.budgetAmount,
  });

  // Send notifications
  await Promise.all([
    logBudgetEvent(notification, 'alert'),
    sendSlackNotification(notification, 'alert'),
    sendEmailNotification(notification, 'alert'),
  ]);
}

/**
 * Handle 100% threshold - Critical level
 */
async function handleCriticalThreshold(notification: BudgetNotification): Promise<void> {
  logger.error('🔴 Budget exceeded 100%!', {
    budget: notification.budgetDisplayName,
    spent: notification.costAmount,
    total: notification.budgetAmount,
  });

  // Take action
  await Promise.all([
    logBudgetEvent(notification, 'critical'),
    sendSlackNotification(notification, 'critical'),
    sendEmailNotification(notification, 'critical'),
    reduceServiceLimits(),
  ]);
}

/**
 * Handle 120% threshold - Emergency level
 */
async function handleEmergencyThreshold(notification: BudgetNotification): Promise<void> {
  logger.error('🚨 EMERGENCY: Budget exceeded 120%!', {
    budget: notification.budgetDisplayName,
    spent: notification.costAmount,
    total: notification.budgetAmount,
  });

  // Emergency actions
  await Promise.all([
    logBudgetEvent(notification, 'emergency'),
    sendSlackNotification(notification, 'emergency'),
    sendEmailNotification(notification, 'emergency'),
    enableEmergencyMode(),
  ]);
}

// ============================================================
// ACTIONS
// ============================================================

/**
 * Log budget event to Firestore
 */
async function logBudgetEvent(
  notification: BudgetNotification,
  level: 'warning' | 'alert' | 'critical' | 'emergency'
): Promise<void> {
  try {
    const db = admin.firestore();
    await db.collection('system_events').add({
      type: 'budget_alert',
      level,
      budget: notification.budgetDisplayName,
      threshold: notification.alertThresholdExceeded,
      spent: notification.costAmount,
      total: notification.budgetAmount,
      currency: notification.currencyCode,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    logger.error('Failed to log budget event', error);
  }
}

/**
 * Send Slack notification
 */
async function sendSlackNotification(
  notification: BudgetNotification,
  level: string
): Promise<void> {
  if (!SLACK_WEBHOOK_URL) return;

  const emoji = {
    warning: '⚠️',
    alert: '🔶',
    critical: '🔴',
    emergency: '🚨',
  }[level] || '📊';

  const color = {
    warning: '#FFA500',
    alert: '#FF6600',
    critical: '#FF0000',
    emergency: '#8B0000',
  }[level] || '#808080';

  const percentage = Math.round(notification.alertThresholdExceeded * 100);

  try {
    await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachments: [{
          color,
          title: `${emoji} Budget Alert: ${level.toUpperCase()}`,
          fields: [
            { title: 'Budget', value: notification.budgetDisplayName, short: true },
            { title: 'Threshold', value: `${percentage}%`, short: true },
            { title: 'Spent', value: `${notification.costAmount} ${notification.currencyCode}`, short: true },
            { title: 'Budget', value: `${notification.budgetAmount} ${notification.currencyCode}`, short: true },
          ],
          footer: 'GCP Budget Monitor',
          ts: Math.floor(Date.now() / 1000),
        }],
      }),
    });
    logger.info('Slack notification sent');
  } catch (error) {
    logger.error('Failed to send Slack notification', error);
  }
}

/**
 * Send email notification to admins
 */
async function sendEmailNotification(
  notification: BudgetNotification,
  level: string
): Promise<void> {
  // This would integrate with your email service (SendGrid, etc.)
  // For now, we just log
  logger.info('Email notification would be sent', {
    to: ADMIN_EMAILS,
    level,
    budget: notification.budgetDisplayName,
  });

  // TODO: Integrate with email service
  // Example with SendGrid:
  // await sendgrid.send({
  //   to: ADMIN_EMAILS,
  //   subject: `[${level.toUpperCase()}] GCP Budget Alert`,
  //   text: `Budget ${notification.budgetDisplayName} is at ${notification.alertThresholdExceeded * 100}%`,
  // });
}

/**
 * Reduce service limits when budget is critical
 */
async function reduceServiceLimits(): Promise<void> {
  logger.warn('Reducing service limits due to budget constraints');

  const db = admin.firestore();

  // Update system config to reduce limits
  await db.collection('system_config').doc('limits').set({
    aiGenerationEnabled: true, // Still enabled but reduced
    maxGenerationsPerUser: 5, // Reduced from 10
    maxConcurrentGenerations: 2, // Reduced from 5
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    reason: 'budget_critical',
  }, { merge: true });
}

/**
 * Enable emergency mode - disable non-critical services
 */
async function enableEmergencyMode(): Promise<void> {
  logger.error('ENABLING EMERGENCY MODE');

  const db = admin.firestore();

  // Set emergency mode flag
  await db.collection('system_config').doc('emergency').set({
    enabled: true,
    enabledAt: admin.firestore.FieldValue.serverTimestamp(),
    reason: 'budget_exceeded_120_percent',
    actions: [
      'Disabled new AI generations',
      'Disabled podcast generation',
      'Reduced rate limits',
    ],
  });

  // Disable expensive features
  await db.collection('system_config').doc('features').set({
    aiGenerationEnabled: false,
    podcastGenerationEnabled: false,
    imageGenerationEnabled: false,
    streamingEnabled: true, // Keep basic streaming
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

// ============================================================
// MAIN HANDLER
// ============================================================

/**
 * Process budget alert from Pub/Sub
 */
export async function processBudgetAlert(message: ParsedMessage): Promise<void> {
  const notification = message.data;

  logger.info('Received budget notification', {
    budget: notification.budgetDisplayName,
    threshold: notification.alertThresholdExceeded,
    spent: notification.costAmount,
  });

  const threshold = notification.alertThresholdExceeded;

  if (threshold >= 1.2) {
    await handleEmergencyThreshold(notification);
  } else if (threshold >= 1.0) {
    await handleCriticalThreshold(notification);
  } else if (threshold >= 0.8) {
    await handleAlertThreshold(notification);
  } else if (threshold >= 0.5) {
    await handleWarningThreshold(notification);
  }
}

/**
 * Get current budget status
 */
export async function getBudgetStatus(): Promise<{
  isEmergencyMode: boolean;
  limits: any;
}> {
  const db = admin.firestore();

  const [emergency, limits] = await Promise.all([
    db.collection('system_config').doc('emergency').get(),
    db.collection('system_config').doc('limits').get(),
  ]);

  return {
    isEmergencyMode: emergency.data()?.enabled || false,
    limits: limits.data() || {},
  };
}

/**
 * Disable emergency mode (manual reset)
 */
export async function disableEmergencyMode(): Promise<void> {
  const db = admin.firestore();

  await Promise.all([
    db.collection('system_config').doc('emergency').set({
      enabled: false,
      disabledAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true }),

    db.collection('system_config').doc('features').set({
      aiGenerationEnabled: true,
      podcastGenerationEnabled: true,
      imageGenerationEnabled: true,
      streamingEnabled: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true }),

    db.collection('system_config').doc('limits').delete(),
  ]);

  logger.info('Emergency mode disabled');
}
