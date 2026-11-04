/**
 * DEVSHREE — PRODUCTION SERVER ERROR HANDLER & SANITIZER
 * 
 * Guarantees that:
 * 1. Users NEVER see stack traces, internal server file paths, or raw database/SQL/Firestore errors.
 * 2. All unexpected errors return safe, generic HTTP responses.
 * 3. Full technical details, stack traces, and request context are logged server-side for debugging.
 */

import { ValidationError } from './schema-validator.js';

// Sensitive patterns that must NEVER leak to clients (no /g flag to keep .test() stateless and idempotent)
const SENSITIVE_PATTERNS = [
  // File paths (Windows D:\... or Unix /var/task/... or node_modules)
  /(?:[A-Za-z]:\\[^"'\n\r]+|\/(?:var|tmp|home|app|usr|etc|opt)\/[^"'\n\r]+)/i,
  // Node stack trace traces
  /^\s*at\s+.*$/m,
  // Raw database names / error codes
  /(?:firestore|mongodb|postgres|mysql|sqlite|sqlstate|deadlock|syntax error at or near|collection|table|column)/i,
  // Firebase internal codes
  /(?:auth\/[a-z-]+|firestore\/[a-z-]+|storage\/[a-z-]+)/i
];

/**
 * Sanitize any technical error string or error object into a safe, generic message.
 * @param {*} error
 * @param {string} [fallback]
 * @returns {string}
 */
export function sanitizeErrorMessage(error, fallback = 'An unexpected error occurred while processing your request. Please try again later.') {
  if (!error) return fallback;

  let message = typeof error === 'string' ? error : (error.message || String(error));

  // If this is an explicit, safe ValidationError, sanitize any embedded paths but keep constraint message
  if (error instanceof ValidationError || error.name === 'ValidationError') {
    let clean = message;
    for (const pat of SENSITIVE_PATTERNS) {
      clean = clean.replace(pat, '');
    }
    return clean.trim() || 'Input validation failed. Please review your submission.';
  }

  // Check if error contains sensitive technical details (paths, stack, DB errors)
  for (const pat of SENSITIVE_PATTERNS) {
    if (pat.test(message)) {
      return fallback;
    }
  }

  // Clean length boundaries
  if (message.length > 250) {
    return fallback;
  }

  return message;
}

/**
 * Generate a unique correlation request ID for server debugging
 */
export function generateRequestId() {
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Wraps any Vercel Serverless Function or Express handler with comprehensive error handling:
 * - Logs full stack traces and error objects to server console.
 * - Prevents leaking stack traces, file paths, or database errors to the HTTP response.
 * - Injects correlation requestId for error tracking.
 * 
 * @param {Function} handler
 * @param {string} [endpointName='endpoint']
 */
export function withErrorHandler(handler, endpointName = 'api') {
  return async (req, res) => {
    const requestId = generateRequestId();
    res.setHeader('X-Request-Id', requestId);

    try {
      return await handler(req, res);
    } catch (err) {
      // 1. FULL SERVER-SIDE LOGGING (Never visible to client)
      const clientIp = req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
      console.error(`[SERVER ERROR] [${req.method || 'GET'}] ${endpointName} - RequestId: ${requestId}`, {
        name: err?.name || 'Error',
        message: err?.message,
        stack: err?.stack || 'No stack trace available',
        clientIp,
        url: req.url,
        timestamp: new Date().toISOString()
      });

      // 2. Client response: Ensure headers are not already sent
      if (res.headersSent) {
        return;
      }

      // Check if it's a known ValidationError (HTTP 400)
      if (err instanceof ValidationError || err?.name === 'ValidationError' || err?.statusCode === 400) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: sanitizeErrorMessage(err, 'Input validation failed.'),
          details: err.errors ? err.errors.map(e => ({
            field: e.field,
            constraint: e.constraint,
            message: sanitizeErrorMessage(e.message, 'Invalid field value.')
          })) : undefined,
          requestId
        });
      }

      // Default safe response: NEVER leak stack trace or internal details
      const statusCode = (typeof err?.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600)
        ? err.statusCode
        : 500;

      return res.status(statusCode).json({
        success: false,
        error: statusCode === 404 ? 'Not Found' : (statusCode === 403 ? 'Forbidden' : 'Internal Server Error'),
        message: statusCode >= 500
          ? 'An unexpected error occurred while processing your request. Please try again later.'
          : sanitizeErrorMessage(err),
        requestId
      });
    }
  };
}
