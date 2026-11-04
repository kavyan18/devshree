/**
 * Comprehensive Automated Test Suite for Rate Limiting & Exponential Backoff
 * Tests:
 * 1. Auth routes: Strictest limits, combined per-IP and per-account, exponential backoff (no hard lockout).
 * 2. Public endpoints: Moderate sliding window (default 60 req/min).
 * 3. Authenticated routes: Looser sliding window (default 240 req/min).
 * 4. Configurability: Overriding thresholds via options and environment variables.
 * 5. Success reset: Clearing backoff on valid credentials.
 * 6. Headers & HTTP wrappers (429 Too Many Requests, Retry-After, X-RateLimit-*).
 */

import {
  RateLimiter,
  MemoryStore,
  buildRateLimitConfig,
  DEFAULT_RATE_LIMIT_CONFIG,
  rateLimitMiddleware,
  withRateLimit
} from '../lib/rate-limiter.js';

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

async function runTests() {
  console.log('====================================================');
  console.log('DEVSHREE RATE LIMITING & EXPONENTIAL BACKOFF TEST SUITE');
  console.log('====================================================\n');

  // TEST 1: Configurability & Defaults
  console.log('TEST SUITE 1: Configuration Flexibility & Defaults');
  {
    const defaultConfig = buildRateLimitConfig();
    assertEqual(defaultConfig.auth.perAccount.maxAttempts, 5, 'Default auth per-account max attempts is 5');
    assertEqual(defaultConfig.auth.perAccount.backoff.baseDelayMs, 2000, 'Default auth base backoff delay is 2000ms');
    assertEqual(defaultConfig.auth.perAccount.backoff.multiplier, 2, 'Default auth backoff multiplier is 2');
    assertEqual(defaultConfig.public.maxRequests, 60, 'Default public endpoint max requests is 60 req/min');
    assertEqual(defaultConfig.authenticated.maxRequests, 240, 'Default authed endpoint max requests is 240 req/min');

    // Custom configuration via options
    const customConfig = buildRateLimitConfig({
      auth: {
        perAccount: { maxAttempts: 3, backoff: { baseDelayMs: 3000, multiplier: 3, maxDelayMs: 60000 } }
      },
      public: { maxRequests: 30 },
      authenticated: { maxRequests: 500 }
    });
    assertEqual(customConfig.auth.perAccount.maxAttempts, 3, 'Custom auth max attempts correctly overridden to 3');
    assertEqual(customConfig.auth.perAccount.backoff.baseDelayMs, 3000, 'Custom auth base delay correctly overridden to 3000ms');
    assertEqual(customConfig.auth.perAccount.backoff.multiplier, 3, 'Custom multiplier correctly overridden to 3');
    assertEqual(customConfig.public.maxRequests, 30, 'Custom public limit correctly overridden to 30');
    assertEqual(customConfig.authenticated.maxRequests, 500, 'Custom authed limit correctly overridden to 500');

    // Environment variable overrides
    process.env.RATE_LIMIT_PUBLIC_MAX_REQUESTS = '100';
    process.env.RATE_LIMIT_AUTH_ACCOUNT_MAX_ATTEMPTS = '2';
    const envConfig = buildRateLimitConfig();
    assertEqual(envConfig.public.maxRequests, 100, 'Env variable RATE_LIMIT_PUBLIC_MAX_REQUESTS overrides limit');
    assertEqual(envConfig.auth.perAccount.maxAttempts, 2, 'Env variable RATE_LIMIT_AUTH_ACCOUNT_MAX_ATTEMPTS overrides limit');
    delete process.env.RATE_LIMIT_PUBLIC_MAX_REQUESTS;
    delete process.env.RATE_LIMIT_AUTH_ACCOUNT_MAX_ATTEMPTS;
  }
  console.log('');

  // TEST 2: Authentication Routes - Per-Account Exponential Backoff (No Hard Lockout)
  console.log('TEST SUITE 2: Auth Routes — Exponential Backoff & No Permanent Lockout');
  {
    const store = new MemoryStore();
    const limiter = new RateLimiter({
      auth: {
        perAccount: {
          maxAttempts: 3, // Baseline: 3 allowed attempts
          backoff: { baseDelayMs: 2000, multiplier: 2, maxDelayMs: 30000 },
          windowMs: 60000
        },
        perIp: { maxAttempts: 50 } // High IP limit so we isolate per-account backoff
      }
    }, store);

    const testEmail = 'customer@example.com';
    const clientIp = '192.168.1.100';
    let baseTime = 1000000;

    // First 3 attempts should be allowed
    for (let i = 1; i <= 3; i++) {
      const check = limiter.checkAuthRoute(testEmail, clientIp, baseTime);
      assert(check.allowed, `Attempt ${i} is allowed within baseline limit`);
      limiter.recordAuthFailure(testEmail, clientIp, baseTime);
    }

    // Attempt 4 triggers initial exponential backoff: 2000ms * (2^0) = 2000ms
    const checkAfter3Failures = limiter.checkAuthRoute(testEmail, clientIp, baseTime);
    assert(checkAfter3Failures.allowed, `Attempt 4 check permitted to attempt, but next failure will calculate backoff`);
    limiter.recordAuthFailure(testEmail, clientIp, baseTime); // 4th failure -> excess = 1 -> delay = 2000ms

    // Immediate attempt after 4th failure: should be BLOCKED with 2s backoff
    const immediateBlocked = limiter.checkAuthRoute(testEmail, clientIp, baseTime + 500);
    assert(!immediateBlocked.allowed, 'Immediate retry is blocked by exponential backoff');
    assertEqual(immediateBlocked.retryAfterSeconds, 2, 'Retry-After is 2 seconds (2000ms)');

    // After 2000ms backoff passes (at +2100ms): NO hard lockout! Request is allowed again
    const backoffPassed = limiter.checkAuthRoute(testEmail, clientIp, baseTime + 2100);
    assert(backoffPassed.allowed, 'After backoff expires, user CAN attempt again (NO permanent hard lockout)');

    // 5th failure -> excess = 2 -> delay = 2000 * 2^1 = 4000ms
    baseTime += 2100;
    limiter.recordAuthFailure(testEmail, clientIp, baseTime);
    const blocked4s = limiter.checkAuthRoute(testEmail, clientIp, baseTime + 1000);
    assert(!blocked4s.allowed, 'Blocked after 5th failure with doubled delay');
    assertEqual(blocked4s.retryAfterSeconds, 3, 'Remaining backoff is 3s (from 4s total delay)');

    // 6th failure -> excess = 3 -> delay = 2000 * 2^2 = 8000ms
    baseTime += 4100;
    limiter.recordAuthFailure(testEmail, clientIp, baseTime);
    const blocked8s = limiter.checkAuthRoute(testEmail, clientIp, baseTime + 100);
    assert(!blocked8s.allowed, 'Blocked after 6th failure with exponential 8s delay');
    assertEqual(blocked8s.retryAfterSeconds, 8, 'Retry-After is 8s');

    // Test recordAuthSuccess resets failures immediately
    limiter.recordAuthSuccess(testEmail, clientIp);
    const immediateAfterSuccess = limiter.checkAuthRoute(testEmail, clientIp, baseTime + 200);
    assert(immediateAfterSuccess.allowed, 'recordAuthSuccess() immediately clears backoff and failure counts');
  }
  console.log('');

  // TEST 3: Auth Routes - Per-IP Spraying Defense
  console.log('TEST SUITE 3: Auth Routes — Per-IP Protection Across Multiple Accounts');
  {
    const store = new MemoryStore();
    const limiter = new RateLimiter({
      auth: {
        perAccount: { maxAttempts: 5 },
        perIp: {
          maxAttempts: 4, // 4 failed attempts from same IP across ANY accounts
          backoff: { baseDelayMs: 1500, multiplier: 2, maxDelayMs: 30000 },
          windowMs: 60000
        }
      }
    }, store);

    const attackerIp = '203.0.113.42';
    const baseTime = 2000000;

    // Attacker sprays 4 different accounts from same IP
    for (let i = 1; i <= 4; i++) {
      const acct = `target_user_${i}@example.com`;
      const check = limiter.checkAuthRoute(acct, attackerIp, baseTime);
      assert(check.allowed, `Spray attempt ${i} on account ${acct} allowed`);
      limiter.recordAuthFailure(acct, attackerIp, baseTime);
    }

    // 5th failure from same IP -> IP backoff kicks in
    limiter.recordAuthFailure('target_user_5@example.com', attackerIp, baseTime);

    // Try a completely brand new 6th account from this IP: blocked due to IP backoff!
    const sprayBlocked = limiter.checkAuthRoute('completely_fresh_user@example.com', attackerIp, baseTime + 100);
    assert(!sprayBlocked.allowed, 'Brand new account from spraying IP is blocked by Per-IP backoff');
    assertEqual(sprayBlocked.target, 'ip', 'Blocked target is IP');
  }
  console.log('');

  // TEST 4: Public Endpoints (Moderate Sliding Window)
  console.log('TEST SUITE 4: Public Endpoints — Moderate Sliding Window (60 req/min)');
  {
    const store = new MemoryStore();
    const limiter = new RateLimiter({
      public: { maxRequests: 5, windowMs: 10000 } // 5 req per 10s for testing
    }, store);

    const testIp = '198.51.100.1';
    let baseTime = 3000000;

    // First 5 requests must pass
    for (let i = 1; i <= 5; i++) {
      const res = limiter.checkPublicRoute(testIp, baseTime + i * 100);
      assert(res.allowed, `Public request #${i} is allowed`);
      assertEqual(res.remaining, 5 - i, `Remaining count is ${5 - i}`);
    }

    // 6th request must be rejected (429 / allowed=false)
    const blocked = limiter.checkPublicRoute(testIp, baseTime + 600);
    assert(!blocked.allowed, 'Public request #6 exceeds moderate limit and is rejected');
    assertEqual(blocked.remaining, 0, 'Remaining quota is 0');
    assert(blocked.retryAfterSeconds > 0, 'Retry-After seconds is calculated');

    // After 10s window passes, requests succeed again
    const windowPassed = limiter.checkPublicRoute(testIp, baseTime + 10500);
    assert(windowPassed.allowed, 'Public requests succeed again in the next window');
    assertEqual(windowPassed.remaining, 4, 'New window starts fresh with remaining = 4');
  }
  console.log('');

  // TEST 5: Authenticated User Actions (Looser Limit)
  console.log('TEST SUITE 5: Authenticated Endpoints — Looser Limits (240 req/min)');
  {
    const store = new MemoryStore();
    const limiter = new RateLimiter({
      authenticated: { maxRequests: 20, windowMs: 60000 } // Looser limit (20 req) compared to public (5 req)
    }, store);

    const userId = 'usr-premium-9988';
    const baseTime = 4000000;

    // Up to 20 authenticated actions allowed
    for (let i = 1; i <= 20; i++) {
      const res = limiter.checkAuthenticatedRoute(userId, '127.0.0.1', baseTime + i * 50);
      assert(res.allowed, `Authenticated action #${i} allowed under loose quota`);
    }

    // 21st action rejected
    const blocked = limiter.checkAuthenticatedRoute(userId, '127.0.0.1', baseTime + 1100);
    assert(!blocked.allowed, 'Action #21 exceeds authenticated quota and is rejected');
  }
  console.log('');

  // TEST 6: Express Middleware & HTTP Response Headers
  console.log('TEST SUITE 6: Express Middleware & Response Headers');
  {
    const limiter = new RateLimiter({
      public: { maxRequests: 2, windowMs: 10000 }
    });
    const middleware = rateLimitMiddleware('public', { limiter });

    const headers = {};
    const mockRes = {
      setHeader: (k, v) => { headers[k] = v; },
      status: function(code) { this.statusCode = code; return this; },
      json: function(data) { this.body = data; return this; }
    };
    const mockReq = { headers: { 'x-forwarded-for': '12.34.56.78' } };
    let nextCalled = false;

    // Request 1
    middleware(mockReq, mockRes, () => { nextCalled = true; });
    assert(nextCalled, 'next() called for permitted request');
    assertEqual(headers['X-RateLimit-Limit'], '2', 'X-RateLimit-Limit header set to 2');
    assertEqual(headers['X-RateLimit-Remaining'], '1', 'X-RateLimit-Remaining header set to 1');

    // Request 2
    nextCalled = false;
    middleware(mockReq, mockRes, () => { nextCalled = true; });
    assert(nextCalled, 'next() called for request 2');
    assertEqual(headers['X-RateLimit-Remaining'], '0', 'X-RateLimit-Remaining header set to 0');

    // Request 3: Rejection (HTTP 429)
    nextCalled = false;
    middleware(mockReq, mockRes, () => { nextCalled = true; });
    assert(!nextCalled, 'next() NOT called when rate limit exceeded');
    assertEqual(mockRes.statusCode, 429, 'HTTP status code set to 429 Too Many Requests');
    assert(headers['Retry-After'] !== undefined, 'Retry-After header set on 429 response');
  }
  console.log('');

  // TEST 7: Vercel Serverless Function Wrapper
  console.log('TEST SUITE 7: Vercel Serverless Function Wrapper');
  {
    const limiter = new RateLimiter({
      auth: {
        perAccount: { maxAttempts: 1, backoff: { baseDelayMs: 2000, multiplier: 2, maxDelayMs: 10000 } }
      }
    });

    let handlerInvoked = false;
    const testHandler = async (req, res) => {
      handlerInvoked = true;
      res.status(200).json({ ok: true });
    };

    const wrapped = withRateLimit(testHandler, 'auth', { limiter });

    const headers = {};
    const mockRes = {
      setHeader: (k, v) => { headers[k] = v; },
      status: function(code) { this.statusCode = code; return this; },
      json: function(data) { this.body = data; return this; }
    };
    const mockReq = {
      body: JSON.stringify({ email: 'test@serverless.com' }),
      headers: { 'x-real-ip': '55.66.77.88' }
    };

    // First attempt invokes handler and injects req.rateLimiter
    await wrapped(mockReq, mockRes);
    assert(handlerInvoked, 'Serverless handler invoked');
    assert(typeof mockReq.rateLimiter?.recordFailure === 'function', 'req.rateLimiter helper attached');

    // Record failure to trigger backoff
    mockReq.rateLimiter.recordFailure('test@serverless.com');
    mockReq.rateLimiter.recordFailure('test@serverless.com');

    // Next attempt: blocked with 429
    handlerInvoked = false;
    await wrapped(mockReq, mockRes);
    assert(!handlerInvoked, 'Handler NOT invoked when in backoff');
    assertEqual(mockRes.statusCode, 429, 'Vercel wrapper returns 429 when rate limit active');
  }
  console.log('');

  // FINAL SUMMARY
  console.log('====================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
