import { withErrorHandler } from './_lib/error-handler.js';

/**
 * Public Runtime Configuration Endpoint: /api/config
 * Returns non-sensitive public configuration injected from environment variables.
 * Sensitive secrets (like ADMIN_PASSWORD, RAZORPAY_KEY_SECRET, GITHUB_TOKEN) are NEVER returned!
 */
async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // Set cache headers (5 minutes cache)
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

  return res.status(200).json({
    success: true,
    firebase: {
      apiKey: process.env.FIREBASE_API_KEY || '',
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'devshree-2dfae.firebaseapp.com',
      projectId: process.env.FIREBASE_PROJECT_ID || 'devshree-2dfae',
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'devshree-2dfae.firebasestorage.app',
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '140419631249',
      appId: process.env.FIREBASE_APP_ID || '',
      measurementId: process.env.FIREBASE_MEASUREMENT_ID || ''
    },
    razorpay: {
      keyId: process.env.RAZORPAY_KEY_ID || ''
    },
    store: {
      ownerPhone: process.env.STORE_OWNER_PHONE || '918866130409'
    }
  });
}

export default withErrorHandler(handler, '/api/config');

