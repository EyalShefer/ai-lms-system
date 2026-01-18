/**
 * Cloud Run Entry Point for Streaming Server
 *
 * This module exports the streaming server as a Cloud Run service
 * using Firebase Functions 2nd gen (which supports Cloud Run)
 */

import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import app from './streamingServer';

// Secrets
const geminiApiKey = defineSecret('GEMINI_API_KEY');

/**
 * Streaming Server Cloud Run Service
 *
 * Configuration:
 * - Memory: 1GB (for handling multiple concurrent streams)
 * - Timeout: 540 seconds (max for Cloud Functions 2nd gen)
 * - Min instances: 0 (scale to zero when not in use)
 * - Max instances: 10 (limit concurrent load)
 * - Concurrency: 80 (handle multiple requests per instance)
 */
export const streamingServer = onRequest(
  {
    secrets: [geminiApiKey],
    memory: '1GiB',
    timeoutSeconds: 540,
    minInstances: 0,
    maxInstances: 10,
    concurrency: 80,
    cors: true,
    region: 'us-central1'
  },
  app
);
