/**
 * Script to set CORS configuration on Firebase Storage bucket
 * Run with: node set-cors.js
 *
 * IMPORTANT: You need to be authenticated with Google Cloud first.
 * Run: gcloud auth application-default login
 *
 * Or use a service account key file and set:
 * GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json
 */

import { Storage } from '@google-cloud/storage';

const bucketName = 'ai-lms-pro.firebasestorage.app';

const corsConfiguration = [
  {
    origin: ['http://localhost:5173', 'http://localhost:3000', 'https://ai-lms-pro.web.app', 'https://ai-lms-pro.firebaseapp.com'],
    method: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'],
    maxAgeSeconds: 3600,
    responseHeader: ['Content-Type', 'Access-Control-Allow-Origin']
  }
];

async function setCors() {
  try {
    const storage = new Storage();
    const bucket = storage.bucket(bucketName);

    await bucket.setCorsConfiguration(corsConfiguration);

    console.log(`✅ CORS configuration set successfully for ${bucketName}`);
    console.log('Configuration:', JSON.stringify(corsConfiguration, null, 2));
  } catch (error) {
    console.error('❌ Error setting CORS:', error.message);
    console.log('\nTo fix this, you need to authenticate with Google Cloud:');
    console.log('1. Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install');
    console.log('2. Run: gcloud auth application-default login');
    console.log('3. Run this script again: node set-cors.js');
    console.log('\nOr use gsutil directly:');
    console.log(`gsutil cors set cors.json gs://${bucketName}`);
  }
}

setCors();
