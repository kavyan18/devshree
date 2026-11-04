/**
 * Comprehensive Automated Test Suite for Strict Schema Validator
 * 
 * Verifies:
 * 1. Strict type checking (rejects wrong types).
 * 2. Strict length and numerical boundaries (rejects too short, too long, too small, too large).
 * 3. Strict format validation (email, phone, pincode, gstin, password, safeText, url).
 * 4. Strict additionalProperties: false (rejects extra unpermitted fields).
 * 5. Rejection over silent sanitization/escaping.
 * 6. Vercel serverless withStrictSchema wrapper (400 Bad Request on violations).
 */

import {
  validateValue,
  validateOrReject,
  ValidationError,
  withStrictSchema,
  LoginSchema,
  SignupSchema,
  PasswordResetSchema,
  ProductsQuerySchema,
  DeliveryAddressSchema,
  CreateOrderSchema,
  ContactInquirySchema
} from '../lib/schema-validator.js';

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
  console.log('STRICT SCHEMA VALIDATOR & INPUT REJECTION TEST SUITE');
  console.log('====================================================\n');

  // TEST 1: Strict Type Enforcement & Rejection
  console.log('TEST SUITE 1: Strict Type Enforcement & Rejection');
  {
    const stringSchema = { type: 'string', required: true };
    assert(!validateValue(stringSchema, 12345).valid, 'Rejects number when string expected');
    assert(!validateValue(stringSchema, true).valid, 'Rejects boolean when string expected');
    assert(!validateValue(stringSchema, ['abc']).valid, 'Rejects array when string expected');
    assert(!validateValue(stringSchema, { name: 'abc' }).valid, 'Rejects object when string expected');
    assert(validateValue(stringSchema, 'Valid String').valid, 'Accepts valid string');

    const integerSchema = { type: 'integer', required: true };
    assert(!validateValue(integerSchema, '10').valid, 'Rejects string when integer expected (no silent coercion)');
    assert(!validateValue(integerSchema, 10.5).valid, 'Rejects float when integer expected');
    assert(!validateValue(integerSchema, NaN).valid, 'Rejects NaN when integer expected');
    assert(validateValue(integerSchema, 10).valid, 'Accepts integer 10');

    const arraySchema = { type: 'array', required: true };
    assert(!validateValue(arraySchema, 'not-an-array').valid, 'Rejects string when array expected');
    assert(!validateValue(arraySchema, { 0: 'item' }).valid, 'Rejects object when array expected');
    assert(validateValue(arraySchema, [1, 2, 3]).valid, 'Accepts valid array');
  }
  console.log('');

  // TEST 2: Strict Length & Boundary Enforcement (No Silent Truncation)
  console.log('TEST SUITE 2: Length & Boundary Limits (Reject, No Truncation)');
  {
    const boundSchema = {
      type: 'string',
      minLength: 5,
      maxLength: 10
    };

    // Too short
    const shortRes = validateValue(boundSchema, 'abc');
    assert(!shortRes.valid, 'Rejects string shorter than minLength (3 < 5)');
    assertEqual(shortRes.errors[0].constraint, 'minLength', 'Constraint is minLength');

    // Too long - must REJECT, not silently truncate!
    const longRes = validateValue(boundSchema, 'this is way too long string');
    assert(!longRes.valid, 'Rejects string exceeding maxLength (27 > 10)');
    assertEqual(longRes.errors[0].constraint, 'maxLength', 'Constraint is maxLength');

    // Exact boundaries
    assert(validateValue(boundSchema, '12345').valid, 'Accepts exact minLength string (5)');
    assert(validateValue(boundSchema, '1234567890').valid, 'Accepts exact maxLength string (10)');

    // Number boundaries
    const numSchema = { type: 'number', minimum: 1, maximum: 100 };
    assert(!validateValue(numSchema, 0.5).valid, 'Rejects number below minimum');
    assert(!validateValue(numSchema, 100.1).valid, 'Rejects number above maximum');
    assert(validateValue(numSchema, 50).valid, 'Accepts valid number in range');

    // Array boundaries
    const arrSchema = { type: 'array', minItems: 1, maxItems: 3 };
    assert(!validateValue(arrSchema, []).valid, 'Rejects empty array when minItems: 1');
    assert(!validateValue(arrSchema, [1, 2, 3, 4]).valid, 'Rejects array exceeding maxItems');
    assert(validateValue(arrSchema, [1, 2]).valid, 'Accepts array within item limits');
  }
  console.log('');

  // TEST 3: Strict Format Validation (Email, Phone, Pincode, GSTIN, Password, SafeText)
  console.log('TEST SUITE 3: Strict Format Validation & Rejection');
  {
    // Email
    const emailSchema = { type: 'string', format: 'email', required: true };
    assert(validateValue(emailSchema, 'contractor@devshree.in').valid, 'Accepts valid email');
    assert(!validateValue(emailSchema, 'not-an-email').valid, 'Rejects invalid email format');
    assert(!validateValue(emailSchema, 'admin@domain').valid, 'Rejects email without TLD');
    assert(!validateValue(emailSchema, '<script>alert(1)</script>@devshree.in').valid, 'Rejects email containing HTML script tags');
    assert(!validateValue(emailSchema, 'user @domain.com').valid, 'Rejects email with unquoted spaces');

    // Phone
    const phoneSchema = { type: 'string', format: 'phone', required: true };
    assert(validateValue(phoneSchema, '9825012345').valid, 'Accepts valid 10-digit Indian mobile');
    assert(validateValue(phoneSchema, '+919825012345').valid, 'Accepts +91 prefixed mobile');
    assert(!validateValue(phoneSchema, '982501234').valid, 'Rejects phone shorter than 10 digits');
    assert(!validateValue(phoneSchema, '9825012345678901').valid, 'Rejects phone longer than 15 digits');
    assert(!validateValue(phoneSchema, '98250abcde').valid, 'Rejects phone with letters (no silent stripping)');

    // Indian PIN code
    const pincodeSchema = { type: 'string', format: 'pincode', required: true };
    assert(validateValue(pincodeSchema, '380015').valid, 'Accepts valid 6-digit Indian PIN code');
    assert(!validateValue(pincodeSchema, '38001').valid, 'Rejects 5-digit PIN code');
    assert(!validateValue(pincodeSchema, '3800155').valid, 'Rejects 7-digit PIN code');
    assert(!validateValue(pincodeSchema, '080015').valid, 'Rejects invalid leading-zero PIN code');
    assert(!validateValue(pincodeSchema, '38001A').valid, 'Rejects alphanumeric PIN code');

    // Indian GSTIN
    const gstinSchema = { type: 'string', format: 'gstin', required: true };
    assert(validateValue(gstinSchema, '24ABCDE1234F1Z5').valid, 'Accepts valid 15-char Indian GSTIN');
    assert(!validateValue(gstinSchema, '24ABCDE1234F1Z').valid, 'Rejects 14-char GSTIN');
    assert(!validateValue(gstinSchema, 'INVALID_GSTIN_123').valid, 'Rejects invalid format GSTIN');

    // SafeText: rejects raw HTML / scripts
    const safeTextSchema = { type: 'string', format: 'safeText', required: true };
    assert(validateValue(safeTextSchema, 'Regular contractor address, Sector 24').valid, 'Accepts clean text');
    assert(!validateValue(safeTextSchema, '<script>alert("xss")</script>').valid, 'Rejects text containing <script>');
    assert(!validateValue(safeTextSchema, '<img src=x onerror=alert(1)>').valid, 'Rejects text containing HTML tags');
  }
  console.log('');

  // TEST 4: additionalProperties: false (Reject Unknown Extra Fields)
  console.log('TEST SUITE 4: Reject Unknown Properties (additionalProperties: false)');
  {
    const strictObjSchema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        username: { type: 'string', required: true },
        age: { type: 'integer', required: true }
      }
    };

    // Valid object
    assert(validateValue(strictObjSchema, { username: 'john', age: 30 }).valid, 'Accepts object with only defined fields');

    // Object with injected rogue field
    const rogueRes = validateValue(strictObjSchema, {
      username: 'john',
      age: 30,
      role: 'admin',
      injectedSql: 'DROP TABLE users'
    });
    assert(!rogueRes.valid, 'Rejects object containing undefined extra properties');
    assertEqual(rogueRes.errors.length, 2, 'Detects both rogue properties');
    assertEqual(rogueRes.errors[0].constraint, 'additionalProperties', 'First error constraint is additionalProperties');
  }
  console.log('');

  // TEST 5: Application Schemas (Login, Signup, PasswordReset, Order)
  console.log('TEST SUITE 5: Production Endpoints Schema Validation');
  {
    // LoginSchema
    assert(validateValue(LoginSchema, { email: 'user@devshree.in', password: 'Password123' }).valid, 'Valid Login payload passes');
    assert(!validateValue(LoginSchema, { email: 'bad-email', password: 'Password123' }).valid, 'Invalid email in login rejected');
    assert(!validateValue(LoginSchema, { email: 'user@devshree.in', password: '123' }).valid, 'Password < 6 in login rejected');
    assert(!validateValue(LoginSchema, { email: 'user@devshree.in', password: 'Password123', isAdmin: true }).valid, 'Extra isAdmin field rejected');

    // SignupSchema
    assert(validateValue(SignupSchema, {
      name: 'Ramesh Patel',
      email: 'ramesh@devshree.in',
      phone: '9825012345',
      password: 'SecurePassword123'
    }).valid, 'Valid Signup payload passes');

    assert(!validateValue(SignupSchema, {
      name: 'R', // too short (< 2)
      email: 'ramesh@devshree.in',
      password: 'SecurePassword123'
    }).valid, 'Signup with 1-character name rejected');

    assert(!validateValue(SignupSchema, {
      name: 'Ramesh <script>', // HTML in name
      email: 'ramesh@devshree.in',
      password: 'SecurePassword123'
    }).valid, 'Signup with special/HTML chars in personName rejected');

    // PasswordResetSchema
    assert(validateValue(PasswordResetSchema, { email: 'customer@devshree.in' }).valid, 'Valid Password Reset payload passes');
    assert(!validateValue(PasswordResetSchema, { email: 'invalid' }).valid, 'Invalid Password Reset email rejected');

    // CreateOrderSchema
    const validOrder = {
      items: [
        { id: 'prod-001', name: 'Devshree Brushless Drill', price: 4299, quantity: 2, brand: 'Devshree' }
      ],
      shippingAddress: {
        name: 'Ramesh Patel',
        phone: '9825012345',
        pincode: '380015',
        city: 'Ahmedabad',
        state: 'Gujarat',
        address: 'B-101, Shanti Heights, Drive In Road',
        landmark: 'Opposite Mall',
        gstin: '24ABCDE1234F1Z5'
      },
      paymentMethod: 'Online UPI / QR'
    };
    assert(validateValue(CreateOrderSchema, validOrder).valid, 'Valid complete order passes schema');

    // Order with zero quantity
    const zeroQtyOrder = JSON.parse(JSON.stringify(validOrder));
    zeroQtyOrder.items[0].quantity = 0;
    assert(!validateValue(CreateOrderSchema, zeroQtyOrder).valid, 'Order with quantity 0 is rejected');

    // Order with invalid payment method enum
    const badPaymentOrder = JSON.parse(JSON.stringify(validOrder));
    badPaymentOrder.paymentMethod = 'Cryptocurrency / Bitcoin';
    assert(!validateValue(CreateOrderSchema, badPaymentOrder).valid, 'Order with unallowed payment method enum is rejected');

    // Order with empty items array
    const emptyItemsOrder = JSON.parse(JSON.stringify(validOrder));
    emptyItemsOrder.items = [];
    assert(!validateValue(CreateOrderSchema, emptyItemsOrder).valid, 'Order with empty items array rejected (minItems: 1)');
  }
  console.log('');

  // TEST 6: Vercel Serverless Wrapper (withStrictSchema)
  console.log('TEST SUITE 6: Vercel Serverless withStrictSchema Wrapper (HTTP 400 Rejection)');
  {
    let handlerCalled = false;
    const mockHandler = async (req, res) => {
      handlerCalled = true;
      res.status(200).json({ success: true, user: req.validatedBody });
    };

    const protectedHandler = withStrictSchema(mockHandler, { body: LoginSchema });

    // 1. Valid Request
    let mockRes = {
      statusCode: null,
      body: null,
      status: function(code) { this.statusCode = code; return this; },
      json: function(data) { this.body = data; return this; }
    };
    let mockReq = {
      body: JSON.stringify({ email: 'client@devshree.in', password: 'Password123' })
    };
    handlerCalled = false;
    await protectedHandler(mockReq, mockRes);
    assert(handlerCalled, 'Handler invoked for schema-compliant request');
    assertEqual(mockRes.statusCode, 200, 'HTTP 200 returned for valid payload');

    // 2. Invalid Request (Missing password, invalid email format)
    mockRes = {
      statusCode: null,
      body: null,
      status: function(code) { this.statusCode = code; return this; },
      json: function(data) { this.body = data; return this; }
    };
    mockReq = {
      body: JSON.stringify({ email: 'not-an-email' })
    };
    handlerCalled = false;
    await protectedHandler(mockReq, mockRes);
    assert(!handlerCalled, 'Handler NOT invoked when schema validation fails');
    assertEqual(mockRes.statusCode, 400, 'HTTP 400 Bad Request returned on schema violation');
    assertEqual(mockRes.body.error, 'Bad Request: Schema Validation Failed', 'Explicit error message returned');
    assert(mockRes.body.details.length >= 1, 'Detailed array of violated constraints returned');

    // 3. Malformed JSON
    mockRes = {
      statusCode: null,
      body: null,
      status: function(code) { this.statusCode = code; return this; },
      json: function(data) { this.body = data; return this; }
    };
    mockReq = { body: '{ malformed json: true ' };
    handlerCalled = false;
    await protectedHandler(mockReq, mockRes);
    assert(!handlerCalled, 'Handler NOT invoked on malformed JSON');
    assertEqual(mockRes.statusCode, 400, 'HTTP 400 returned on malformed JSON');
  }
  console.log('');

  // SUMMARY
  console.log('====================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
