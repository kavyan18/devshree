/**
 * DEVSHREE — PRODUCTION RATE LIMITING ENGINE & MIDDLEWARE
 * 
 * Supports:
 * - Authentication routes: Strictest limits combining per-IP and per-account limits
 *   with exponential backoff rather than hard lockouts.
 * - Public endpoints: Moderate per-IP rate limits with sliding window.
 * - Authenticated user actions: Looser per-user/account limits.
 * - 100% Configurable thresholds via options or environment variables.
 * - Standard HTTP headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After).
 * - Middleware for Express / Connect and wrapper for Vercel / serverless functions.
 */

// 1. Default Configurable Thresholds
export const DEFAULT_RATE_LIMIT_CONFIG = {
  // Authentication Routes (e.g. login, signup, password reset)
  auth: {
    // Per-Account Limit (e.g. by email/phone/username)
    perAccount: {
      windowMs: 15 * 60 * 1000,    // 15-minute sliding window
      maxAttempts: 5,              // Base attempts allowed before backoff kicks in
      backoff: {
        baseDelayMs: 2000,         // 2 seconds base delay
        multiplier: 2,             // Exponential multiplier: 2s, 4s, 8s, 16s, 32s, 64s...
        maxDelayMs: 5 * 60 * 1000  // Maximum backoff cap (5 minutes)
      }
    },
    // Per-IP Limit for auth routes (mitigates distributed spraying across multiple accounts)
    perIp: {
      windowMs: 15 * 60 * 1000,    // 15-minute sliding window
      maxAttempts: 20,             // 20 total auth attempts per IP before IP backoff
      backoff: {
        baseDelayMs: 1000,         // 1 second base delay
        multiplier: 2,             // 1s, 2s, 4s, 8s, 16s...
        maxDelayMs: 2 * 60 * 1000  // Maximum backoff cap (2 minutes)
      }
    }
  },

  // Public Endpoints (e.g. product catalog, search, categories, review reading, track lookup)
  public: {
    windowMs: 60 * 1000,          // 1 minute window
    maxRequests: 60,              // 60 requests per minute per IP
  },

  // Authenticated User Actions (e.g. cart/wishlist mutations, placing orders, profile updates)
  authenticated: {
    windowMs: 60 * 1000,          // 1 minute window
    maxRequests: 240,             // 240 requests per minute per user ID
  }
};

/**
 * Merge user options and environment variables into default configuration
 * @param {Object} [customConfig]
 * @returns {Object}
 */
export function buildRateLimitConfig(customConfig = {}) {
  const env = (typeof process !== 'undefined' && process.env) ? process.env : {};

  return {
    auth: {
      perAccount: {
        windowMs: Number(env.RATE_LIMIT_AUTH_ACCOUNT_WINDOW_MS) || customConfig.auth?.perAccount?.windowMs || DEFAULT_RATE_LIMIT_CONFIG.auth.perAccount.windowMs,
        maxAttempts: Number(env.RATE_LIMIT_AUTH_ACCOUNT_MAX_ATTEMPTS) || customConfig.auth?.perAccount?.maxAttempts || DEFAULT_RATE_LIMIT_CONFIG.auth.perAccount.maxAttempts,
        backoff: {
          baseDelayMs: Number(env.RATE_LIMIT_AUTH_BACKOFF_BASE_MS) || customConfig.auth?.perAccount?.backoff?.baseDelayMs || DEFAULT_RATE_LIMIT_CONFIG.auth.perAccount.backoff.baseDelayMs,
          multiplier: Number(env.RATE_LIMIT_AUTH_BACKOFF_MULTIPLIER) || customConfig.auth?.perAccount?.backoff?.multiplier || DEFAULT_RATE_LIMIT_CONFIG.auth.perAccount.backoff.multiplier,
          maxDelayMs: Number(env.RATE_LIMIT_AUTH_BACKOFF_MAX_MS) || customConfig.auth?.perAccount?.backoff?.maxDelayMs || DEFAULT_RATE_LIMIT_CONFIG.auth.perAccount.backoff.maxDelayMs,
        }
      },
      perIp: {
        windowMs: Number(env.RATE_LIMIT_AUTH_IP_WINDOW_MS) || customConfig.auth?.perIp?.windowMs || DEFAULT_RATE_LIMIT_CONFIG.auth.perIp.windowMs,
        maxAttempts: Number(env.RATE_LIMIT_AUTH_IP_MAX_ATTEMPTS) || customConfig.auth?.perIp?.maxAttempts || DEFAULT_RATE_LIMIT_CONFIG.auth.perIp.maxAttempts,
        backoff: {
          baseDelayMs: Number(env.RATE_LIMIT_AUTH_IP_BACKOFF_BASE_MS) || customConfig.auth?.perIp?.backoff?.baseDelayMs || DEFAULT_RATE_LIMIT_CONFIG.auth.perIp.backoff.baseDelayMs,
          multiplier: Number(env.RATE_LIMIT_AUTH_IP_BACKOFF_MULTIPLIER) || customConfig.auth?.perIp?.backoff?.multiplier || DEFAULT_RATE_LIMIT_CONFIG.auth.perIp.backoff.multiplier,
          maxDelayMs: Number(env.RATE_LIMIT_AUTH_IP_BACKOFF_MAX_MS) || customConfig.auth?.perIp?.backoff?.maxDelayMs || DEFAULT_RATE_LIMIT_CONFIG.auth.perIp.backoff.maxDelayMs,
        }
      }
    },
    public: {
      windowMs: Number(env.RATE_LIMIT_PUBLIC_WINDOW_MS) || customConfig.public?.windowMs || DEFAULT_RATE_LIMIT_CONFIG.public.windowMs,
      maxRequests: Number(env.RATE_LIMIT_PUBLIC_MAX_REQUESTS) || customConfig.public?.maxRequests || DEFAULT_RATE_LIMIT_CONFIG.public.maxRequests,
    },
    authenticated: {
      windowMs: Number(env.RATE_LIMIT_AUTHED_WINDOW_MS) || customConfig.authenticated?.windowMs || DEFAULT_RATE_LIMIT_CONFIG.authenticated.windowMs,
      maxRequests: Number(env.RATE_LIMIT_AUTHED_MAX_REQUESTS) || customConfig.authenticated?.maxRequests || DEFAULT_RATE_LIMIT_CONFIG.authenticated.maxRequests,
    }
  };
}

/**
 * 2. In-Memory Store with Automatic TTL Cleanup
 */
export class MemoryStore {
  constructor(cleanupIntervalMs = 60000) {
    this.hits = new Map();
    this.backoffs = new Map();

    // Periodic cleanup to avoid memory leaks
    if (typeof setInterval !== 'undefined') {
      this.timer = setInterval(() => this.cleanup(), cleanupIntervalMs);
      if (this.timer.unref) this.timer.unref(); // Do not block Node event loop
    }
  }

  getHitRecord(key) {
    return this.hits.get(key) || null;
  }

  setHitRecord(key, record) {
    this.hits.set(key, record);
  }

  getBackoffRecord(key) {
    return this.backoffs.get(key) || null;
  }

  setBackoffRecord(key, record) {
    this.backoffs.set(key, record);
  }

  clearBackoff(key) {
    this.backoffs.delete(key);
  }

  resetKey(key) {
    this.hits.delete(key);
    this.backoffs.delete(key);
  }

  cleanup(now = Date.now()) {
    // Clean expired hit logs
    for (const [key, record] of this.hits.entries()) {
      if (record.resetTime && record.resetTime <= now) {
        this.hits.delete(key);
      }
    }
    // Clean expired backoffs
    for (const [key, record] of this.backoffs.entries()) {
      if (record.unlockTime && record.unlockTime <= now && (now - record.lastFailureTime > 3600000)) {
        this.backoffs.delete(key);
      }
    }
  }

  destroy() {
    if (this.timer) clearInterval(this.timer);
    this.hits.clear();
    this.backoffs.clear();
  }
}

/**
 * 3. Rate Limiter Core Class
 */
export class RateLimiter {
  constructor(customConfig = {}, store = null) {
    this.config = buildRateLimitConfig(customConfig);
    this.store = store || new MemoryStore();
  }

  /**
   * Helper to normalize account identifier (lowercase email/phone)
   */
  normalizeAccount(account) {
    if (!account || typeof account !== 'string') return 'anonymous';
    return account.trim().toLowerCase();
  }

  /**
   * Extract Client IP from Request (supporting proxies/Vercel/Cloudflare)
   */
  getClientIp(req) {
    if (!req) return '127.0.0.1';
    const headers = req.headers || {};
    const xForwardedFor = headers['x-forwarded-for'];
    if (xForwardedFor) {
      const first = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
      return first.split(',')[0].trim();
    }
    return headers['x-real-ip'] || 
           headers['cf-connecting-ip'] || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.ip || 
           '127.0.0.1';
  }

  /**
   * Evaluate sliding window rate limit for standard public or authenticated endpoints
   * @param {string} key - Cache key (e.g. 'pub:ip' or 'auth_user:uid')
   * @param {number} max - Maximum requests allowed
   * @param {number} windowMs - Window duration in ms
   * @param {number} [now]
   * @returns {Object}
   */
  checkSlidingWindow(key, max, windowMs, now = Date.now()) {
    let record = this.store.getHitRecord(key);

    if (!record || now >= record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
        firstRequestTime: now
      };
      this.store.setHitRecord(key, record);

      return {
        allowed: true,
        limit: max,
        remaining: Math.max(0, max - 1),
        resetTime: record.resetTime,
        retryAfterSeconds: 0
      };
    }

    // Existing active window
    record.count++;
    this.store.setHitRecord(key, record);

    const remaining = Math.max(0, max - record.count);
    const resetTime = record.resetTime;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetTime - now) / 1000));

    if (record.count > max) {
      return {
        allowed: false,
        limit: max,
        remaining: 0,
        resetTime,
        retryAfterSeconds,
        message: `Too many requests. Quota exceeded. Please try again in ${retryAfterSeconds}s.`
      };
    }

    return {
      allowed: true,
      limit: max,
      remaining,
      resetTime,
      retryAfterSeconds: 0
    };
  }

  /**
   * Check exponential backoff status for an auth target
   * If in backoff period, blocks request without locking out the account permanently.
   * @param {string} key - Cache key (e.g. 'auth:acct:test@example.com' or 'auth:ip:1.2.3.4')
   * @param {Object} backoffConfig - { baseDelayMs, multiplier, maxDelayMs }
   * @param {number} maxAttempts - Attempts before backoff applies
   * @param {number} [now]
   * @returns {Object}
   */
  checkExponentialBackoff(key, backoffConfig, maxAttempts, now = Date.now()) {
    const record = this.store.getBackoffRecord(key);
    if (!record) {
      return { inBackoff: false, failures: 0, retryAfterSeconds: 0 };
    }

    // If an active backoff delay is currently in effect
    if (record.unlockTime && now < record.unlockTime) {
      const remainingMs = record.unlockTime - now;
      const retryAfterSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
      return {
        inBackoff: true,
        failures: record.failures,
        retryAfterSeconds,
        unlockTime: record.unlockTime,
        backoffDelayMs: record.currentDelayMs,
        message: `Too many consecutive failed attempts. Please wait ${retryAfterSeconds}s before retrying.`
      };
    }

    return {
      inBackoff: false,
      failures: record.failures,
      retryAfterSeconds: 0
    };
  }

  /**
   * Record a failed attempt (e.g. wrong password, failed signup validation)
   * Calculates exponential backoff: baseDelay * (multiplier ^ excessFailures)
   * @param {string} key
   * @param {Object} backoffConfig
   * @param {number} maxAttempts
   * @param {number} windowMs
   * @param {number} [now]
   * @returns {Object}
   */
  recordFailure(key, backoffConfig, maxAttempts, windowMs, now = Date.now()) {
    let record = this.store.getBackoffRecord(key);

    if (!record || (record.resetTime && now >= record.resetTime)) {
      record = {
        failures: 1,
        lastFailureTime: now,
        resetTime: now + windowMs,
        unlockTime: 0,
        currentDelayMs: 0
      };
    } else {
      record.failures++;
      record.lastFailureTime = now;
    }

    // Check if failures exceed baseline threshold -> apply exponential backoff
    if (record.failures > maxAttempts) {
      const excess = record.failures - maxAttempts;
      // Exponential backoff calculation: baseDelay * (multiplier ^ (excess - 1))
      const calculatedDelay = backoffConfig.baseDelayMs * Math.pow(backoffConfig.multiplier, excess - 1);
      const delayMs = Math.min(backoffConfig.maxDelayMs, calculatedDelay);

      record.currentDelayMs = delayMs;
      record.unlockTime = now + delayMs;
      // Extend window so backoff history isn't prematurely forgotten
      record.resetTime = Math.max(record.resetTime, record.unlockTime + windowMs);
    }

    this.store.setBackoffRecord(key, record);
    return record;
  }

  /**
   * Record a successful authentication attempt (e.g. login succeeded)
   * Resets the failure count and backoff state for that account/IP immediately!
   * @param {string} accountKey
   * @param {string} [ipKey]
   */
  recordAuthSuccess(account, ip) {
    if (account) {
      const normAccount = this.normalizeAccount(account);
      this.store.clearBackoff(`auth:account:${normAccount}`);
      this.store.resetKey(`auth:account:${normAccount}`);
    }
    if (ip) {
      this.store.clearBackoff(`auth:ip:${ip}`);
    }
  }

  /**
   * Record a failed auth attempt for both account and IP
   * @param {string} account
   * @param {string} ip
   * @param {number} [now]
   */
  recordAuthFailure(account, ip, now = Date.now()) {
    const results = {};

    if (account) {
      const normAccount = this.normalizeAccount(account);
      const cfg = this.config.auth.perAccount;
      results.account = this.recordFailure(
        `auth:account:${normAccount}`,
        cfg.backoff,
        cfg.maxAttempts,
        cfg.windowMs,
        now
      );
    }

    if (ip) {
      const cfg = this.config.auth.perIp;
      results.ip = this.recordFailure(
        `auth:ip:${ip}`,
        cfg.backoff,
        cfg.maxAttempts,
        cfg.windowMs,
        now
      );
    }

    return results;
  }

  /**
   * 4. CHECK AUTHENTICATION ROUTE (Login, Signup, Password Reset)
   * Combines Per-IP and Per-Account limits with Exponential Backoff
   * @param {string} account - Email / Username
   * @param {string} ip - Client IP
   * @param {number} [now]
   * @returns {Object}
   */
  checkAuthRoute(account, ip, now = Date.now()) {
    const normAccount = this.normalizeAccount(account);
    const authConfig = this.config.auth;

    // 1. Check Per-Account Backoff
    if (normAccount && normAccount !== 'anonymous') {
      const accountBackoff = this.checkExponentialBackoff(
        `auth:account:${normAccount}`,
        authConfig.perAccount.backoff,
        authConfig.perAccount.maxAttempts,
        now
      );

      if (accountBackoff.inBackoff) {
        return {
          allowed: false,
          type: 'auth',
          target: 'account',
          limit: authConfig.perAccount.maxAttempts,
          remaining: 0,
          retryAfterSeconds: accountBackoff.retryAfterSeconds,
          failures: accountBackoff.failures,
          message: `Too many failed attempts for account (${normAccount}). Exponential backoff active: please wait ${accountBackoff.retryAfterSeconds}s before trying again.`
        };
      }
    }

    // 2. Check Per-IP Backoff
    if (ip) {
      const ipBackoff = this.checkExponentialBackoff(
        `auth:ip:${ip}`,
        authConfig.perIp.backoff,
        authConfig.perIp.maxAttempts,
        now
      );

      if (ipBackoff.inBackoff) {
        return {
          allowed: false,
          type: 'auth',
          target: 'ip',
          limit: authConfig.perIp.maxAttempts,
          remaining: 0,
          retryAfterSeconds: ipBackoff.retryAfterSeconds,
          failures: ipBackoff.failures,
          message: `Too many failed requests from your IP (${ip}). Exponential backoff active: please wait ${ipBackoff.retryAfterSeconds}s before trying again.`
        };
      }
    }

    // 3. Check Overall Volume (Sliding Window Per-IP)
    const ipVolumeCheck = this.checkSlidingWindow(
      `auth:vol:ip:${ip || 'unknown'}`,
      authConfig.perIp.maxAttempts * 2,
      authConfig.perIp.windowMs,
      now
    );

    if (!ipVolumeCheck.allowed) {
      return {
        allowed: false,
        type: 'auth',
        target: 'ip_volume',
        limit: ipVolumeCheck.limit,
        remaining: 0,
        retryAfterSeconds: ipVolumeCheck.retryAfterSeconds,
        message: `Rate limit exceeded for authentication requests from your IP. Please try again in ${ipVolumeCheck.retryAfterSeconds}s.`
      };
    }

    return {
      allowed: true,
      type: 'auth',
      limit: authConfig.perAccount.maxAttempts,
      remaining: Math.max(0, authConfig.perAccount.maxAttempts - (this.store.getBackoffRecord(`auth:account:${normAccount}`)?.failures || 0)),
      retryAfterSeconds: 0
    };
  }

  /**
   * 5. CHECK PUBLIC ENDPOINT (Products, Categories, Search, Reviews)
   * Moderate limits based on IP
   * @param {string} ip - Client IP
   * @param {number} [now]
   * @returns {Object}
   */
  checkPublicRoute(ip, now = Date.now()) {
    const cfg = this.config.public;
    const key = `public:ip:${ip || '127.0.0.1'}`;
    const result = this.checkSlidingWindow(key, cfg.maxRequests, cfg.windowMs, now);

    return {
      allowed: result.allowed,
      type: 'public',
      target: 'ip',
      limit: cfg.maxRequests,
      remaining: result.remaining,
      resetTime: result.resetTime,
      retryAfterSeconds: result.retryAfterSeconds,
      message: result.message || null
    };
  }

  /**
   * 6. CHECK AUTHENTICATED USER ACTION (Orders, Wishlist, Cart, Profile)
   * Looser limits based on User ID
   * @param {string} userId - User UID or Auth Token ID
   * @param {string} [ip] - Fallback IP
   * @param {number} [now]
   * @returns {Object}
   */
  checkAuthenticatedRoute(userId, ip = '127.0.0.1', now = Date.now()) {
    const cfg = this.config.authenticated;
    const identifier = userId ? `user:${userId}` : `ip:${ip}`;
    const key = `authed:${identifier}`;
    const result = this.checkSlidingWindow(key, cfg.maxRequests, cfg.windowMs, now);

    return {
      allowed: result.allowed,
      type: 'authenticated',
      target: userId ? 'user' : 'ip',
      limit: cfg.maxRequests,
      remaining: result.remaining,
      resetTime: result.resetTime,
      retryAfterSeconds: result.retryAfterSeconds,
      message: result.message || null
    };
  }

  /**
   * Set standard Rate Limit Headers on a response object
   */
  setRateLimitHeaders(res, result) {
    if (!res || !res.setHeader) return;
    if (result.limit !== undefined) res.setHeader('X-RateLimit-Limit', String(result.limit));
    if (result.remaining !== undefined) res.setHeader('X-RateLimit-Remaining', String(result.remaining));
    if (result.resetTime !== undefined) res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetTime / 1000)));
    if (!result.allowed && result.retryAfterSeconds > 0) {
      res.setHeader('Retry-After', String(result.retryAfterSeconds));
    }
  }
}

// Global Singleton Instance
export const globalRateLimiter = new RateLimiter();

/**
 * 7. Express / Connect Middleware Generator
 * Usage:
 *   app.use('/api/auth', rateLimitMiddleware('auth'))
 *   app.use('/api/public', rateLimitMiddleware('public'))
 *   app.use('/api/user', rateLimitMiddleware('authenticated'))
 *
 * @param {'auth'|'public'|'authenticated'} type
 * @param {Object} [options]
 */
export function rateLimitMiddleware(type = 'public', options = {}) {
  const limiter = options.limiter || globalRateLimiter;

  return (req, res, next) => {
    const ip = limiter.getClientIp(req);
    let checkResult;

    if (type === 'auth') {
      const account = req.body?.email || req.body?.username || req.body?.phone || req.query?.account || '';
      checkResult = limiter.checkAuthRoute(account, ip);
    } else if (type === 'authenticated') {
      const userId = req.user?.id || req.user?.uid || req.headers['x-user-id'] || null;
      checkResult = limiter.checkAuthenticatedRoute(userId, ip);
    } else {
      checkResult = limiter.checkPublicRoute(ip);
    }

    limiter.setRateLimitHeaders(res, checkResult);

    if (!checkResult.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message: checkResult.message,
        retryAfter: checkResult.retryAfterSeconds,
        rateLimit: {
          type: checkResult.type,
          limit: checkResult.limit,
          remaining: checkResult.remaining,
          retryAfter: checkResult.retryAfterSeconds
        }
      });
    }

    // Attach limiter helper to response to allow recording failures or successes
    res.recordAuthFailure = (account) => limiter.recordAuthFailure(account, ip);
    res.recordAuthSuccess = (account) => limiter.recordAuthSuccess(account, ip);

    if (next) next();
  };
}

/**
 * 8. Vercel Serverless Function Wrapper
 * Usage:
 *   export default withRateLimit(async (req, res) => { ... }, 'auth');
 *
 * @param {Function} handler
 * @param {'auth'|'public'|'authenticated'} type
 * @param {Object} [options]
 */
export function withRateLimit(handler, type = 'public', options = {}) {
  const limiter = options.limiter || globalRateLimiter;

  return async (req, res) => {
    const ip = limiter.getClientIp(req);
    let checkResult;

    if (type === 'auth') {
      // In Vercel serverless, req.body might be pre-parsed or string
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (_) { body = {}; }
      }
      const account = body?.email || body?.username || body?.phone || req.query?.account || '';
      checkResult = limiter.checkAuthRoute(account, ip);
    } else if (type === 'authenticated') {
      const userId = req.headers['x-user-id'] || req.user?.uid || req.query?.userId || null;
      checkResult = limiter.checkAuthenticatedRoute(userId, ip);
    } else {
      checkResult = limiter.checkPublicRoute(ip);
    }

    limiter.setRateLimitHeaders(res, checkResult);

    if (!checkResult.allowed) {
      res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message: checkResult.message,
        retryAfter: checkResult.retryAfterSeconds,
        rateLimit: {
          type: checkResult.type,
          limit: checkResult.limit,
          remaining: checkResult.remaining,
          retryAfter: checkResult.retryAfterSeconds
        }
      });
      return;
    }

    // Provide auth failure/success callbacks on request context
    req.rateLimiter = {
      recordFailure: (account) => limiter.recordAuthFailure(account, ip),
      recordSuccess: (account) => limiter.recordAuthSuccess(account, ip)
    };

    return handler(req, res);
  };
}
