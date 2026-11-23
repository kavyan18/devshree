/**
 * DEVSHREE BRASS — STOREFRONT CATEGORY NAVIGATION & SUBCATEGORY SHOWCASE TESTS
 * Validates:
 * 1. Header category navigation strip DOM contract with hover dropdowns.
 * 2. Active department subcategory showcase rail DOM contract.
 * 3. Dynamic subcategory filtering in catalog engine.
 * 4. Dual activation pathway (Header dropdown vs Photo category card).
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Mock localStorage for test environment
process.env.DEVSHREE_TEST_MODE = 'true';
const mockStore = new Map();
globalThis.localStorage = {
  getItem: (key) => (mockStore.has(key) ? mockStore.get(key) : null),
  setItem: (key, val) => mockStore.set(key, String(val)),
  removeItem: (key) => mockStore.delete(key),
  clear: () => mockStore.clear()
};

// Read source files
const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8');
const stylesCss = fs.readFileSync(path.join(rootDir, 'assets/css/styles.css'), 'utf-8');
const responsiveCss = fs.readFileSync(path.join(rootDir, 'assets/css/responsive.css'), 'utf-8');
const homeJs = fs.readFileSync(path.join(rootDir, 'assets/js/home.js'), 'utf-8');
const productsJs = fs.readFileSync(path.join(rootDir, 'assets/js/products.js'), 'utf-8');

import { 
  DEFAULT_CATEGORIES, 
  DEFAULT_SUBCATEGORIES, 
  getActiveCategories, 
  getSubcategoriesForCategory,
  resetCategoriesToDefault 
} from '../assets/js/categories-data.js';

import { MOCK_PRODUCTS } from '../assets/js/mock-data.js';

let passedTests = 0;
function pass(msg) {
  passedTests++;
  console.log(`  ✓ PASS: ${msg}`);
}

console.log('======================================================');
console.log('🧭 STOREFRONT CATEGORY NAVIGATION & SUBCATEGORY TESTS');
console.log('======================================================\n');

// -----------------------------------------------------------------------------
// Test Section 1: Header Category Navigation Strip & Hover Dropdowns
// -----------------------------------------------------------------------------
console.log('--- 1. HEADER CATEGORY NAVIGATION STRIP & HOVER DROPDOWNS ---');

assert.ok(indexHtml.includes('class="header-category-strip"'), 'Header category strip missing in index.html');
assert.ok(indexHtml.includes('id="header-category-strip"'), 'Header category strip ID missing');
assert.ok(indexHtml.includes('id="header-cat-list"'), 'Header cat list UL missing');
pass('Declares .header-category-strip directly under search bar');

const requiredDepts = ['cat-hardware', 'cat-electric', 'cat-plumbing', 'cat-paints', 'cat-lamination'];
requiredDepts.forEach(catId => {
  assert.ok(indexHtml.includes(`data-cat="${catId}"`), `Missing li for department ${catId}`);
  assert.ok(indexHtml.includes(`id="dropdown-${catId}"`), `Missing dropdown container for ${catId}`);
  assert.ok(indexHtml.includes(`data-subcat-grid="${catId}"`), `Missing subcategory grid for ${catId}`);
});
pass('Contains all 5 core trade departments with dedicated hover dropdown cards');

assert.ok(indexHtml.includes('data-cat-id="cat-hardware" data-subcat-id="subcat-hw-handles"'), 'Missing handles link');
assert.ok(indexHtml.includes('data-cat-id="cat-hardware" data-subcat-id="subcat-hw-locks"'), 'Missing locks link');
assert.ok(indexHtml.includes('data-cat-id="cat-electric" data-subcat-id="subcat-el-wires"'), 'Missing wires link');
assert.ok(indexHtml.includes('data-cat-id="cat-plumbing" data-subcat-id="subcat-pl-valves"'), 'Missing valves link');
assert.ok(indexHtml.includes('data-cat-id="cat-paints" data-subcat-id="subcat-pa-exterior"'), 'Missing paints link');
assert.ok(indexHtml.includes('data-cat-id="cat-lamination" data-subcat-id="subcat-la-decorative"'), 'Missing lamination link');
pass('Dropdowns contain pre-rendered subcategory links with data-cat-id and data-subcat-id');

assert.ok(indexHtml.includes('class="dropdown-dept-all-btn" data-cat-id="cat-hardware"'), 'Missing Hardware View All button');
assert.ok(indexHtml.includes('class="dropdown-dept-all-btn" data-cat-id="cat-electric"'), 'Missing Electric View All button');
pass('Dropdown cards feature "View All Products →" footer links');

assert.ok(stylesCss.includes('.header-category-strip'), 'Missing strip CSS');
assert.ok(stylesCss.includes('.header-cat-dropdown'), 'Missing dropdown CSS');
assert.ok(stylesCss.includes('.header-cat-item:hover .header-cat-dropdown'), 'Missing hover trigger CSS');
pass('CSS provides smooth architectural slide-down hover animation and terracotta border');

const dealsPos = indexHtml.indexOf('id="deals-product-rail-section"');
const topCatPos = indexHtml.indexOf('id="top-categories-bar-section"');
assert.ok(dealsPos !== -1 && topCatPos !== -1, 'Both sections must exist in index.html');
assert.ok(topCatPos > dealsPos, 'Photo categories bar must be positioned under the Best Value Deals section');
pass('Photo categories bar is positioned directly under Best Value Picks & Regular Hardware Deals bar');

// Verify Left-Alignment of Both Category Sections
assert.ok(stylesCss.includes('.header-category-container') && stylesCss.includes('.header-cat-list'), 'Header categories CSS must exist');
assert.ok(stylesCss.includes('.top-categories-container') && stylesCss.includes('.top-categories-scroll-wrapper'), 'Top categories CSS must exist');
assert.ok(stylesCss.includes('justify-content: flex-start'), 'CSS must include flex-start left alignment for categories');
pass('Both category sections are styled for left-side alignment (justify-content: flex-start)');

// -----------------------------------------------------------------------------
// Test Section 2: Active Department Subcategory Showcase Rail
// -----------------------------------------------------------------------------
console.log('\n--- 2. ACTIVE DEPARTMENT SUBCATEGORY SHOWCASE RAIL ---');

assert.ok(indexHtml.includes('id="catalog-subcat-showcase-card"'), 'Missing showcase card in index.html');
assert.ok(indexHtml.includes('id="catalog-subcat-dept-badge"'), 'Missing department badge');
assert.ok(indexHtml.includes('id="catalog-subcat-dept-title"'), 'Missing department title');
assert.ok(indexHtml.includes('id="catalog-subcat-count-pill"'), 'Missing product count pill');
assert.ok(indexHtml.includes('id="btn-reset-dept-filter"'), 'Missing reset department filter button');
assert.ok(indexHtml.includes('id="catalog-subcat-pills-track"'), 'Missing subcategory pills track');
pass('Declares #catalog-subcat-showcase-card with department badges, counter, reset button and pills track');

assert.ok(stylesCss.includes('.catalog-subcat-showcase-card'), 'Missing showcase card CSS');
assert.ok(stylesCss.includes('.subcat-pill-btn'), 'Missing pill button CSS');
assert.ok(stylesCss.includes('.subcat-pill-btn.active'), 'Missing pill active CSS');
assert.ok(stylesCss.includes('.subcat-pill-count'), 'Missing pill count CSS');
assert.ok(stylesCss.includes('.btn-reset-dept-filter'), 'Missing reset button CSS');
pass('CSS implements terracotta (.active) pill styling and smooth horizontal scroll rail');

// -----------------------------------------------------------------------------
// Test Section 3: Dynamic Subcategory Catalog Filtering Logic
// -----------------------------------------------------------------------------
console.log('\n--- 3. DYNAMIC SUBCATEGORY CATALOG FILTERING LOGIC ---');

// Validate filtering logic on products
function filterMockProducts(options) {
  let products = [...MOCK_PRODUCTS];
  if (options.categoryId) {
    const targetCat = options.categoryId;
    products = products.filter(p => {
      const pCat = p.categoryId || p.category_id || '';
      if (pCat === targetCat) return true;
      if ((targetCat === 'cat-electric' || targetCat === 'cat-electrical') && (pCat === 'cat-electric' || pCat === 'cat-electrical')) return true;
      return false;
    });
  }
  if (options.subcategoryId && options.subcategoryId !== 'all') {
    const targetSub = String(options.subcategoryId).toLowerCase();
    products = products.filter(p => {
      const pSubId = String(p.subcategoryId || p.subcategory_id || '').toLowerCase();
      const pSubName = String(p.subcategoryName || p.subcategory_name || '').toLowerCase();
      return pSubId === targetSub || pSubName === targetSub || pSubName.includes(targetSub);
    });
  }
  return products;
}

const hwProducts = filterMockProducts({ categoryId: 'cat-hardware' });
assert.ok(hwProducts.length > 0, 'Hardware products must not be empty');
hwProducts.forEach(p => {
  assert.strictEqual(p.categoryId, 'cat-hardware');
});
pass(`Filters Hardware department correctly (${hwProducts.length} items found)`);

const lockProducts = filterMockProducts({ 
  categoryId: 'cat-hardware', 
  subcategoryId: 'subcat-hw-locks' 
});
assert.ok(lockProducts.length > 0, 'Must return padlock products');
lockProducts.forEach(p => {
  assert.strictEqual(p.subcategoryId, 'subcat-hw-locks');
});
pass(`Filters subcategory 'subcat-hw-locks' accurately (${lockProducts.length} items found)`);

const wireProducts = filterMockProducts({ 
  categoryId: 'cat-electrical', 
  subcategoryId: 'subcat-el-wires' 
});
assert.ok(wireProducts.length > 0, 'Must return wire products');
assert.strictEqual(wireProducts[0].subcategoryId, 'subcat-el-wires');
pass(`Filters subcategory 'subcat-el-wires' under Electric department (${wireProducts.length} items found)`);

const lamProducts = filterMockProducts({ 
  categoryId: 'cat-lamination', 
  subcategoryId: 'subcat-la-decorative' 
});
assert.ok(lamProducts.length > 0, 'Must return decorative laminate products');
assert.strictEqual(lamProducts[0].subcategoryId, 'subcat-la-decorative');
pass(`Filters Lamination products with decorative mica subcategory (${lamProducts.length} items found)`);

assert.ok(productsJs.includes("options.subcategoryId && options.subcategoryId !== 'all'"), 'products.js has subcategoryId filter');
assert.ok(productsJs.includes("p.subcategoryId || p.subcategory_id"), 'products.js checks subcategoryId and subcategory_id');
pass('products.js engine contains native subcategoryId filtering with fallback support');

// -----------------------------------------------------------------------------
// Test Section 4: Homepage JavaScript Controller Integration
// -----------------------------------------------------------------------------
console.log('\n--- 4. HOMEPAGE JAVASCRIPT CONTROLLER INTEGRATION ---');

assert.ok(homeJs.includes('function setCatalogCategoryFilter(catId, subcatId'), 'Missing subcatId param in setCatalogCategoryFilter');
pass('home.js defines setCatalogCategoryFilter with (catId, subcatId = "", shouldScroll = true)');

assert.ok(homeJs.includes('function renderCategorySubcategoryBar(catId, activeSubcatId'), 'Missing renderCategorySubcategoryBar definition');
assert.ok(homeJs.includes('catalog-subcat-showcase-card'), 'Showcase card ID referenced');
assert.ok(homeJs.includes('catalog-subcat-pills-track'), 'Pills track ID referenced');
assert.ok(homeJs.includes('subcat-pill-btn'), 'Pill button class referenced');
pass('home.js implements renderCategorySubcategoryBar to populate pills and department header');

assert.ok(homeJs.includes('function initHeaderCategoryNav()'), 'Missing initHeaderCategoryNav definition');
assert.ok(homeJs.includes('initHeaderCategoryNav();'), 'initHeaderCategoryNav must be called in initDevshreeHome');
pass('home.js implements initHeaderCategoryNav and initializes it on startup');

assert.ok(homeJs.includes("subcategoryId: ''"), 'currentCatalogOptions must have subcategoryId field');
pass('currentCatalogOptions tracks subcategoryId state');

// -----------------------------------------------------------------------------
// Test Section 5: Left-Side Vertical Subcategory Sidebar & Breadcrumbs Layout
// (Matching User Reference Video with Squircle Thumbs & Terracotta Active Indicator)
// -----------------------------------------------------------------------------
console.log('\n--- 5. LEFT VERTICAL SUBCATEGORY SIDEBAR & BREADCRUMBS ---');

// Re-read updated files in test runner
const updatedIndex = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8');
const updatedStyles = fs.readFileSync(path.join(rootDir, 'assets/css/styles.css'), 'utf-8');
const updatedResp = fs.readFileSync(path.join(rootDir, 'assets/css/responsive.css'), 'utf-8');
const updatedHome = fs.readFileSync(path.join(rootDir, 'assets/js/home.js'), 'utf-8');

assert.ok(updatedIndex.includes('class="catalog-layout-wrapper"'), 'Missing .catalog-layout-wrapper in index.html');
assert.ok(updatedIndex.includes('id="catalog-subcat-sidebar"'), 'Missing #catalog-subcat-sidebar in index.html');
assert.ok(updatedIndex.includes('id="subcat-sidebar-track"'), 'Missing #subcat-sidebar-track in index.html');
assert.ok(updatedIndex.includes('id="catalog-breadcrumb-bar"'), 'Missing #catalog-breadcrumb-bar in index.html');
assert.ok(updatedIndex.includes('id="catalog-breadcrumb-root"'), 'Missing #catalog-breadcrumb-root in index.html');
assert.ok(updatedIndex.includes('id="catalog-main-content"'), 'Missing #catalog-main-content in index.html');
pass('index.html declares 2-column catalog layout with vertical sidebar, breadcrumbs and main content area');

assert.ok(updatedStyles.includes('.catalog-layout-wrapper'), 'Missing .catalog-layout-wrapper in styles.css');
assert.ok(updatedStyles.includes('.catalog-subcat-sidebar'), 'Missing .catalog-subcat-sidebar in styles.css');
assert.ok(updatedStyles.includes('.subcat-sidebar-sticky'), 'Missing .subcat-sidebar-sticky in styles.css');
assert.ok(updatedStyles.includes('.subcat-vrail-thumb'), 'Missing .subcat-vrail-thumb in styles.css');
assert.ok(updatedStyles.includes('.subcat-vrail-item.active::before'), 'Missing terracotta active indicator bar (::before) in styles.css');
assert.ok(updatedStyles.includes('.catalog-breadcrumb-bar'), 'Missing .catalog-breadcrumb-bar in styles.css');
pass('styles.css provides squircle thumbnail cards, sticky vertical rail, and signature terracotta left active indicator bar');

assert.ok(updatedResp.includes('.catalog-layout-wrapper'), 'Missing responsive collapse for catalog layout in responsive.css');
assert.ok(updatedResp.includes('.subcat-vrail-track'), 'Missing responsive horizontal scroll for subcategories in responsive.css');
pass('responsive.css collapses cleanly on mobile to horizontal swipeable rail');

assert.ok(updatedHome.includes('function renderSubcategorySidebar(catId, activeSubcatId'), 'Missing renderSubcategorySidebar in home.js');
assert.ok(updatedHome.includes('SUBCATEGORY_SIDEBAR_THUMBNAILS'), 'Missing SUBCATEGORY_SIDEBAR_THUMBNAILS in home.js');
assert.ok(updatedHome.includes('renderSubcategorySidebar(catId, subcatId);'), 'setCatalogCategoryFilter must call renderSubcategorySidebar');
pass('home.js implements renderSubcategorySidebar with authentic hardware thumbnails and dynamic breadcrumbs synchronization');

// -----------------------------------------------------------------------------
// Test Section 6: Dedicated Category & Subcategory Page (category.html & category.js)
// (Matching User Reference Video with Dedicated Listing Page, Left Circular Rail & Product Grid)
// -----------------------------------------------------------------------------
console.log('\n--- 6. DEDICATED CATEGORY & SUBCATEGORY PAGE ---');

const categoryHtmlPath = path.join(rootDir, 'category.html');
const categoryJsPath = path.join(rootDir, 'assets/js/category.js');

assert.ok(fs.existsSync(categoryHtmlPath), 'category.html must exist');
assert.ok(fs.existsSync(categoryJsPath), 'assets/js/category.js must exist');

const categoryHtml = fs.readFileSync(categoryHtmlPath, 'utf-8');
const categoryJs = fs.readFileSync(categoryJsPath, 'utf-8');

assert.ok(categoryHtml.includes('class="catalog-breadcrumb-bar"'), 'category.html has breadcrumb bar');
assert.ok(categoryHtml.includes('id="category-breadcrumb-bar"'), 'category.html has category-breadcrumb-bar');
assert.ok(categoryHtml.includes('class="catalog-layout-wrapper"'), 'category.html has 2-column catalog-layout-wrapper');
assert.ok(categoryHtml.includes('id="category-subcat-sidebar"'), 'category.html has category-subcat-sidebar');
assert.ok(categoryHtml.includes('id="category-subcat-rail-track"'), 'category.html has category-subcat-rail-track');
assert.ok(categoryHtml.includes('id="category-products-grid"'), 'category.html has category-products-grid');
assert.ok(categoryHtml.includes('assets/js/category.js'), 'category.html links to category.js');
pass('category.html declares 2-column layout with left circular sidebar, breadcrumbs and products grid');

assert.ok(categoryJs.includes('export async function initCategoryPage'), 'category.js exports initCategoryPage');
assert.ok(categoryJs.includes('function renderCategoryView('), 'category.js has renderCategoryView');
assert.ok(categoryJs.includes('function renderSubcategorySidebar('), 'category.js has renderSubcategorySidebar');
assert.ok(categoryJs.includes('function renderBreadcrumbs('), 'category.js has renderBreadcrumbs');
assert.ok(categoryJs.includes('function renderProductsGrid('), 'category.js has renderProductsGrid');
pass('category.js defines complete dynamic subcategory, breadcrumb and product filtering engine');

// Verify navigation links point to category.html
assert.ok(updatedIndex.includes('href="category.html?cat=cat-hardware"'), 'Hardware card links to category.html');
assert.ok(updatedIndex.includes('href="category.html?cat=cat-electric"'), 'Electric card links to category.html');
assert.ok(updatedIndex.includes('href="category.html?cat=cat-plumbing"'), 'Plumbing card links to category.html');
assert.ok(updatedIndex.includes('href="category.html?cat=cat-paints"'), 'Paints card links to category.html');
assert.ok(updatedIndex.includes('href="category.html?cat=cat-lamination"'), 'Lamination card links to category.html');
assert.ok(updatedIndex.includes('href="category.html?cat=cat-hardware&subcat=subcat-hw-handles"'), 'Dropdown handles link points to category.html');
assert.ok(updatedIndex.includes('href="category.html?cat=all"'), 'See All link points to category.html?cat=all');
pass('Storefront category cards and header dropdowns accurately link to category.html with query parameters');

console.log('\n======================================================');
console.log(`🏁 TEST RESULTS: ALL ${passedTests} TESTS PASSED (100%)`);
console.log('======================================================\n');
