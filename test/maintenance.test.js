/**
 * Automated Test Suite for Store Maintenance Mode
 * 
 * Verifies:
 * 1. Default Configuration Constants & Safe Defaults.
 * 2. Vector SVG Illustration matching design with disconnected cables and sparks.
 * 3. HTML Generation & Safe Escaping (XSS protection, phone & WA links).
 * 4. LocalStorage Config Persistence & Merging.
 * 5. State Toggle Logic (enable/disable maintenance mode).
 * 6. Admin Active Session Verification.
 * 7. Verification that removed emails are not displayed.
 */

// Mock browser localStorage for Node environment
const mockStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => (mockStorage.has(key) ? mockStorage.get(key) : null),
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};

import {
  DEFAULT_MAINTENANCE_CONFIG,
  MAINTENANCE_STORAGE_KEY,
  getMaintenanceConfig,
  setMaintenanceMode,
  getMaintenanceIllustrationSvg,
  generateMaintenanceHtml,
  checkIsAdminActive
} from '../assets/js/maintenance.js';

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
  console.log('🛠️ DEVSHREE STORE MAINTENANCE MODE TEST SUITE');
  console.log('======================================================\n');

  console.log('--- 1. DEFAULT CONFIGURATION & SAFETY CHECKS ---');
  assertEqual(DEFAULT_MAINTENANCE_CONFIG.enabled, false, 'Maintenance is OFF by default');
  assertEqual(
    DEFAULT_MAINTENANCE_CONFIG.headline,
    'The site is currently down for maintenance',
    'Matches requested headline'
  );
  assertEqual(
    DEFAULT_MAINTENANCE_CONFIG.message,
    "We apologize for any inconveniences caused. We've almost done.",
    'Matches requested apology message'
  );
  assertEqual(DEFAULT_MAINTENANCE_CONFIG.contactPhone, '+91 8866130409', 'Configured with correct owner phone');
  assert(!DEFAULT_MAINTENANCE_CONFIG.contactEmail.includes('support@devshree'), 'support@devshree email removed');

  console.log('\n--- 2. VECTOR SVG ILLUSTRATION STRUCTURE ---');
  const svg = getMaintenanceIllustrationSvg();
  assert(svg.includes('<svg class="maintenance-illustration"'), 'Generates responsive SVG element');
  assert(svg.includes('maintenance-plug-blue'), 'Contains blue male plug component');
  assert(svg.includes('maintenance-plug-green'), 'Contains green female socket component');
  assert(svg.includes('#93C5FD'), 'Includes soft blue power cord stroke');
  assert(svg.includes('#22C55E'), 'Includes vibrant green power cord stroke');
  assert(svg.includes('maintenance-spark'), 'Contains center disconnected gap and spark particles');

  console.log('\n--- 3. HTML GENERATION & SANITIZATION ---');
  const customConfig = {
    enabled: true,
    headline: 'Store Upgrades in Progress',
    message: 'We are adding new heavy machinery tools. Be back shortly!',
    estimatedTime: 'Back in 20 minutes',
    contactPhone: '+91 8866130409',
    contactEmail: ''
  };

  const html = generateMaintenanceHtml(customConfig);
  assert(html.includes('Store Upgrades in Progress'), 'Renders custom headline');
  assert(html.includes('We are adding new heavy machinery tools.'), 'Renders custom message');
  assert(html.includes('Estimated Return: <strong>Back in 20 minutes</strong>'), 'Renders estimated return pill');
  assert(html.includes('tel:+918866130409'), 'Renders clickable phone link');
  assert(html.includes('https://wa.me/918866130409'), 'Renders WhatsApp support chat link');
  assert(html.includes('admin.html'), 'Includes discreet Admin Portal access link');
  assert(!html.includes('support@devshree'), 'Does not leak or display support@devshree email');

  // XSS attack prevention check
  const maliciousConfig = {
    headline: '<script>alert("hack")</script>',
    message: '<img src=x onerror=alert(1)>'
  };
  const safeHtml = generateMaintenanceHtml(maliciousConfig);
  assert(!safeHtml.includes('<script>alert'), 'Escapes script tags in headline');
  assert(!safeHtml.includes('<img src=x'), 'Escapes img tags in message');
  assert(safeHtml.includes('&lt;script&gt;'), 'Converts tags into safe HTML entities');

  console.log('\n--- 4. LOCALSTORAGE CONFIG RETRIEVAL & MERGING ---');
  mockStorage.clear();
  const initial = getMaintenanceConfig();
  assertEqual(initial.enabled, false, 'Returns default enabled=false when storage is empty');

  // Save partial custom settings
  mockStorage.set(MAINTENANCE_STORAGE_KEY, JSON.stringify({
    headline: 'Quick Server Migration'
  }));
  const merged = getMaintenanceConfig();
  assertEqual(merged.headline, 'Quick Server Migration', 'Retrieves stored headline');
  assertEqual(merged.enabled, false, 'Preserves default enabled state when omitted');
  assertEqual(merged.contactPhone, '+91 8866130409', 'Preserves default contact phone');

  console.log('\n--- 5. MAINTENANCE MODE STATE TOGGLE LOGIC ---');
  mockStorage.clear();
  const turnedOn = await setMaintenanceMode(true, {
    estimatedTime: 'Back at 5:00 PM'
  });
  assertEqual(turnedOn.enabled, true, 'Turns maintenance mode ON');
  assertEqual(turnedOn.estimatedTime, 'Back at 5:00 PM', 'Persists estimated time');

  const loadedAfterOn = getMaintenanceConfig();
  assertEqual(loadedAfterOn.enabled, true, 'Reloads enabled=true from storage');

  const turnedOff = await setMaintenanceMode(false);
  assertEqual(turnedOff.enabled, false, 'Turns maintenance mode OFF');

  const loadedAfterOff = getMaintenanceConfig();
  assertEqual(loadedAfterOff.enabled, false, 'Reloads enabled=false from storage');

  console.log('\n--- 6. ADMIN AUTHENTICATION SESSION CHECK ---');
  mockStorage.clear();
  assert(!checkIsAdminActive(), 'checkIsAdminActive returns false when no session exists');

  mockStorage.set('devshree_admin_session', JSON.stringify({ authenticated: false }));
  assert(!checkIsAdminActive(), 'checkIsAdminActive returns false when authenticated is false');

  mockStorage.set('devshree_admin_session', JSON.stringify({ authenticated: true, user: 'admin@devshree.in' }));
  assert(checkIsAdminActive(), 'checkIsAdminActive returns true when authenticated is true');

  console.log('\n======================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
