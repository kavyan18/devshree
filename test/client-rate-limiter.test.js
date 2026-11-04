/**
 * Client-Side Rate Limiter Test Suite
 * Tests assets/js/rate-limiter.js in a simulated DOM/browser environment
 */
import {
  checkAuthAttempt,
  recordAuthFailure,
  recordAuthSuccess,
  getBackoffRemainingSeconds,
  checkPublicAttempt,
  checkUserAction,
  getActiveRateLimitConfig
} from '../assets/js/rate-limiter.js';

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

console.log('====================================================');
console.log('CLIENT-SIDE RATE LIMITER & EXPONENTIAL BACKOFF TESTS');
console.log('====================================================\n');

// TEST 1: Config
console.log('TEST 1: Client Defaults & Overrides');
const cfg = getActiveRateLimitConfig();
assertEqual(cfg.auth.perAccount.maxAttempts, 5, 'Client default max attempts is 5');
assertEqual(cfg.auth.perAccount.backoff.baseDelayMs, 2000, 'Client default base delay is 2000ms');
assertEqual(cfg.public.maxRequests, 60, 'Client public default is 60 req/min');
assertEqual(cfg.authenticated.maxRequests, 240, 'Client authenticated default is 240 req/min');
console.log('');

// TEST 2: Client Auth Backoff (No permanent lockout)
console.log('TEST 2: Client Auth Backoff & Success Reset');
const email = 'shop_customer@devshree.in';
let t = 10000000;

// 5 initial attempts allowed
for (let i = 1; i <= 5; i++) {
  const chk = checkAuthAttempt(email, t);
  assert(chk.allowed, `Client attempt ${i} is permitted`);
  recordAuthFailure(email, t);
}

// 6th failure triggers exponential backoff (2000ms)
const fail6 = recordAuthFailure(email, t);
assert(fail6.inBackoff, 'Excess failure triggers exponential backoff on client');
assertEqual(fail6.retryAfterSeconds, 2, 'First excess delay is 2 seconds');

// Immediate check blocked
const blocked = checkAuthAttempt(email, t + 500);
assert(!blocked.allowed, 'Immediate attempt while in backoff is blocked');
assertEqual(blocked.retryAfterSeconds, 2, 'Blocked with 2s remaining');

// 2100ms later: unlocked! (No hard lockout)
const unlocked = checkAuthAttempt(email, t + 2100);
assert(unlocked.allowed, 'Client is allowed to attempt again once backoff delay expires (no permanent lockout)');

// Success resets
recordAuthSuccess(email);
const afterSuccess = checkAuthAttempt(email, t + 2200);
assert(afterSuccess.allowed, 'recordAuthSuccess() clears all backoff and failures');
assertEqual(getBackoffRemainingSeconds(email), 0, 'Remaining backoff is 0');
console.log('');

// TEST 3: Client Public and Authenticated Action Limits
console.log('TEST 3: Client Public & User Action Limits');
const pubRoute = 'catalog_browse';
let pTime = 5000000;
let pubBlocked = false;

// Attempt 60 public calls
for (let i = 1; i <= 60; i++) {
  const p = checkPublicAttempt(pubRoute, pTime + i * 10);
  if (!p.allowed) pubBlocked = true;
}
assert(!pubBlocked, 'First 60 public requests pass');

// 61st public call is blocked
const p61 = checkPublicAttempt(pubRoute, pTime + 650);
assert(!p61.allowed, '61st public request blocked under 60 req/min limit');

// Authenticated user actions allow much higher volume (240)
const userId = 'usr-client-442';
let userBlocked = false;
for (let i = 1; i <= 240; i++) {
  const u = checkUserAction(userId, 'cart_update', pTime + i * 10);
  if (!u.allowed) userBlocked = true;
}
assert(!userBlocked, '240 authenticated user actions permitted under loose limit');

const u241 = checkUserAction(userId, 'cart_update', pTime + 2500);
assert(!u241.allowed, '241st action is blocked under authenticated limit');
console.log('');

console.log('====================================================');
console.log(`CLIENT TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('====================================================');

if (failed > 0) process.exit(1);

