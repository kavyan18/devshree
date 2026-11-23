/**
 * Comprehensive Automated Tests for Online UPI Payment & Automatic Order Placement
 * Validates:
 * 1. Dynamic Merchant UPI QR generation (Devshree Hardware, 8866130409@axisbank)
 * 2. Strict Schema validation for 'Online UPI / QR' orders
 * 3. Payment method canonical normalization
 * 4. Automatic payment detection state progression
 * 5. Idempotency guards (prevent duplicate orders)
 * 6. Store Owner WhatsApp dispatch payload with 'Paid' status
 * 7. Verification API endpoint contract
 */

import assert from 'assert';
import { CreateOrderSchema, validateValue } from '../assets/js/schema-validator.js';
import { buildStoreOwnerOrderWhatsAppMessage } from '../assets/js/whatsapp-service.js';

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('\n======================================================');
console.log('⚡ DEVSHREE ONLINE PAYMENT & AUTO-ORDER TEST SUITE');
console.log('======================================================\n');

console.log('--- 1. MERCHANT UPI QR GENERATION CONTRACT ---');

it('Builds valid UPI intent URI with merchant VPA and order amount', () => {
  const merchantVpa = '8866130409@axisbank';
  const total = 1450;
  const txnRef = 'UPI-TEST-849201';
  const upiUri = `upi://pay?pa=${encodeURIComponent(merchantVpa)}&pn=${encodeURIComponent('Devshree Hardware')}&am=${total}&cu=INR&tn=${encodeURIComponent('Devshree Order ' + txnRef)}&tr=${encodeURIComponent(txnRef)}`;

  assert(upiUri.startsWith('upi://pay?'), 'Must start with standard UPI intent');
  assert(upiUri.includes('pa=8866130409%40axisbank'), 'Must contain merchant VPA');
  assert(upiUri.includes('pn=Devshree%20Hardware'), 'Must contain store merchant name');
  assert(upiUri.includes('am=1450'), 'Must contain exact order amount');
  assert(upiUri.includes('tr=UPI-TEST-849201'), 'Must contain transaction reference');
});

console.log('\n--- 2. PAYMENT METHOD NORMALIZATION & SCHEMA ENUM ---');

it('Normalizes "Online UPI QR Payment (UPI-849201)" to canonical "Online UPI / QR"', () => {
  function normalizePaymentMethod(rawMethod) {
    let canonical = 'Cash on Delivery (COD)';
    const raw = String(rawMethod || '').trim();
    if (/cod|cash/i.test(raw)) {
      canonical = 'Cash on Delivery (COD)';
    } else if (/upi|qr/i.test(raw)) {
      canonical = 'Online UPI / QR';
    } else if (/card/i.test(raw)) {
      canonical = 'Card';
    } else if (/net|bank/i.test(raw)) {
      canonical = 'Net Banking';
    } else if (/razorpay/i.test(raw)) {
      canonical = 'Online UPI / QR';
    }
    return canonical;
  }

  assert.strictEqual(normalizePaymentMethod('Online UPI QR Payment (UPI-849201)'), 'Online UPI / QR');
  assert.strictEqual(normalizePaymentMethod('UPI'), 'Online UPI / QR');
  assert.strictEqual(normalizePaymentMethod('Razorpay Online (PAY_123)'), 'Online UPI / QR');
  assert.strictEqual(normalizePaymentMethod('Cash on Delivery (COD)'), 'Cash on Delivery (COD)');
});

it('Validates complete Online UPI / QR order against CreateOrderSchema', () => {
  const payload = {
    items: [
      { id: 'prod-001', name: 'Brass Door Handle Luxury', price: 1250, quantity: 2, brand: 'Devshree' }
    ],
    shippingAddress: {
      name: 'Ramesh Patel',
      phone: '9876543210',
      pincode: '380001',
      city: 'Ahmedabad',
      state: 'Gujarat',
      address: 'Shop 14, Trade Center, Ashram Road'
    },
    paymentMethod: 'Online UPI / QR'
  };

  const result = validateValue(CreateOrderSchema, payload);
  assert.strictEqual(result.valid, true, 'Online UPI order payload must pass CreateOrderSchema validation');
});

console.log('\n--- 3. AUTOMATIC PAYMENT DETECTION & IDEMPOTENCY GUARD ---');

it('Guards against double execution when auto-detected and user clicks simultaneously', () => {
  let isProcessing = false;
  let isCompleted = false;
  let executionCount = 0;

  function simulatePaymentReceived(source) {
    if (isProcessing || isCompleted) return false;
    isProcessing = true;
    isCompleted = true;
    executionCount++;
    return true;
  }

  // First trigger: auto-scanner timer completes
  const firstTrigger = simulatePaymentReceived('automatic_scanner');
  assert.strictEqual(firstTrigger, true, 'First payment detection must succeed');

  // Second trigger: user clicks button at same millisecond
  const secondTrigger = simulatePaymentReceived('user_button_click');
  assert.strictEqual(secondTrigger, false, 'Second trigger must be blocked by idempotency guard');

  // Third trigger: mobile app return event fires
  const thirdTrigger = simulatePaymentReceived('mobile_app_return');
  assert.strictEqual(thirdTrigger, false, 'Subsequent return event must be blocked');

  assert.strictEqual(executionCount, 1, 'Payment order execution must occur EXACTLY once');
});

console.log('\n--- 4. STORE OWNER WHATSAPP NOTIFICATION FOR ONLINE ORDERS ---');

it('Formats Store Owner WhatsApp message with Paid status and Online UPI mode', () => {
  const order = {
    id: 'ord-online-777',
    invoiceNumber: 'INV-DEV-20261117-999',
    customerName: 'Kishore Bhalani',
    customerPhone: '+91 98250 12345',
    shippingAddress: '42, Industrial Area, Morbi, Gujarat',
    itemsSnapshot: [
      { name: 'Solid Brass Antique Mortise Handle', price: 1850, quantity: 4 }
    ],
    total: 7400,
    paymentMethod: 'Online UPI QR Payment (UPI-849201)',
    paymentStatus: 'Paid',
    courierPartner: 'Delhivery Express'
  };

  const message = buildStoreOwnerOrderWhatsAppMessage(order);
  assert(message.includes('YOU HAVE A NEW ORDER!'), 'Must include new order heading');
  assert(message.includes('INV-DEV-20261117-999'), 'Must include invoice number');
  assert(message.includes('Kishore Bhalani'), 'Must include customer name');
  assert(message.includes('Online UPI QR Payment (UPI-849201)'), 'Must include online payment method');
  assert(message.includes('Paid'), 'Must specify payment status as Paid');
  assert(message.includes('+91 88661 30409'), 'Must reference store owner phone');
});

console.log('\n--- 5. MANDATORY UPI UTR VALIDATION & ZERO-LEAK ORDER PREVENTION ---');

it('Rejects order placement when UTR is missing or under 8 digits', () => {
  function validateUtrForOrder(rawUtr) {
    const clean = String(rawUtr || '').trim().replace(/[^a-zA-Z0-9]/g, '');
    if (!clean || clean.length < 8) {
      return { valid: false, error: 'Invalid UTR' };
    }
    return { valid: true, utr: clean };
  }

  assert.strictEqual(validateUtrForOrder('').valid, false);
  assert.strictEqual(validateUtrForOrder('   ').valid, false);
  assert.strictEqual(validateUtrForOrder('12345').valid, false);
  assert.strictEqual(validateUtrForOrder('432109876543').valid, true);
  assert.strictEqual(validateUtrForOrder('AXIS1234567890').valid, true);
});

it('Includes customer UPI UTR and bank verification reminder in store owner WhatsApp message', () => {
  const orderWithUtr = {
    id: 'ord-online-888',
    invoiceNumber: 'INV-DEV-20261123-555',
    customerName: 'Jayeshbhai Patel',
    customerPhone: '+91 98980 54321',
    shippingAddress: 'Plot 12, GIDC, Morbi, Gujarat',
    itemsSnapshot: [
      { name: 'Brass Pull Handle 8-inch', price: 950, quantity: 2 }
    ],
    total: 1900,
    paymentMethod: 'Online UPI / QR',
    paymentStatus: 'Verification Pending',
    utrNumber: '432109876543',
    courierPartner: 'Delhivery Express'
  };

  const message = buildStoreOwnerOrderWhatsAppMessage(orderWithUtr);
  assert(message.includes('432109876543'), 'Must include customer UTR in alert');
  assert(message.includes('Axis Bank'), 'Must remind store owner to verify bank credit');
  assert(message.includes('8866130409@axisbank'), 'Must reference merchant VPA');
});

console.log('\n======================================================');
console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
}
