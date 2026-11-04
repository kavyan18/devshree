/**
 * DEVSHREE — CLIENT-SIDE RATE LIMITING & EXPONENTIAL BACKOFF MODULE
 * 
 * Provides robust rate limiting in the browser:
 * - Stricter limits on authentication actions (login, signup, password reset).
 * - Combination of per-account tracking and device/client session limits.
 * - Exponential backoff on failed auth attempts rather than hard account lockouts.
 * - Moderate sliding-window limits on public storefront browsing actions.
 * - Looser limits on authenticated user actions (cart mutations, orders, profile updates).
 * - 100% configurable thresholds via window.__DEVSHREE_RATE_LIMIT_CONFIG or runtime options.
 */

// 1. Default Configurable Thresholds (Mirrors backend lib/rate-limiter.js)
export const CLIENT_RATE_LIMIT_CONFIG = {
  auth: {
    perAccount: {
      windowMs: 15 * 60 * 1000,    // 15-minute sliding window
      maxAttempts: 5,              // Baseline attempts allowed before exponential backoff applies
      backoff: {
        baseDelayMs: 2000,         // 2 seconds initial backoff delay
        multiplier: 2,             // 2s -> 4s -> 8s -> 16s -> 32s -> 64s...
        maxDelayMs: 5 * 60 * 1000  // Maximum backoff cap (5 minutes)
      }
    },
    clientSession: {
      windowMs: 15 * 60 * 1000,    // 15-minute window for client session
      maxAttempts: 15,             // Overall auth attempts per device before session backoff
      backoff: {
        baseDelayMs: 1500,
        multiplier: 2,
        maxDelayMs: 3 * 60 * 1000
      }
    }
  },
  public: {
    windowMs: 60 * 1000,          // 1 minute window
    maxRequests: 60,              // 60 requests per minute
  },
  authenticated: {
    windowMs: 60 * 1000,          // 1 minute window
    maxRequests: 240,             // 240 requests per minute
  }
};

/**
 * Get active configuration merged with any window.__DEVSHREE_RATE_LIMIT_CONFIG overrides
 */
export function getActiveRateLimitConfig() {
  const globalCustom = (typeof window !== 'undefined' && window.__DEVSHREE_RATE_LIMIT_CONFIG) || {};
  return {
    auth: {
      perAccount: {
        windowMs: globalCustom.auth?.perAccount?.windowMs ?? CLIENT_RATE_LIMIT_CONFIG.auth.perAccount.windowMs,
        maxAttempts: globalCustom.auth?.perAccount?.maxAttempts ?? CLIENT_RATE_LIMIT_CONFIG.auth.perAccount.maxAttempts,
        backoff: {
          baseDelayMs: globalCustom.auth?.perAccount?.backoff?.baseDelayMs ?? CLIENT_RATE_LIMIT_CONFIG.auth.perAccount.backoff.baseDelayMs,
          multiplier: globalCustom.auth?.perAccount?.backoff?.multiplier ?? CLIENT_RATE_LIMIT_CONFIG.auth.perAccount.backoff.multiplier,
          maxDelayMs: globalCustom.auth?.perAccount?.backoff?.maxDelayMs ?? CLIENT_RATE_LIMIT_CONFIG.auth.perAccount.backoff.maxDelayMs,
        }
      },
      clientSession: {
        windowMs: globalCustom.auth?.clientSession?.windowMs ?? CLIENT_RATE_LIMIT_CONFIG.auth.clientSession.windowMs,
        maxAttempts: globalCustom.auth?.clientSession?.maxAttempts ?? CLIENT_RATE_LIMIT_CONFIG.auth.clientSession.maxAttempts,
        backoff: {
          baseDelayMs: globalCustom.auth?.clientSession?.backoff?.baseDelayMs ?? CLIENT_RATE_LIMIT_CONFIG.auth.clientSession.backoff.baseDelayMs,
          multiplier: globalCustom.auth?.clientSession?.backoff?.multiplier ?? CLIENT_RATE_LIMIT_CONFIG.auth.clientSession.backoff.multiplier,
          maxDelayMs: globalCustom.auth?.clientSession?.backoff?.maxDelayMs ?? CLIENT_RATE_LIMIT_CONFIG.auth.clientSession.backoff.maxDelayMs,
        }
      }
    },
    public: {
      windowMs: globalCustom.public?.windowMs ?? CLIENT_RATE_LIMIT_CONFIG.public.windowMs,
      maxRequests: globalCustom.public?.maxRequests ?? CLIENT_RATE_LIMIT_CONFIG.public.maxRequests,
    },
    authenticated: {
      windowMs: globalCustom.authenticated?.windowMs ?? CLIENT_RATE_LIMIT_CONFIG.authenticated.windowMs,
      maxRequests: globalCustom.authenticated?.maxRequests ?? CLIENT_RATE_LIMIT_CONFIG.authenticated.maxRequests,
    }
  };
}

// 2. Safe Local Storage & In-Memory Store
const memoryFallbackStore = new Map();

function storageGet(key, fallback = null) {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }
  } catch (_) {}
  return memoryFallbackStore.get(key) ?? fallback;
}

function storageSet(key, value) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value));
      return;
    }
  } catch (_) {}
  memoryFallbackStore.set(key, value);
}

function storageRemove(key) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
      return;
    }
  } catch (_) {}
  memoryFallbackStore.delete(key);
}

function normalizeAccount(account) {
  if (!account || typeof account !== 'string') return 'anonymous';
  return account.trim().toLowerCase();
}

/**
 * 3. CHECK AUTHENTICATION ROUTE ATTEMPT
 * Checks both per-account backoff and client session volume.
 * If in backoff, returns allowed=false with exponential backoff remaining time.
 * @param {string} account - email or phone
 * @param {number} [now]
 * @returns {{ allowed: boolean, remaining: number, retryAfterSeconds: number, message: string|null }}
 */
export function checkAuthAttempt(account, now = Date.now()) {
  const cfg = getActiveRateLimitConfig();
  const normAccount = normalizeAccount(account);

  // 1. Check Per-Account Backoff
  if (normAccount && normAccount !== 'anonymous') {
    const acctKey = `devshree_rate_auth_acct_${normAccount}`;
    const record = storageGet(acctKey);

    if (record && record.unlockTime && now < record.unlockTime) {
      const remainingMs = record.unlockTime - now;
      const retryAfterSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
      return {
        allowed: false,
        type: 'auth_account',
        failures: record.failures || 0,
        remaining: 0,
        retryAfterSeconds,
        message: `Too many failed attempts for ${normAccount}. Please wait ${retryAfterSeconds}s before trying again.`
      };
    }
  }

  // 2. Check Device Client Session Backoff
  const sessionKey = 'devshree_rate_auth_client_session';
  const sessionRecord = storageGet(sessionKey);
  if (sessionRecord && sessionRecord.unlockTime && now < sessionRecord.unlockTime) {
    const remainingMs = sessionRecord.unlockTime - now;
    const retryAfterSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
    return {
      allowed: false,
      type: 'auth_device',
      failures: sessionRecord.failures || 0,
      remaining: 0,
      retryAfterSeconds,
      message: `Authentication temporarily paused on this device. Please wait ${retryAfterSeconds}s before retrying.`
    };
  }

  // Allowed
  const acctRecord = storageGet(`devshree_rate_auth_acct_${normAccount}`);
  const currentFailures = acctRecord?.failures || 0;
  const remaining = Math.max(0, cfg.auth.perAccount.maxAttempts - currentFailures);

  return {
    allowed: true,
    type: 'auth',
    remaining,
    retryAfterSeconds: 0,
    message: null
  };
}

/**
 * 4. RECORD AUTHENTICATION FAILURE
 * Applies exponential backoff without a permanent lockout:
 * delay = baseDelayMs * (multiplier ^ (excess - 1)), capped at maxDelayMs.
 * @param {string} account - email or phone
 * @param {number} [now]
 * @returns {{ inBackoff: boolean, retryAfterSeconds: number, failures: number }}
 */
export function recordAuthFailure(account, now = Date.now()) {
  const cfg = getActiveRateLimitConfig();
  const normAccount = normalizeAccount(account);
  const results = { inBackoff: false, retryAfterSeconds: 0, failures: 1 };

  // 1. Update Per-Account Record
  if (normAccount && normAccount !== 'anonymous') {
    const acctKey = `devshree_rate_auth_acct_${normAccount}`;
    let record = storageGet(acctKey);

    if (!record || (record.resetTime && now >= record.resetTime)) {
      record = {
        failures: 1,
        lastFailureTime: now,
        resetTime: now + cfg.auth.perAccount.windowMs,
        unlockTime: 0,
        currentDelayMs: 0
      };
    } else {
      record.failures = (record.failures || 0) + 1;
      record.lastFailureTime = now;
    }

    const maxAttempts = cfg.auth.perAccount.maxAttempts;
    if (record.failures > maxAttempts) {
      const excess = record.failures - maxAttempts;
      const backoffCfg = cfg.auth.perAccount.backoff;
      // Exponential backoff calculation
      const calculatedDelay = backoffCfg.baseDelayMs * Math.pow(backoffCfg.multiplier, excess - 1);
      const delayMs = Math.min(backoffCfg.maxDelayMs, calculatedDelay);

      record.currentDelayMs = delayMs;
      record.unlockTime = now + delayMs;
      record.resetTime = Math.max(record.resetTime, record.unlockTime + cfg.auth.perAccount.windowMs);

      results.inBackoff = true;
      results.retryAfterSeconds = Math.max(1, Math.ceil(delayMs / 1000));
    }

    results.failures = record.failures;
    storageSet(acctKey, record);
  }

  // 2. Update Device Client Session Record
  const sessionKey = 'devshree_rate_auth_client_session';
  let sRecord = storageGet(sessionKey);
  if (!sRecord || (sRecord.resetTime && now >= sRecord.resetTime)) {
    sRecord = {
      failures: 1,
      lastFailureTime: now,
      resetTime: now + cfg.auth.clientSession.windowMs,
      unlockTime: 0
    };
  } else {
    sRecord.failures = (sRecord.failures || 0) + 1;
    sRecord.lastFailureTime = now;
  }

  const sMaxAttempts = cfg.auth.clientSession.maxAttempts;
  if (sRecord.failures > sMaxAttempts) {
    const excess = sRecord.failures - sMaxAttempts;
    const sBackoffCfg = cfg.auth.clientSession.backoff;
    const sDelay = Math.min(sBackoffCfg.maxDelayMs, sBackoffCfg.baseDelayMs * Math.pow(sBackoffCfg.multiplier, excess - 1));
    sRecord.unlockTime = now + sDelay;
    sRecord.resetTime = Math.max(sRecord.resetTime, sRecord.unlockTime + cfg.auth.clientSession.windowMs);

    if (!results.inBackoff) {
      results.inBackoff = true;
      results.retryAfterSeconds = Math.max(1, Math.ceil(sDelay / 1000));
    }
  }
  storageSet(sessionKey, sRecord);

  return results;
}

/**
 * 5. RECORD AUTHENTICATION SUCCESS
 * Clears failures and backoff immediately upon successful login.
 * @param {string} account - email or phone
 */
export function recordAuthSuccess(account) {
  const normAccount = normalizeAccount(account);
  if (normAccount && normAccount !== 'anonymous') {
    storageRemove(`devshree_rate_auth_acct_${normAccount}`);
  }
  storageRemove('devshree_rate_auth_client_session');
}

/**
 * Get remaining backoff time in seconds if an account is currently rate-limited
 * @param {string} account
 * @param {number} [now]
 * @returns {number} 0 if not in backoff, otherwise seconds remaining
 */
export function getBackoffRemainingSeconds(account, now = Date.now()) {
  const normAccount = normalizeAccount(account);
  if (!normAccount || normAccount === 'anonymous') return 0;
  const record = storageGet(`devshree_rate_auth_acct_${normAccount}`);
  if (record && record.unlockTime && now < record.unlockTime) {
    return Math.max(1, Math.ceil((record.unlockTime - now) / 1000));
  }
  return 0;
}

/**
 * 6. CHECK PUBLIC ROUTE (Moderate Sliding Window)
 * For storefront browsing, searches, product page hits, etc.
 * @param {string} routeKey
 * @param {number} [now]
 * @returns {{ allowed: boolean, remaining: number, retryAfterSeconds: number, message: string|null }}
 */
export function checkPublicAttempt(routeKey = 'catalog', now = Date.now()) {
  const cfg = getActiveRateLimitConfig().public;
  const key = `devshree_rate_pub_${routeKey}`;
  let record = storageGet(key);

  if (!record || now >= record.resetTime) {
    record = { count: 1, resetTime: now + cfg.windowMs };
    storageSet(key, record);
    return {
      allowed: true,
      remaining: Math.max(0, cfg.maxRequests - 1),
      retryAfterSeconds: 0,
      message: null
    };
  }

  record.count = (record.count || 0) + 1;
  storageSet(key, record);

  const remaining = Math.max(0, cfg.maxRequests - record.count);
  const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));

  if (record.count > cfg.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
      message: `You are browsing too quickly. Please wait ${retryAfterSeconds}s before making another request.`
    };
  }

  return {
    allowed: true,
    remaining,
    retryAfterSeconds: 0,
    message: null
  };
}

/**
 * 7. CHECK AUTHENTICATED USER ACTION (Looser Sliding Window)
 * For cart additions, wishlist toggles, orders, profile updates.
 * @param {string} userId
 * @param {string} actionKey
 * @param {number} [now]
 * @returns {{ allowed: boolean, remaining: number, retryAfterSeconds: number, message: string|null }}
 */
export function checkUserAction(userId = 'guest', actionKey = 'action', now = Date.now()) {
  const cfg = getActiveRateLimitConfig().authenticated;
  const key = `devshree_rate_user_${userId}_${actionKey}`;
  let record = storageGet(key);

  if (!record || now >= record.resetTime) {
    record = { count: 1, resetTime: now + cfg.windowMs };
    storageSet(key, record);
    return {
      allowed: true,
      remaining: Math.max(0, cfg.maxRequests - 1),
      retryAfterSeconds: 0,
      message: null
    };
  }

  record.count = (record.count || 0) + 1;
  storageSet(key, record);

  const remaining = Math.max(0, cfg.maxRequests - record.count);
  const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));

  if (record.count > cfg.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
      message: `Action rate limit reached. Please wait ${retryAfterSeconds}s before trying again.`
    };
  }

  return {
    allowed: true,
    remaining,
    retryAfterSeconds: 0,
    message: null
  };
}

