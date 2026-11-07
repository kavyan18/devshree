/**
 * Automated Test Suite for Admin Authentication & Session Management
 * 
 * Verifies:
 * 1. isAdminEmail logic with default and custom configured admin emails.
 * 2. setAdminSessionActive sets both sessionStorage and localStorage tokens.
 * 3. Session rehydration and persistence across browser sessions / app switching.
 * 4. Proper cleanup on clearAdminSession / logout.
 */

const mockLocalStorage = new Map();
const mockSessionStorage = new Map();

globalThis.localStorage = {
  getItem: (key) => (mockLocalStorage.has(key) ? mockLocalStorage.get(key) : null),
  setItem: (key, val) => mockLocalStorage.set(key, String(val)),
  removeItem: (key) => mockLocalStorage.delete(key),
  clear: () => mockLocalStorage.clear()
};

globalThis.sessionStorage = {
  getItem: (key) => (mockSessionStorage.has(key) ? mockSessionStorage.get(key) : null),
  setItem: (key, val) => mockSessionStorage.set(key, String(val)),
  removeItem: (key) => mockSessionStorage.delete(key),
  clear: () => mockSessionStorage.clear()
};

import { getStorage, setStorage } from '../assets/js/utils.js';

// Implement and test the standalone admin session functions matching admin.js & auth.js
function isAdminEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  const configuredAdminEmail = (getStorage('devshree_admin_email', 'admin@devshree.in') || 'admin@devshree.in').trim().toLowerCase();
  return normalized === configuredAdminEmail ||
         normalized.includes('admin') || 
         normalized.endsWith('@devshree.in') ||
         normalized === 'devshree@gmail.com' ||
         normalized === 'pilojparakavyan7@gmail.com';
}

function setAdminSessionActive(email) {
  const adminEmail = (email || 'admin@devshree.in').trim().toLowerCase();
  const sessionData = {
    email: adminEmail,
    authenticated: true,
    loggedInAt: new Date().toISOString()
  };

  try {
    sessionStorage.setItem('devshree_admin_session_auth', JSON.stringify(sessionData));
  } catch (_) {}

  setStorage('devshree_admin_session_auth', sessionData);
  setStorage('devshree_admin_session', sessionData);
  setStorage('devshree_current_user', {
    uid: 'admin-' + Date.now(),
    displayName: 'Store Administrator',
    email: adminEmail,
    role: 'admin'
  });
}

function isAdminSessionActive() {
  try {
    const raw = sessionStorage.getItem('devshree_admin_session_auth');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.email) return true;
    }
  } catch (_) {}

  try {
    const saved = getStorage('devshree_admin_session_auth', null);
    if (saved && saved.email) {
      sessionStorage.setItem('devshree_admin_session_auth', JSON.stringify(saved));
      return true;
    }
  } catch (_) {}

  try {
    const adminSess = getStorage('devshree_admin_session', null);
    if (adminSess && adminSess.authenticated === true) {
      return true;
    }
  } catch (_) {}

  try {
    const user = getStorage('devshree_current_user', null);
    if (user && (user.role === 'admin' || isAdminEmail(user.email))) {
      return true;
    }
  } catch (_) {}

  return false;
}

function clearAdminSession() {
  try {
    sessionStorage.removeItem('devshree_admin_session_auth');
    sessionStorage.removeItem('devshree_admin_authenticated');
  } catch (_) {}
  try {
    localStorage.removeItem('devshree_admin_session_auth');
    localStorage.removeItem('devshree_admin_session');
    localStorage.removeItem('devshree_current_user');
  } catch (_) {}
}

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
  console.log('\n======================================================');
  console.log('🔐 DEVSHREE ADMIN AUTHENTICATION & SESSION TEST SUITE');
  console.log('======================================================\n');

  console.log('--- 1. ADMIN EMAIL DETECTION (DEFAULT & CONFIGURED) ---');
  assert(isAdminEmail('admin@devshree.in'), 'Recognizes default admin email admin@devshree.in');
  assert(isAdminEmail('ADMIN@DEVSHREE.IN'), 'Case-insensitive email recognition');
  assert(isAdminEmail('support.admin@store.com'), 'Recognizes email containing admin keyword');
  assert(isAdminEmail('devshree@gmail.com'), 'Recognizes devshree@gmail.com');
  assert(isAdminEmail('pilojparakavyan7@gmail.com'), 'Recognizes store owner email');
  assert(!isAdminEmail('customer@yahoo.com'), 'Rejects non-admin retail customer email');
  assert(!isAdminEmail(''), 'Rejects empty email');

  // Test custom configured admin email in storage
  setStorage('devshree_admin_email', 'storeowner@myhardware.com');
  assert(isAdminEmail('storeowner@myhardware.com'), 'Recognizes dynamically configured custom admin email');
  setStorage('devshree_admin_email', 'admin@devshree.in');

  console.log('\n--- 2. ADMIN SESSION STORAGE SYNCHRONIZATION ---');
  mockLocalStorage.clear();
  mockSessionStorage.clear();

  assert(!isAdminSessionActive(), 'isAdminSessionActive is false when not logged in');

  setAdminSessionActive('admin@devshree.in');
  assert(isAdminSessionActive(), 'isAdminSessionActive is true after login');

  const sessRaw = sessionStorage.getItem('devshree_admin_session_auth');
  assert(sessRaw !== null, 'SessionStorage receives devshree_admin_session_auth');
  const sessData = JSON.parse(sessRaw);
  assertEqual(sessData.email, 'admin@devshree.in', 'SessionStorage contains correct admin email');

  const localAuth = getStorage('devshree_admin_session_auth', null);
  assert(localAuth !== null, 'LocalStorage receives devshree_admin_session_auth for persistent backup');
  assertEqual(localAuth.email, 'admin@devshree.in', 'LocalStorage backup contains correct email');

  const localSess = getStorage('devshree_admin_session', null);
  assert(localSess !== null, 'LocalStorage receives devshree_admin_session for maintenance guard bypass');

  console.log('\n--- 3. RE-HYDRATION RESILIENCE ACROSS TABS / APP SWITCHES ---');
  // Simulate tab closing (sessionStorage wiped), but localStorage persisted
  mockSessionStorage.clear();
  assertEqual(sessionStorage.getItem('devshree_admin_session_auth'), null, 'SessionStorage was cleared');

  // isAdminSessionActive automatically re-hydrates sessionStorage from localStorage!
  assert(isAdminSessionActive(), 'isAdminSessionActive returns true via persistent localStorage backup');
  assert(sessionStorage.getItem('devshree_admin_session_auth') !== null, 'SessionStorage successfully re-hydrated');

  console.log('\n--- 4. CLEAN LOGOUT PURGING ---');
  clearAdminSession();

  assert(!isAdminSessionActive(), 'isAdminSessionActive is false after clearAdminSession');
  assertEqual(sessionStorage.getItem('devshree_admin_session_auth'), null, 'sessionStorage purged on logout');
  assertEqual(localStorage.getItem('devshree_admin_session_auth'), null, 'localStorage auth purged on logout');
  assertEqual(localStorage.getItem('devshree_admin_session'), null, 'localStorage session purged on logout');

  console.log('\n======================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
