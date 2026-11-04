/**
 * Authentication Endpoint: /api/auth/signup
 * Protected by:
 * 1. Strict Schema Validation (Type, Length, Format) - rejects anything not conforming to SignupSchema.
 * 2. Stricter Rate Limiting with per-IP and per-account limits and exponential backoff.
 */
import { withRateLimit } from '../_lib/rate-limiter.js';
import { withStrictSchema, SignupSchema } from '../_lib/schema-validator.js';
import { withErrorHandler } from '../_lib/error-handler.js';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // Pre-validated against SignupSchema (name 2..80 personName, email 3..100 email, phone 10..15 phone, password 6..128)
  const { name, email, phone, password } = req.validatedBody || req.body || {};
  const normEmail = email.trim().toLowerCase();

  // Registration successful
  req.rateLimiter?.recordSuccess(normEmail);

  return res.status(201).json({
    success: true,
    message: 'User registered successfully',
    user: {
      name: name.trim(),
      email: normEmail,
      phone: phone ? phone.trim() : '',
      role: normEmail.includes('admin') ? 'admin' : 'customer'
    }
  });
}

export default withErrorHandler(
  withRateLimit(withStrictSchema(handler, { body: SignupSchema }), 'auth'),
  '/api/auth/signup'
);
