/**
 * DEVSHREE — CLIENT-SIDE SAFE ERROR HANDLER
 * 
 * Sanitizes all frontend errors before display in toasts, modals, or banners.
 * - Strips internal file paths, stack traces, and database internals.
 * - Logs raw technical details to console.error for developer inspection.
 * - Returns clean, friendly, reassuring messages to end users.
 */

import { showToast } from './utils.js';

// Sensitive patterns that must never be presented in user UI (no /g flag to keep .test() stateless)
const SENSITIVE_PATTERNS = [
  /(?:[A-Za-z]:\\[^\s"']+|\/(?:var|tmp|home|app|usr|opt|etc)\/[^\s"']+)/i, // Windows & Unix paths
  /\.js(?::\d+)?/i, // File extensions / line numbers
  /at\s+[a-zA-Z0-9_$.<>]+\s+\(.*?\)/i, // Stack trace frames
  /(?:firestore|mongodb|postgres|mysql|sqlite|sqlstate|database|collection|deadlock)/i, // DB internals
  /(?:uncaught|unhandled|typeerror|referenceerror|syntaxerror)/i // Raw JS engine errors
];

// Map of common raw technical/Firebase error codes to friendly customer messages
const ERROR_CODE_TRANSLATIONS = {
  // Network & Connectivity
  'unavailable': 'Our connection to the server was temporarily interrupted. Please check your internet and try again.',
  'network-request-failed': 'Unable to connect to the store servers. Please check your network connection.',
  'timeout': 'The request timed out. Please try again in a few moments.',
  
  // Database & Permissions
  'permission-denied': 'You do not have permission to perform this action.',
  'resource-exhausted': 'Server busy: high traffic volume. Please try again in a minute.',
  'failed-precondition': 'Operation could not be completed. Please refresh the page and try again.',
  'not-found': 'The requested record or product could not be located.',
  'already-exists': 'A record with this information already exists.',
  
  // Storage & Uploads
  'storage/unauthorized': 'You are not authorized to upload files to this location.',
  'storage/canceled': 'File upload was cancelled.',
  'storage/quota-exceeded': 'Storage quota exceeded. Please contact store management.',
  'storage/invalid-format': 'The selected image format is invalid. Please upload a JPG, PNG, or WebP.',
  'storage/retry-limit-exceeded': 'Upload took too long. Please try again with a smaller file size.',

  // Generic
  'internal': 'A temporary internal system error occurred. Our team has been notified.',
  'cancelled': 'The operation was cancelled.'
};

/**
 * Sanitize any error object or string into a safe, user-friendly message.
 * Logs the full raw error to console.error for developer debugging.
 * 
 * @param {*} error - The error caught
 * @param {string} [fallback='An unexpected error occurred. Please try again.']
 * @returns {string} Safe user-facing message
 */
export function sanitizeClientError(error, fallback = 'An unexpected error occurred. Please try again.') {
  // Always log raw error details to console for developer debugging
  if (typeof console !== 'undefined' && console.error) {
    console.error('[DEVSHREE CLIENT ERROR TRACE]', error);
  }

  if (!error) return fallback;

  // 1. Check for specific known error codes (Firebase, API errors)
  const code = (error.code || error.error || '').toLowerCase();
  if (code && ERROR_CODE_TRANSLATIONS[code]) {
    return ERROR_CODE_TRANSLATIONS[code];
  }

  let message = typeof error === 'string' ? error : (error.message || String(error));

  // 2. Test if message contains internal paths, stack traces, or DB internals
  let hasSensitiveLeak = false;
  for (const pat of SENSITIVE_PATTERNS) {
    if (pat.test(message)) {
      hasSensitiveLeak = true;
      break;
    }
  }

  if (hasSensitiveLeak) {
    // If it mentions image or upload, provide a helpful upload fallback
    if (/image|upload|file|storage/i.test(message)) {
      return 'Unable to upload file. Please verify the image format (JPG/PNG under 5MB) and try again.';
    }
    // If it mentions save/database/product, provide a helpful save fallback
    if (/save|product|order|catalog|firestore|sync/i.test(message)) {
      return 'Unable to save changes right now. Please try again in a moment.';
    }
    return fallback;
  }

  // 3. Reject excessively long messages (often unformatted error dumps)
  if (message.length > 200) {
    return fallback;
  }

  return message;
}

/**
 * Display a safe, sanitized error toast to the user
 * @param {*} error
 * @param {string} [fallback]
 * @param {number} [duration=3500]
 */
export function showSafeErrorToast(error, fallback, duration = 3500) {
  const safeMessage = sanitizeClientError(error, fallback);
  showToast(safeMessage, 'error', duration);
  return safeMessage;
}

// Auto-register global unhandled error interceptors in browser environments
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (typeof console !== 'undefined' && console.error) {
      console.error('[DEVSHREE UNHANDLED REJECTION]', event.reason);
    }
  });

  window.addEventListener('error', (event) => {
    if (typeof console !== 'undefined' && console.error) {
      console.error('[DEVSHREE UNCAUGHT WINDOW ERROR]', event.error || event.message);
    }
  });
}
