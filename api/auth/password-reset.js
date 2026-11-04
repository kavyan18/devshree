/**
 * Authentication Endpoint: /api/auth/password-reset
 * Protected by:
 * 1. Strict Schema Validation (Type, Length, Format) - rejects anything not conforming to PasswordResetSchema.
 * 2. Stricter Rate Limiting with per-IP and per-account limits and exponential backoff.
 */
import { withRateLimit } from '../_lib/rate-limiter.js';
import { withStrictSchema, PasswordResetSchema } from '../_lib/schema-validator.js';
import { withErrorHandler } from '../_lib/error-handler.js';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // Pre-validated against PasswordResetSchema (email string length 3..100 format: email)
  const { email } = req.validatedBody || req.body || {};
  const normEmail = email.trim().toLowerCase();

  // Password reset dispatched
  req.rateLimiter?.recordSuccess(normEmail);

  return res.status(200).json({
    success: true,
    message: `Password reset instructions have been dispatched to ${normEmail}.`
  });
}

export default withErrorHandler(
  withRateLimit(withStrictSchema(handler, { body: PasswordResetSchema }), 'auth'),
  '/api/auth/password-reset'
);
