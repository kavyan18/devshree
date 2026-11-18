/**
 * Automated Test Suite: Devshree Brass Low Stock Button & Manual Alert Management
 * 
 * Tests:
 * 1. Global & Per-Product Alert Threshold Engine
 * 2. Dynamic Stock Status & Badges
 * 3. KPI Low Stock Calculation
 * 4. Interactive Filter Logic
 * 5. Admin HTML & DOM Contract Validation
 */

import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';

// Mock browser localStorage for Node test environment
const mockStorage = {};
const mockLocalStorage = {
  getItem: (k) => (k in mockStorage ? mockStorage[k] : null),
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};
global.localStorage = mockLocalStorage;

console.log('======================================================');
console.log('📦 DEVSHREE LOW STOCK BUTTON & ALERT MANAGEMENT TESTS');
console.log('======================================================\n');

let passedTests = 0;
function pass(desc) {
  console.log(`  ✓ PASS: ${desc}`);
  passedTests++;
}

// -----------------------------------------------------------------------------
// Test Section 1: Low Stock Alert Threshold Engine
// -----------------------------------------------------------------------------
console.log('--- 1. GLOBAL & PER-PRODUCT THRESHOLD ENGINE ---');

const GLOBAL_DEFAULT = 10;
const STORAGE_KEY_GLOBAL = 'devshree_global_low_stock_threshold';
const STORAGE_KEY_PRODUCTS = 'devshree_product_low_stock_thresholds';

function getGlobalLowStockThreshold() {
  const saved = mockLocalStorage.getItem(STORAGE_KEY_GLOBAL);
  if (saved !== null && !isNaN(parseInt(saved, 10))) {
    return Math.max(1, parseInt(saved, 10));
  }
  return GLOBAL_DEFAULT;
}

function setGlobalLowStockThreshold(val) {
  const num = Math.max(1, parseInt(val, 10) || GLOBAL_DEFAULT);
  mockLocalStorage.setItem(STORAGE_KEY_GLOBAL, String(num));
  return num;
}

function getProductLowStockThresholdsMap() {
  const raw = mockLocalStorage.getItem(STORAGE_KEY_PRODUCTS);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) {}
  }
  return {};
}

function saveProductLowStockThresholdsMap(map) {
  mockLocalStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(map || {}));
}

function getProductLowStockThreshold(product) {
  if (!product) return getGlobalLowStockThreshold();
  if (product.lowStockThreshold != null && !isNaN(parseInt(product.lowStockThreshold, 10))) {
    return Math.max(1, parseInt(product.lowStockThreshold, 10));
  }
  if (product.id) {
    const map = getProductLowStockThresholdsMap();
    if (map[product.id] != null && !isNaN(parseInt(map[product.id], 10))) {
      return Math.max(1, parseInt(map[product.id], 10));
    }
  }
  return getGlobalLowStockThreshold();
}

function setProductLowStockThreshold(productId, threshold) {
  if (!productId) return;
  const num = Math.max(1, parseInt(threshold, 10) || getGlobalLowStockThreshold());
  const map = getProductLowStockThresholdsMap();
  map[productId] = num;
  saveProductLowStockThresholdsMap(map);
}

// Test 1.1: Default Global Threshold
mockLocalStorage.clear();
assert.equal(getGlobalLowStockThreshold(), 10, 'Default global threshold should be 10');
pass('Defaults to 10 units when no custom global threshold configured');

// Test 1.2: Set & Retrieve Custom Global Threshold
setGlobalLowStockThreshold(15);
assert.equal(getGlobalLowStockThreshold(), 15, 'Updated global threshold should be 15');
assert.equal(mockLocalStorage.getItem(STORAGE_KEY_GLOBAL), '15');
pass('Persists and retrieves custom global threshold (15 units)');

// Test 1.3: Per-Product Threshold Override
const sampleProdA = { id: 'prod-A', name: 'Brass Pull Handle', stock: 12 };
const sampleProdB = { id: 'prod-B', name: 'Mortise Lock', stock: 12 };

// Without override, both inherit global 15
assert.equal(getProductLowStockThreshold(sampleProdA), 15);
assert.equal(getProductLowStockThreshold(sampleProdB), 15);

// Set custom override for prod-A to 5
setProductLowStockThreshold('prod-A', 5);
assert.equal(getProductLowStockThreshold(sampleProdA), 5, 'prod-A should use its custom threshold of 5');
assert.equal(getProductLowStockThreshold(sampleProdB), 15, 'prod-B should still use global threshold of 15');
pass('Per-product custom threshold correctly overrides store-wide default');

// Test 1.4: Direct in-memory property priority
const sampleProdC = { id: 'prod-C', name: 'Cabinet Knob', stock: 8, lowStockThreshold: 20 };
assert.equal(getProductLowStockThreshold(sampleProdC), 20);
pass('Direct in-memory product threshold takes immediate precedence');

// -----------------------------------------------------------------------------
// Test Section 2: Dynamic Stock Status & Badges
// -----------------------------------------------------------------------------
console.log('\n--- 2. DYNAMIC STOCK STATUS & ALERT EVALUATION ---');

function evaluateStockStatus(product) {
  const stock = Number(product.stock || 0);
  const threshold = getProductLowStockThreshold(product);
  if (stock <= 0) return { status: 'out-of-stock', text: 'Out of Stock', isAlert: true };
  if (stock <= threshold) return { status: 'low-stock', text: 'Low Stock', isAlert: true };
  return { status: 'in-stock', text: 'In Stock', isAlert: false };
}

// Out of stock
const outOfStockProd = { id: 'p-out', stock: 0 };
assert.deepEqual(evaluateStockStatus(outOfStockProd), { status: 'out-of-stock', text: 'Out of Stock', isAlert: true });
pass('Stock <= 0 evaluates as out-of-stock and triggers alert');

// Low stock (stock <= threshold)
const lowStockProd = { id: 'p-low', stock: 8, lowStockThreshold: 10 };
assert.deepEqual(evaluateStockStatus(lowStockProd), { status: 'low-stock', text: 'Low Stock', isAlert: true });
pass('Stock <= threshold evaluates as low-stock and triggers alert');

// In stock (stock > threshold)
const inStockProd = { id: 'p-in', stock: 11, lowStockThreshold: 10 };
assert.deepEqual(evaluateStockStatus(inStockProd), { status: 'in-stock', text: 'In Stock', isAlert: false });
pass('Stock > threshold evaluates as in-stock without alert');

// Boundary test: stock exactly equal to threshold
const boundaryProd = { id: 'p-bound', stock: 10, lowStockThreshold: 10 };
assert.equal(evaluateStockStatus(boundaryProd).status, 'low-stock');
pass('Stock exactly equal to threshold triggers low-stock warning');

// -----------------------------------------------------------------------------
// Test Section 3: KPI Low Stock Calculation
// -----------------------------------------------------------------------------
console.log('\n--- 3. KPI SUMMARY WITH MANUAL ALERT THRESHOLDS ---');

const testCatalog = [
  { id: 'p1', name: 'Product 1', stock: 50, lowStockThreshold: 10 },  // In Stock
  { id: 'p2', name: 'Product 2', stock: 10, lowStockThreshold: 10 },  // Low Stock
  { id: 'p3', name: 'Product 3', stock: 5,  lowStockThreshold: 10 },  // Low Stock
  { id: 'p4', name: 'Product 4', stock: 25, lowStockThreshold: 30 },  // Low Stock (custom high threshold)
  { id: 'p5', name: 'Product 5', stock: 0,  lowStockThreshold: 10 },  // Out of stock (Alert)
  { id: 'p6', name: 'Product 6', stock: 100, lowStockThreshold: 5 }   // In Stock
];

function calculateKpis(catalog) {
  const total = catalog.length;
  const inStock = catalog.filter(p => (Number(p.stock) || 0) > getProductLowStockThreshold(p)).length;
  const lowStock = catalog.filter(p => (Number(p.stock) || 0) <= getProductLowStockThreshold(p)).length;
  return { total, inStock, lowStock };
}

const kpis = calculateKpis(testCatalog);
assert.equal(kpis.total, 6);
assert.equal(kpis.inStock, 2); // p1 (50 > 10), p6 (100 > 5)
assert.equal(kpis.lowStock, 4); // p2 (10<=10), p3 (5<=10), p4 (25<=30), p5 (0<=10)
pass('KPI calculations evaluate accurately across individual product thresholds');

// If admin updates global threshold for products without custom threshold
setGlobalLowStockThreshold(4);
const customTestCatalog = [
  { id: 'p10', name: 'Normal 1', stock: 5 }, // stock 5 > 4 (now in stock!)
  { id: 'p11', name: 'Normal 2', stock: 4 }, // stock 4 <= 4 (low stock)
];
const kpis2 = calculateKpis(customTestCatalog);
assert.equal(kpis2.inStock, 1);
assert.equal(kpis2.lowStock, 1);
pass('Changing global threshold immediately shifts KPI counts dynamically');

// -----------------------------------------------------------------------------
// Test Section 4: Filter Logic (Interactive Low Stock Button)
// -----------------------------------------------------------------------------
console.log('\n--- 4. LOW STOCK BUTTON FILTER & SEARCH INTERACTION ---');

function filterProducts(catalog, { query = '', category = 'all', isLowStockOnly = false } = {}) {
  const q = query.toLowerCase().trim();
  return catalog.filter(p => {
    const matchCat = category === 'all' || p.categoryId === category;
    const matchText = !q || (p.name && p.name.toLowerCase().includes(q));
    let matchStock = true;
    if (isLowStockOnly) {
      const threshold = getProductLowStockThreshold(p);
      matchStock = (Number(p.stock) || 0) <= threshold;
    }
    return matchCat && matchText && matchStock;
  });
}

// Filter all low stock
const lowStockFiltered = filterProducts(testCatalog, { isLowStockOnly: true });
assert.equal(lowStockFiltered.length, 4);
assert.deepEqual(lowStockFiltered.map(p => p.id), ['p2', 'p3', 'p4', 'p5']);
pass('Low Stock filter returns only items requiring restocking');

// Filter low stock + search query
const filteredWithSearch = filterProducts(testCatalog, { isLowStockOnly: true, query: 'Product 4' });
assert.equal(filteredWithSearch.length, 1);
assert.equal(filteredWithSearch[0].id, 'p4');
pass('Low Stock filter composes seamlessly with keyword search');

// Clear low stock filter
const allProductsReturned = filterProducts(testCatalog, { isLowStockOnly: false });
assert.equal(allProductsReturned.length, 6);
pass('Disabling Low Stock filter restores full catalog listing');

// -----------------------------------------------------------------------------
// Test Section 5: HTML DOM Contract Verification (admin.html)
// -----------------------------------------------------------------------------
console.log('\n--- 5. ADMIN HTML DOM CONTRACT & ACCESSIBILITY ---');

const adminHtmlPath = path.resolve('admin.html');
const adminHtml = fs.readFileSync(adminHtmlPath, 'utf-8');

// 5.1: Interactive KPI Card
assert(adminHtml.includes('id="kpi-card-low-stock"'), 'admin.html must contain #kpi-card-low-stock');
assert(adminHtml.includes('kpi-card-clickable'), 'Low stock card must have kpi-card-clickable class');
assert(adminHtml.includes('role="button"'), 'Low stock card must have accessible role="button"');
assert(adminHtml.includes('id="btn-open-low-stock-modal"'), 'Low stock card must include quick alert config button');
pass('KPI card #kpi-card-low-stock has clickable role, button and trigger');

// 5.2: Active Low Stock Filter Banner
assert(adminHtml.includes('id="admin-low-stock-filter-bar"'), 'admin.html must contain #admin-low-stock-filter-bar');
assert(adminHtml.includes('id="btn-clear-low-stock-filter"'), 'Filter bar must contain #btn-clear-low-stock-filter');
assert(adminHtml.includes('id="admin-low-stock-filter-count"'), 'Filter bar must display live item count');
pass('Active filter bar #admin-low-stock-filter-bar with clear button exists');

// 5.3: Add/Edit Product Form Low Stock Field
assert(adminHtml.includes('id="prod-low-stock-threshold"'), 'Add/Edit product form must have #prod-low-stock-threshold');
assert(adminHtml.includes('Low Stock Alert &le;'), 'Field label must clearly indicate alert condition');
pass('Add/Edit product form has manual Low Stock Alert threshold field');

// 5.4: Low Stock Alert Settings Modal
assert(adminHtml.includes('id="admin-low-stock-modal"'), 'admin.html must contain #admin-low-stock-modal');
assert(adminHtml.includes('id="modal-global-low-stock-input"'), 'Modal must have global default threshold input');
assert(adminHtml.includes('id="btn-apply-global-to-all"'), 'Modal must have "Apply to ALL" button');
assert(adminHtml.includes('id="modal-threshold-tbody"'), 'Modal must have per-product threshold table body');
assert(adminHtml.includes('id="admin-low-stock-modal-save"'), 'Modal must have save button');
pass('Low Stock Alert Settings modal #admin-low-stock-modal is fully declared');

console.log('\n======================================================');
console.log(`🏁 TEST RESULTS: ${passedTests} PASSED, 0 FAILED`);
console.log('======================================================');
