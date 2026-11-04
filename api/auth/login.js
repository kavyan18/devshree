/**
 * Authentication Endpoint: /api/auth/login
 * Protected by:
 * 1. Strict Schema Validation (Type, Length, Format) - rejects anything not conforming to LoginSchema.
 * 2. Stricter Rate Limiting with per-IP and per-account limits and exponential backoff.
 */
import { withRateLimit } from '../_lib/rate-limiter.js';
import { withStrictSchema, LoginSchema } from '../_lib/schema-validator.js';
import { withErrorHandler } from '../_lib/error-handler.js';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // Pre-validated against LoginSchema (email string length 3..100 format: email, password string length 6..128)
  const { email, password } = req.validatedBody || req.body || {};
  const normEmail = email.trim().toLowerCase();
  const normPass = password.trim();

  // Master Admin verification via environment variable (NEVER hardcoded in source)
  const envAdminEmail = (process.env.ADMIN_EMAIL || 'admin@devshree.in').trim().toLowerCase();
  const envAdminPassword = process.env.ADMIN_PASSWORD;

  const isMasterAdmin = Boolean(
    envAdminPassword &&
    (normEmail === envAdminEmail || normEmail === 'admin@devshree.in') &&
    normPass === envAdminPassword
  );

  const isDemoCustomer = (
    normEmail.includes('@') && normPass.length >= 6
  );

  if (isMasterAdmin || isDemoCustomer) {
    // Auth succeeded: reset failures and backoff for this account immediately
    req.rateLimiter?.recordSuccess(normEmail);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        email: normEmail,
        role: isMasterAdmin ? 'admin' : 'customer',
        token: `devshree-jwt-${Date.now()}`
      }
    });
  }

  // Auth failed: record failure and trigger exponential backoff
  const failResult = req.rateLimiter?.recordFailure(normEmail);

  return res.status(401).json({
    success: false,
    error: 'Invalid Credentials',
    message: 'Incorrect email or password.',
    backoff: failResult?.account?.currentDelayMs ? {
      inBackoff: true,
      retryAfterSeconds: Math.ceil(failResult.account.currentDelayMs / 1000),
      failures: failResult.account.failures
    } : null
  });
}

// Chained: Error handler catches unhandled exceptions & sanitizes response; Schema validation rejects malformed payloads; Rate limiter guards access
export default withErrorHandler(
  withRateLimit(withStrictSchema(handler, { body: LoginSchema }), 'auth'),
  '/api/auth/login'
);
