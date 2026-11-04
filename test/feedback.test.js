/**
 * Automated Test Suite for Customer Feedback & Reviews System
 * 
 * Verifies:
 * 1. Removal of fake reviews (MOCK_REVIEWS is clean and empty).
 * 2. Strict Schema Validation for customer feedback:
 *    - Rejects invalid star ratings (< 1 or > 5 or non-integers).
 *    - Rejects empty or too short names (< 2 chars) and too short comments (< 5 chars).
 *    - Rejects script tags or XSS payloads in feedback text.
 *    - Rejects unauthorized additional properties.
 *    - Accepts valid authentic customer reviews.
 * 3. Rating stars rendering logic.
 */

import { MOCK_REVIEWS } from '../assets/js/mock-data.js';
import {
  CustomerFeedbackSchema,
  validateValue,
  validateOrReject,
  ValidationError
} from '../lib/schema-validator.js';
import { renderRatingStars } from '../assets/js/feedback.js';

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
  console.log('⭐ DEVSHREE REAL CUSTOMER FEEDBACK TEST SUITE');
  console.log('======================================================\n');

  // --------------------------------------------------------------------------
  console.log('--- 1. FAKE REVIEWS REMOVAL VERIFICATION ---');
  // --------------------------------------------------------------------------
  assertEqual(MOCK_REVIEWS.length, 0, 'Hardcoded fake reviews are completely removed from MOCK_REVIEWS');
  assert(Array.isArray(MOCK_REVIEWS), 'MOCK_REVIEWS is an array to prevent breaking legacy imports');

  // --------------------------------------------------------------------------
  console.log('\n--- 2. CustomerFeedbackSchema VALIDATION TESTS ---');
  // --------------------------------------------------------------------------

  // Test 2.1: Valid feedback submission passes
  const validFeedback = {
    name: 'Dharmesh Vora',
    role: 'Civil Contractor, Rajkot',
    stars: 5,
    invoiceNumber: 'INV-DEV-2026-5572',
    category: 'Product Quality & Durability',
    comment: 'The heavy duty drill arrived in pristine packaging. Excellent build quality and genuine warranty card included.',
    recommend: true
  };
  const validRes = validateValue(CustomerFeedbackSchema, validFeedback);
  assertEqual(validRes.valid, true, 'Accepts valid authentic customer feedback');

  // Test 2.2: Rejects invalid star ratings
  const zeroStars = { ...validFeedback, stars: 0 };
  const zeroRes = validateValue(CustomerFeedbackSchema, zeroStars);
  assertEqual(zeroRes.valid, false, 'Rejects 0 stars rating (minimum is 1)');

  const sixStars = { ...validFeedback, stars: 6 };
  const sixRes = validateValue(CustomerFeedbackSchema, sixStars);
  assertEqual(sixRes.valid, false, 'Rejects 6 stars rating (maximum is 5)');

  const floatStars = { ...validFeedback, stars: 4.5 };
  const floatRes = validateValue(CustomerFeedbackSchema, floatStars);
  assertEqual(floatRes.valid, false, 'Rejects float stars rating (must be an integer)');

  // Test 2.3: Rejects name < 2 chars
  const shortName = { ...validFeedback, name: 'A' };
  const shortNameRes = validateValue(CustomerFeedbackSchema, shortName);
  assertEqual(shortNameRes.valid, false, 'Rejects customer name shorter than 2 characters');

  // Test 2.4: Rejects comment < 5 chars
  const shortComment = { ...validFeedback, comment: 'Good' };
  const shortCommentRes = validateValue(CustomerFeedbackSchema, shortComment);
  assertEqual(shortCommentRes.valid, false, 'Rejects review comment shorter than 5 characters');

  // Test 2.5: Rejects script tags or XSS injection in comments
  const xssComment = { ...validFeedback, comment: 'Nice product <script>alert("hacked")</script> recommended' };
  const xssRes = validateValue(CustomerFeedbackSchema, xssComment);
  assertEqual(xssRes.valid, false, 'Rejects HTML and <script> tags in feedback comments');

  // Test 2.6: Rejects unpermitted extra properties (additionalProperties: false)
  const rogueProp = { ...validFeedback, isVerifiedAdmin: true };
  const rogueRes = validateValue(CustomerFeedbackSchema, rogueProp);
  assertEqual(rogueRes.valid, false, 'Rejects unauthorized extra properties on feedback submission');

  // Test 2.7: validateOrReject throws clean ValidationError on invalid submission
  let threwValidationError = false;
  try {
    validateOrReject(CustomerFeedbackSchema, { name: '', stars: 10, comment: 'bad' });
  } catch (err) {
    if (err instanceof ValidationError && err.statusCode === 400) {
      threwValidationError = true;
    }
  }
  assertEqual(threwValidationError, true, 'validateOrReject throws HTTP 400 ValidationError on bad input');

  // --------------------------------------------------------------------------
  console.log('\n--- 3. RATING STARS RENDERING LOGIC ---');
  // --------------------------------------------------------------------------
  const stars5 = renderRatingStars(5);
  assert(stars5.includes('5 out of 5 stars'), 'Renders 5 stars accessible label');
  assert(stars5.split('filled').length - 1 === 5, 'Renders exactly 5 filled star elements for rating 5');

  const stars3 = renderRatingStars(3);
  assert(stars3.includes('3 out of 5 stars'), 'Renders 3 stars accessible label');
  assert(stars3.split('filled').length - 1 === 3, 'Renders exactly 3 filled star elements for rating 3');
  assert(stars3.split('empty').length - 1 === 2, 'Renders exactly 2 empty star elements for rating 3');

  // --------------------------------------------------------------------------
  console.log('\n======================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
