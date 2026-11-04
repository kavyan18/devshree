/**
 * Comprehensive Automated Test Suite for Safe Error Handling & Sanitization
 * 
 * Verifies:
 * 1. Sensitive Data Leak Prevention:
 *    - Windows file paths (D:\...) and Unix paths (/var/task/...) are stripped/blocked.
 *    - Stack traces (at Function...) are completely stripped/blocked.
 *    - Raw database names, collections, SQL errors, and Firestore internals are blocked.
 * 2. withErrorHandler Serverless Function Wrapper:
 *    - Returns generic safe 500 responses without exposing any internal state.
 *    - Injects correlation requestId for debugging.
 *    - Handles ValidationError gracefully with HTTP 400.
 *    - Logs full technical details and stack traces to server-side console.error.
 * 3. Client-side error sanitization (sanitizeClientError):
 *    - Translates Firebase/network error codes to friendly customer copy.
 *    - Filters technical leak vectors from toasts and notifications.
 */

import {
  sanitizeErrorMessage,
  generateRequestId,
  withErrorHandler
} from '../lib/error-handler.js';
import { ValidationError } from '../lib/schema-validator.js';
import { sanitizeClientError } from '../assets/js/error-handler.js';

let passed = 0;
let failed = 0;

function assert(condition, description) {
  if (condition) {
    console.log(`  ✓ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${description}`);
    failed++;
  }
}

function assertEqual(actual, expected, description) {
  if (actual === expected) {
    console.log(`  ✓ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${description} (Expected: ${expected}, Got: ${actual})`);
    failed++;
  }
}

// Mock HTTP Response object for serverless functions
function createMockRes() {
  const headers = {};
  return {
    statusCode: 200,
    headers,
    body: null,
    headersSent: false,
    setHeader(key, val) {
      headers[key] = val;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      this.headersSent = true;
      return this;
    }
  };
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 DEVSHREE ERROR HANDLING & SANITIZATION TEST SUITE');
  console.log('======================================================\n');

  // --------------------------------------------------------------------------
  console.log('--- 1. SERVER-SIDE sanitizeErrorMessage() TESTS ---');
  // --------------------------------------------------------------------------

  // Test 1: Normal safe message remains intact
  const safeMsg = 'Invalid email or password.';
  assertEqual(
    sanitizeErrorMessage(safeMsg),
    safeMsg,
    'Preserves normal user-facing error messages'
  );

  // Test 2: Windows file path is blocked and converted to safe generic fallback
  const winPathError = new Error('Cannot find module "D:\\e-commers website\\api\\secret-db.js"');
  const sanitizedWin = sanitizeErrorMessage(winPathError);
  assert(
    !sanitizedWin.includes('D:\\') && !sanitizedWin.includes('secret-db.js'),
    'Blocks Windows file path leaks from error message'
  );
  assertEqual(
    sanitizedWin,
    'An unexpected error occurred while processing your request. Please try again later.',
    'Returns generic fallback on Windows file path leak'
  );

  // Test 3: Unix / Vercel serverless file path is blocked
  const unixPathError = new Error('Failure in /var/task/api/orders.js line 45');
  const sanitizedUnix = sanitizeErrorMessage(unixPathError);
  assert(
    !sanitizedUnix.includes('/var/task') && !sanitizedUnix.includes('orders.js'),
    'Blocks Unix/Vercel serverless file path leaks'
  );
  assertEqual(
    sanitizedUnix,
    'An unexpected error occurred while processing your request. Please try again later.',
    'Returns generic fallback on Unix file path leak'
  );

  // Test 4: Stack trace frame is blocked
  const stackError = new Error('Error: failure\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.run');
  const sanitizedStack = sanitizeErrorMessage(stackError);
  assert(
    !sanitizedStack.includes('at Module._compile') && !sanitizedStack.includes('internal/modules'),
    'Blocks stack trace frames from error message'
  );

  // Test 5: Raw database error (SQL / Postgres / Firestore) is blocked
  const dbError = new Error('Postgres error: relation "users" does not exist; SQLSTATE[42P01]');
  const sanitizedDb = sanitizeErrorMessage(dbError);
  assert(
    !sanitizedDb.includes('Postgres') && !sanitizedDb.includes('SQLSTATE') && !sanitizedDb.includes('users'),
    'Blocks raw SQL/Postgres database error details'
  );

  const firestoreDbError = new Error('Firestore operation failed on collection /artifacts/sensitive_keys: permission-denied');
  const sanitizedFirestore = sanitizeErrorMessage(firestoreDbError);
  assert(
    !sanitizedFirestore.includes('Firestore') && !sanitizedFirestore.includes('/artifacts/sensitive_keys'),
    'Blocks raw Firestore collection error details'
  );

  // Test 6: ValidationError sanitizes embedded paths while preserving constraint
  const validErr = new ValidationError(
    'Validation failed: Field "email" must be a valid email address.',
    [{ field: 'email', message: 'Field "email" must be a valid email address.' }]
  );
  const sanitizedValidation = sanitizeErrorMessage(validErr);
  assert(
    sanitizedValidation.includes('Field "email" must be a valid email address'),
    'Preserves safe validation constraint message'
  );

  // --------------------------------------------------------------------------
  console.log('\n--- 2. withErrorHandler() SERVERLESS WRAPPER TESTS ---');
  // --------------------------------------------------------------------------

  // Intercept console.error to verify server-side debugging logs occur
  const loggedServerErrors = [];
  const origConsoleError = console.error;
  console.error = (...args) => {
    loggedServerErrors.push(args);
  };

  try {
    // Test 7: Successful handler execution passes through without error interference
    const successHandler = async (req, res) => res.status(200).json({ ok: true, data: [1, 2, 3] });
    const wrappedSuccess = withErrorHandler(successHandler, '/api/test/success');
    const req1 = { method: 'GET', url: '/api/test/success', headers: {} };
    const res1 = createMockRes();

    await wrappedSuccess(req1, res1);
    assertEqual(res1.statusCode, 200, 'Successful execution returns HTTP 200');
    assertEqual(res1.body.ok, true, 'Successful execution passes through body');
    assert(Boolean(res1.headers['X-Request-Id']), 'Injects X-Request-Id header in response');

    // Test 8: Uncaught exception in handler is caught, returns HTTP 500, never leaks stack or path
    const crashHandler = async () => {
      throw new Error('FATAL: Database connection died at D:\\e-commers website\\lib\\db.js:143 with code SQLSTATE[08006]');
    };
    const wrappedCrash = withErrorHandler(crashHandler, '/api/test/crash');
    const req2 = { method: 'POST', url: '/api/test/crash', headers: { 'x-forwarded-for': '203.0.113.195' } };
    const res2 = createMockRes();

    await wrappedCrash(req2, res2);

    assertEqual(res2.statusCode, 500, 'Uncaught exception returns HTTP 500 status');
    assertEqual(res2.body.success, false, 'Error response body success is false');
    assertEqual(res2.body.error, 'Internal Server Error', 'Error title is generic Internal Server Error');
    assertEqual(
      res2.body.message,
      'An unexpected error occurred while processing your request. Please try again later.',
      'Message is generic safe user fallback'
    );
    assert(!JSON.stringify(res2.body).includes('D:\\'), 'Response body contains NO Windows file paths');
    assert(!JSON.stringify(res2.body).includes('SQLSTATE'), 'Response body contains NO raw SQL codes');
    assert(!JSON.stringify(res2.body).includes('db.js'), 'Response body contains NO file names');
    assert(!JSON.stringify(res2.body).includes('stack'), 'Response body contains NO stack trace');
    assert(Boolean(res2.body.requestId), 'Response body contains correlation requestId for support');
    assertEqual(res2.headers['X-Request-Id'], res2.body.requestId, 'X-Request-Id header matches body requestId');

    // Test 9: Verify full technical details WERE logged server-side for debugging
    assert(loggedServerErrors.length > 0, 'Server-side console.error was called for debugging');
    const lastLog = loggedServerErrors[loggedServerErrors.length - 1];
    const logDetails = lastLog[1];
    assert(
      logDetails && logDetails.message && logDetails.message.includes('SQLSTATE[08006]'),
      'Full unredacted technical error was logged to server console'
    );
    assert(
      logDetails && logDetails.stack && logDetails.stack.includes('crashHandler'),
      'Full unredacted stack trace was logged to server console'
    );
    assertEqual(logDetails.clientIp, '203.0.113.195', 'Client IP is logged server-side for security audit');

    // Test 10: ValidationError in handler returns HTTP 400 with clean field breakdown
    const validationHandler = async () => {
      throw new ValidationError(
        'Validation failed',
        [
          { field: 'email', constraint: 'format', message: 'Field "email" must be a valid email address.' },
          { field: 'phone', constraint: 'length', message: 'Field "phone" must be 10 to 15 digits.' }
        ]
      );
    };
    const wrappedValidation = withErrorHandler(validationHandler, '/api/test/validation');
    const req3 = { method: 'POST', url: '/api/test/validation', headers: {} };
    const res3 = createMockRes();

    await wrappedValidation(req3, res3);
    assertEqual(res3.statusCode, 400, 'ValidationError returns HTTP 400 Bad Request');
    assertEqual(res3.body.error, 'Bad Request', 'Response error is Bad Request');
    assertEqual(res3.body.details.length, 2, 'Response includes clean field details');
    assertEqual(res3.body.details[0].field, 'email', 'Field name preserved');
    assertEqual(res3.body.details[1].field, 'phone', 'Field name preserved');
    assert(!JSON.stringify(res3.body).includes('stack'), 'Validation error contains NO stack traces');

    // Test 11: generateRequestId produces unique IDs with req- prefix
    const id1 = generateRequestId();
    const id2 = generateRequestId();
    assert(id1.startsWith('req-'), 'RequestId starts with req- prefix');
    assert(id1 !== id2, 'Sequential requestIds are unique');

  } finally {
    console.error = origConsoleError;
  }

  // --------------------------------------------------------------------------
  console.log('\n--- 3. CLIENT-SIDE sanitizeClientError() TESTS ---');
  // --------------------------------------------------------------------------

  // Test 12: Translates Firebase permission-denied code to customer friendly message
  const permDenied = { code: 'permission-denied', message: 'Missing or insufficient permissions.' };
  const safePermMsg = sanitizeClientError(permDenied);
  assertEqual(
    safePermMsg,
    'You do not have permission to perform this action.',
    'Translates permission-denied to friendly message'
  );

  // Test 13: Translates Firebase unavailable / network error
  const netUnavailable = { code: 'unavailable', message: 'The service is currently unavailable.' };
  assertEqual(
    sanitizeClientError(netUnavailable),
    'Our connection to the server was temporarily interrupted. Please check your internet and try again.',
    'Translates network unavailable code to reassuring message'
  );

  // Test 14: Translates Storage quota error
  const quotaErr = { code: 'storage/quota-exceeded', message: 'Quota exceeded for bucket' };
  assertEqual(
    sanitizeClientError(quotaErr),
    'Storage quota exceeded. Please contact store management.',
    'Translates storage/quota-exceeded code'
  );

  // Test 15: Strips file path leaks from raw string error
  const rawPathError = 'Error in C:\\Users\\Administrator\\Desktop\\store\\checkout.js: failed';
  const sanitizedClientPath = sanitizeClientError(rawPathError);
  assert(
    !sanitizedClientPath.includes('C:\\') && !sanitizedClientPath.includes('checkout.js'),
    'Client sanitizer strips Windows paths from toast copy'
  );

  // Test 16: Safe customer text passes through unmodified
  const normalNotice = 'Please enter a valid 10-digit mobile number.';
  assertEqual(
    sanitizeClientError(normalNotice),
    normalNotice,
    'Client sanitizer allows normal customer instructions through'
  );

  // --------------------------------------------------------------------------
  console.log('\n======================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
