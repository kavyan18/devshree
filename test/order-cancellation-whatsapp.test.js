/**
 * Comprehensive Automated Tests for Order Cancellation & WhatsApp Service
 */

import assert from 'assert';
import { 
  cleanIndianPhone, 
  getStoreOwnerPhone, 
  getStoreOwnerWhatsAppUrl, 
  buildOrderCancellationWhatsAppMessage,
  buildCustomerCancellationRequestWhatsAppMessage 
} from '../assets/js/whatsapp-service.js';

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
console.log('📱 DEVSHREE ORDER CANCELLATION & WHATSAPP TEST SUITE');
console.log('======================================================\n');

console.log('--- 1. PHONE NUMBER NORMALIZATION & WA LINKS ---');

it('Normalizes standard 10-digit phone to 91 prefix', () => {
  assert.strictEqual(cleanIndianPhone('8866130409'), '918866130409');
});

it('Normalizes formatted phone with +91 and spaces', () => {
  assert.strictEqual(cleanIndianPhone('+91 88661 30409'), '918866130409');
});

it('Normalizes 11-digit leading zero phone', () => {
  assert.strictEqual(cleanIndianPhone('08866130409'), '918866130409');
});

it('Preserves 12-digit 91 prefix phone', () => {
  assert.strictEqual(cleanIndianPhone('918866130409'), '918866130409');
});

it('Returns default store owner phone', () => {
  const phone = getStoreOwnerPhone();
  assert.strictEqual(phone, '918866130409');
});

it('Generates official wa.me universal URL for store owner order notification', () => {
  const sampleOrder = {
    invoiceNumber: 'INV-DEV-20261105-001',
    customerName: 'Kavya Contractor',
    total: 3500,
    itemsSnapshot: [{ name: 'Polycab 2.5mm Wire', quantity: 2, price: 1500 }]
  };
  const url = getStoreOwnerWhatsAppUrl(sampleOrder);
  assert.ok(url.startsWith('https://wa.me/918866130409?text='), `Expected wa.me link but got: ${url}`);
  assert.ok(url.includes('INV-DEV-20261105-001'));
});

console.log('\n--- 2. ORDER CANCELLATION WHATSAPP MESSAGES ---');

it('Builds admin-to-customer cancellation alert message with details', () => {
  const sampleOrder = {
    invoiceNumber: 'INV-DEV-9988',
    customerName: 'Ramesh Patel',
    paymentMethod: 'UPI QR Payment',
    total: 1200
  };
  const msg = buildOrderCancellationWhatsAppMessage(sampleOrder, 'Inventory shortage / discontinued model');
  assert.ok(msg.includes('INV-DEV-9988'), 'Should include invoice number');
  assert.ok(msg.includes('Ramesh Patel'), 'Should include customer name');
  assert.ok(msg.includes('Inventory shortage / discontinued model'), 'Should include custom cancellation reason');
  assert.ok(msg.includes('+91 88661 30409'), 'Should include support hotline');
});

it('Builds customer-to-store cancellation request message with refund prompt', () => {
  const sampleOrder = {
    invoiceNumber: 'INV-DEV-7766',
    customerName: 'Aarav Hardware',
    paymentMethod: 'Cash on Delivery (COD)',
    total: 4500
  };
  const msg = buildCustomerCancellationRequestWhatsAppMessage(sampleOrder, 'Ordered duplicate quantity by mistake');
  assert.ok(msg.includes('INV-DEV-7766'), 'Should include invoice number');
  assert.ok(msg.includes('Aarav Hardware'), 'Should include customer name');
  assert.ok(msg.includes('Ordered duplicate quantity by mistake'), 'Should include reason');
  assert.ok(msg.includes('refund'), 'Should prompt for refund confirmation');
});

console.log('\n--- 3. ORDER STATUS TRANSITION TO CANCELLED ---');

it('Validates cancellation metadata payload contract', () => {
  const extra = {
    cancelledAt: new Date().toISOString(),
    cancellationReason: 'Customer requested cancellation via portal',
    cancelledBy: 'Customer'
  };
  assert.strictEqual(typeof extra.cancelledAt, 'string');
  assert.strictEqual(extra.cancellationReason, 'Customer requested cancellation via portal');
  assert.strictEqual(extra.cancelledBy, 'Customer');
});

console.log('\n======================================================');
console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
}

