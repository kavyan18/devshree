/**
 * Test Suite: Customer Unrestricted Purchasing & Zero In-Stock Signs
 * Verifies that:
 * 1. Customers can buy and add any product to cart whether in stock or not (stock <= 0, out of stock, high quantity).
 * 2. In-stock badges and "In Stock Only" filter switches are completely removed from customer-facing storefront (index.html & product.html).
 * 3. Dynamic product card template does not inject stock badges on the customer side.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

function pass(msg) {
  console.log(`  ✓ PASS: ${msg}`);
}

console.log('\n======================================================');
console.log('🛒 DEVSHREE CUSTOMER UNRESTRICTED PURCHASING TESTS');
console.log('======================================================');

// -----------------------------------------------------------------------------
// Mock Browser Environment for cart logic
// -----------------------------------------------------------------------------
const storage = new Map();
global.localStorage = {
  getItem: (k) => storage.get(k) || null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear()
};

global.window = {
  dispatchEvent: () => {}
};
global.CustomEvent = class CustomEvent {
  constructor(type, params) {
    this.type = type;
    this.detail = params?.detail;
  }
};

let lastToast = null;
global.showToast = (msg, type) => {
  lastToast = { msg, type };
};

// Import cart functions
const cartModule = await import('../assets/js/cart.js');
const { addToCart, updateQuantity, getCart, clearCart } = cartModule;

// -----------------------------------------------------------------------------
// Test Section 1: Customer Can Buy Any Product Regardless of Stock
// -----------------------------------------------------------------------------
console.log('\n--- 1. UNRESTRICTED PURCHASING (STOCK = 0, OUT OF STOCK, NEGATIVE) ---');

// Reset cart
clearCart();

// 1.1 Product with 0 stock can be added to cart
const zeroStockProduct = {
  id: 'prod-zero-stock',
  name: 'Devshree Brass Tower Bolt 8"',
  price: 450,
  stock: 0,
  brand: 'Devshree'
};

const resultZero = addToCart('prod-zero-stock', 2, zeroStockProduct);
assert.strictEqual(resultZero, true, 'Product with 0 stock must be successfully added to cart');
let cartItems = getCart();
assert.strictEqual(cartItems.length, 1);
assert.strictEqual(cartItems[0].quantity, 2);
pass('Customer can add product with 0 stock to cart without rejection');

// 1.2 Product with negative / backorder stock
const negativeStockProduct = {
  id: 'prod-backorder',
  name: 'Architectural Mortise Handle Set',
  price: 1850,
  stock: -10,
  brand: 'Devshree'
};

const resultNegative = addToCart('prod-backorder', 5, negativeStockProduct);
assert.strictEqual(resultNegative, true, 'Product with negative stock must be successfully added to cart');
cartItems = getCart();
assert.strictEqual(cartItems.length, 2);
pass('Customer can add product with negative/backorder stock to cart');

// 1.3 High Quantity ordering beyond listed stock
const limitedStockProduct = {
  id: 'prod-limited',
  name: 'Brass Cabinet Knob Rose Gold',
  price: 120,
  stock: 3,
  brand: 'Devshree'
};

// Customer orders 100 units even though stock was nominally 3
const resultHighQty = addToCart('prod-limited', 100, limitedStockProduct);
assert.strictEqual(resultHighQty, true, 'High quantity order exceeding nominal stock must succeed');
cartItems = getCart();
const limitedItem = cartItems.find(i => i.productId === 'prod-limited');
assert.strictEqual(limitedItem.quantity, 100, 'Cart item quantity must be 100 without truncation');
pass('Customer can order large quantities exceeding nominal inventory');

// 1.4 Stepper quantity update beyond stock limit
updateQuantity('prod-limited', 250);
cartItems = getCart();
const updatedItem = cartItems.find(i => i.productId === 'prod-limited');
assert.strictEqual(updatedItem.quantity, 250, 'Quantity update to 250 must succeed without capping');
pass('Updating quantity in cart is not capped by inventory limits');

// -----------------------------------------------------------------------------
// Test Section 2: Zero "In Stock" Signs on Customer Homepage (index.html)
// -----------------------------------------------------------------------------
console.log('\n--- 2. STOREFRONT HOMEPAGE (index.html) STOCK SIGNS REMOVAL ---');

const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf-8');

// 2.1 "In Stock Only" checkbox filter is removed
assert(
  !indexHtml.includes('id="catalog-stock-checkbox"'),
  'index.html must NOT contain customer-facing #catalog-stock-checkbox'
);
assert(
  !indexHtml.includes('<span>In Stock Only</span>'),
  'index.html must NOT contain "In Stock Only" filter label'
);
pass('Customer filter toolbar does not contain "In Stock Only" switch');

// 2.2 Pre-rendered product cards do not display in-stock badges
const bestsellersGridMatch = indexHtml.match(/<div class="product-grid" id="bestsellers-grid">([\s\S]*?)<\/div>\s*<\/section>/);
assert(bestsellersGridMatch, 'Bestsellers grid must be present in index.html');
const bestsellersContent = bestsellersGridMatch[1];

assert(
  !bestsellersContent.includes('badge-stock-in'),
  'Pre-rendered customer product cards must NOT contain badge-stock-in'
);
assert(
  !bestsellersContent.includes('In Stock ('),
  'Pre-rendered customer product cards must NOT display "In Stock (XX)" text'
);
pass('Pre-rendered product cards do not display any "In Stock" indicators');

// -----------------------------------------------------------------------------
// Test Section 3: Zero "In Stock" Signs on Product Detail Page (product.html)
// -----------------------------------------------------------------------------
console.log('\n--- 3. PRODUCT DETAILS PAGE (product.html) STOCK SIGNS REMOVAL ---');

const productHtml = fs.readFileSync(path.resolve('product.html'), 'utf-8');

// 3.1 #pdp-stock-label is removed
assert(
  !productHtml.includes('id="pdp-stock-label"'),
  'product.html must NOT contain #pdp-stock-label'
);
assert(
  !productHtml.includes('In Stock &bull; Ready to Dispatch'),
  'product.html must NOT contain "In Stock &bull; Ready to Dispatch"'
);
pass('Product details page (PDP) does not contain in-stock indicator badge');

// -----------------------------------------------------------------------------
// Test Section 4: Dynamic Customer Product Card Template in home.js
// -----------------------------------------------------------------------------
console.log('\n--- 4. DYNAMIC HOMEPAGE ENGINE (home.js) ZERO STOCK BADGES ---');

const homeJs = fs.readFileSync(path.resolve('assets/js/home.js'), 'utf-8');

// Extract createProductCardHtml function body
const cardFnMatch = homeJs.match(/function createProductCardHtml[\s\S]*?return `([\s\S]*?)`;/);
assert(cardFnMatch, 'createProductCardHtml must exist in home.js');
const cardTemplate = cardFnMatch[1];

assert(
  !cardTemplate.includes('${stockBadge}'),
  'createProductCardHtml must NOT interpolate ${stockBadge}'
);
assert(
  !homeJs.includes("const stockBadge = product.stock <= 5"),
  'home.js must NOT create stockBadge in card rendering'
);
pass('Dynamic product card generator does not inject stock badges');

console.log('\n======================================================');
console.log('🏁 TEST RESULTS: ALL 8 UNRESTRICTED BUYING TESTS PASSED');
console.log('======================================================\n');
