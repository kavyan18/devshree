/**
 * DEVSHREE BRASS — ADMIN TRANSPORTATION AMOUNT & SHIPPING CONFIG TEST SUITE
 * Tests:
 * 1. Default shipping configuration values & fallback handling
 * 2. Dynamic threshold calculation logic (below threshold vs free above threshold)
 * 3. Flat rate transportation mode (applies fee regardless of cart total)
 * 4. 100% Free transportation mode (waives fee on all orders)
 * 5. Input validation & negative value rejection
 * 6. Admin HTML DOM elements contract (inputs, mode select, preview, save button)
 * 7. Real-time preview formatting
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

// Mock browser localStorage for Node testing environment
const mockStorage = new Map();
global.localStorage = {
  getItem: (key) => mockStorage.get(key) || null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};

const cartModule = await import('../assets/js/cart.js');
const utilsModule = await import('../assets/js/utils.js');

describe('--- 1. DEFAULT TRANSPORTATION SETTINGS ---', () => {
  it('returns standard default fee (99) and threshold (999) when storage is empty', () => {
    mockStorage.clear();
    const config = cartModule.getStoreShippingConfig();
    assert.strictEqual(config.fee, 99, 'Default fee must be 99');
    assert.strictEqual(config.threshold, 999, 'Default threshold must be 999');
    assert.strictEqual(config.mode, 'threshold', 'Default mode must be threshold');
  });

  it('calculates shipping correctly under default settings', () => {
    mockStorage.clear();
    // Subtotal 0 -> 0
    assert.strictEqual(cartModule.calculateShippingFee(0), 0);
    // Subtotal 500 (< 999) -> 99
    assert.strictEqual(cartModule.calculateShippingFee(500), 99);
    // Subtotal 999 (>= 999) -> 0 (FREE)
    assert.strictEqual(cartModule.calculateShippingFee(999), 0);
    // Subtotal 2500 (>= 999) -> 0 (FREE)
    assert.strictEqual(cartModule.calculateShippingFee(2500), 0);
  });
});

describe('--- 2. ADMIN CUSTOM TRANSPORTATION AMOUNT CONFIGURATION ---', () => {
  it('allows store admin to set custom transportation fee and threshold', () => {
    // Admin sets fee = 150, threshold = 2500
    utilsModule.setStorage('devshree_shipping_fee', 150);
    utilsModule.setStorage('devshree_free_shipping_threshold', 2500);
    utilsModule.setStorage('devshree_shipping_mode', 'threshold');

    const config = cartModule.getStoreShippingConfig();
    assert.strictEqual(config.fee, 150);
    assert.strictEqual(config.threshold, 2500);

    // Below 2500 -> 150
    assert.strictEqual(cartModule.calculateShippingFee(1200), 150);
    assert.strictEqual(cartModule.calculateShippingFee(2499), 150);
    // At or above 2500 -> 0 (FREE)
    assert.strictEqual(cartModule.calculateShippingFee(2500), 0);
    assert.strictEqual(cartModule.calculateShippingFee(5000), 0);
  });

  it('handles flat transportation policy (fee charged on all orders)', () => {
    utilsModule.setStorage('devshree_shipping_fee', 200);
    utilsModule.setStorage('devshree_free_shipping_threshold', 3000);
    utilsModule.setStorage('devshree_shipping_mode', 'flat');

    assert.strictEqual(cartModule.calculateShippingFee(500), 200);
    assert.strictEqual(cartModule.calculateShippingFee(2500), 200);
    assert.strictEqual(cartModule.calculateShippingFee(10000), 200, 'Flat fee applies even on huge orders');
  });

  it('handles 100% free transportation policy (fee waived on all orders)', () => {
    utilsModule.setStorage('devshree_shipping_fee', 150);
    utilsModule.setStorage('devshree_shipping_mode', 'free');

    assert.strictEqual(cartModule.calculateShippingFee(200), 0);
    assert.strictEqual(cartModule.calculateShippingFee(1500), 0);
  });
});

describe('--- 3. INPUT VALIDATION & BOUNDARY RESILIENCE ---', () => {
  it('safely handles invalid or corrupted storage values with fallbacks', () => {
    utilsModule.setStorage('devshree_shipping_fee', 'invalid-letters');
    utilsModule.setStorage('devshree_free_shipping_threshold', 'NaN');
    utilsModule.setStorage('devshree_shipping_mode', '');

    const config = cartModule.getStoreShippingConfig();
    assert.strictEqual(config.fee, 99, 'Falls back to 99 on corrupted fee');
    assert.strictEqual(config.threshold, 999, 'Falls back to 999 on corrupted threshold');
  });

  it('prevents negative fees via Math.max(0, fee)', () => {
    utilsModule.setStorage('devshree_shipping_fee', -50);
    const config = cartModule.getStoreShippingConfig();
    assert.strictEqual(config.fee, 0, 'Negative fees clamped to 0');
  });
});

describe('--- 4. ADMIN HTML DOM CONTRACT & CONTROLS ---', () => {
  const adminHtml = fs.readFileSync(path.resolve('admin.html'), 'utf8');

  it('declares transportation amount input (#settings-shipping-fee)', () => {
    assert.match(adminHtml, /id="settings-shipping-fee"/);
    assert.match(adminHtml, /type="number"[^>]*id="settings-shipping-fee"|id="settings-shipping-fee"[^>]*type="number"/);
  });

  it('declares free shipping threshold input (#settings-free-shipping-threshold)', () => {
    assert.match(adminHtml, /id="settings-free-shipping-threshold"/);
  });

  it('declares transportation policy mode select (#settings-shipping-mode)', () => {
    assert.match(adminHtml, /id="settings-shipping-mode"/);
    assert.match(adminHtml, /value="threshold"/);
    assert.match(adminHtml, /value="flat"/);
    assert.match(adminHtml, /value="free"/);
  });

  it('declares real-time rule preview callout (#settings-shipping-preview-text)', () => {
    assert.match(adminHtml, /id="settings-shipping-preview-text"/);
  });

  it('declares save button (#settings-save-shipping-btn)', () => {
    assert.match(adminHtml, /id="settings-save-shipping-btn"/);
  });
});

describe('--- 5. DYNAMIC STOREFRONT SHIPPING ELEMENTS UPDATER ---', () => {
  it('updates announcement bar, perks, and benefits dynamically under threshold mode', () => {
    const mockElements = {
      announcement: { id: 'announcement-shipping-text', textContent: 'Free express dispatch across India on orders above ₹1,999' },
      perk: { id: 'hero-free-shipping-perk', textContent: 'Free delivery over ₹1,999' },
      benefit: { id: 'benefit-shipping-desc', textContent: 'On orders over ₹1,999 pan-India' }
    };

    global.document = {
      querySelectorAll: (sel) => {
        if (sel.includes('announcement')) return [mockElements.announcement];
        if (sel.includes('perk')) return [mockElements.perk];
        if (sel.includes('benefit')) return [mockElements.benefit];
        return [];
      }
    };

    // Set custom threshold: 149 fee, 2499 threshold
    utilsModule.setStorage('devshree_shipping_fee', 149);
    utilsModule.setStorage('devshree_free_shipping_threshold', 2499);
    utilsModule.setStorage('devshree_shipping_mode', 'threshold');

    cartModule.updateStorefrontShippingElements();

    assert.strictEqual(mockElements.announcement.textContent, 'Free express dispatch across India on orders above ₹2,499');
    assert.strictEqual(mockElements.perk.textContent, 'Free delivery over ₹2,499');
    assert.strictEqual(mockElements.benefit.textContent, 'On orders over ₹2,499 pan-India');
  });

  it('updates storefront elements dynamically under 100% free mode', () => {
    const mockElements = {
      announcement: { id: 'announcement-shipping-text', textContent: '' },
      perk: { id: 'hero-free-shipping-perk', textContent: 'delivery' },
      benefit: { id: 'benefit-shipping-desc', textContent: 'orders' }
    };

    global.document = {
      querySelectorAll: (sel) => {
        if (sel.includes('announcement')) return [mockElements.announcement];
        if (sel.includes('perk')) return [mockElements.perk];
        if (sel.includes('benefit')) return [mockElements.benefit];
        return [];
      }
    };

    utilsModule.setStorage('devshree_shipping_mode', 'free');
    cartModule.updateStorefrontShippingElements();

    assert.match(mockElements.announcement.textContent, /100% Free Express Delivery/i);
    assert.strictEqual(mockElements.perk.textContent, '100% Free delivery');
    assert.strictEqual(mockElements.benefit.textContent, 'On all orders pan-India');
  });

  it('updates storefront elements dynamically under flat rate mode', () => {
    const mockElements = {
      announcement: { id: 'announcement-shipping-text', textContent: '' },
      perk: { id: 'hero-free-shipping-perk', textContent: 'delivery' },
      benefit: { id: 'benefit-shipping-desc', textContent: 'orders' }
    };

    global.document = {
      querySelectorAll: (sel) => {
        if (sel.includes('announcement')) return [mockElements.announcement];
        if (sel.includes('perk')) return [mockElements.perk];
        if (sel.includes('benefit')) return [mockElements.benefit];
        return [];
      }
    };

    utilsModule.setStorage('devshree_shipping_fee', 150);
    utilsModule.setStorage('devshree_shipping_mode', 'flat');
    cartModule.updateStorefrontShippingElements();

    assert.strictEqual(mockElements.announcement.textContent, 'Express Delivery Across India at Flat ₹150');
    assert.strictEqual(mockElements.perk.textContent, 'Express delivery ₹150');
    assert.strictEqual(mockElements.benefit.textContent, 'At flat ₹150 pan-India');
  });
});
