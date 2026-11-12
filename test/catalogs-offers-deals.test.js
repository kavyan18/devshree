/**
 * Test Suite for Admin PDF Catalogs, Top Offers Carousel & Regular Hardware Deals
 */

import assert from 'assert';

// Mock localStorage for test environment
const mockStore = new Map();
globalThis.localStorage = {
  getItem: (key) => (mockStore.has(key) ? mockStore.get(key) : null),
  setItem: (key, val) => mockStore.set(key, String(val)),
  removeItem: (key) => mockStore.delete(key),
  clear: () => mockStore.clear()
};

// 1. Test Catalogs Data Module
import { 
  DEVSHREE_CATALOGS, 
  DEVSHREE_CATEGORIES, 
  getActiveCatalogs, 
  saveActiveCatalogs, 
  resetCatalogsToDefault 
} from '../assets/js/catalogs-data.js';

console.log('======================================================');
console.log('📚 PDF CATALOGS, OFFERS CAROUSEL & REGULAR DEALS TESTS');
console.log('======================================================\n');

console.log('--- 1. PDF CATALOGS DATA & STORAGE SYNCHRONIZATION ---');
assert.ok(Array.isArray(DEVSHREE_CATALOGS), 'DEVSHREE_CATALOGS should be an array');
assert.ok(DEVSHREE_CATALOGS.length >= 8, 'Default brand catalogs count should be at least 8');
console.log(`  ✓ PASS: Found ${DEVSHREE_CATALOGS.length} default manufacturer catalogs`);

// Test getActiveCatalogs fallback
localStorage.clear();
const defaultCats = getActiveCatalogs();
assert.strictEqual(defaultCats.length, DEVSHREE_CATALOGS.length, 'getActiveCatalogs should return defaults when empty');
console.log('  ✓ PASS: getActiveCatalogs returns default brand lookbooks when storage is clean');

// Test saving custom catalog
const customCatalog = {
  id: 'cat-custom-1',
  title: 'Devshree Premium Architectural Fittings 2026',
  brand: 'Devshree Brass',
  category: 'Cabinet Hardware',
  categorySlug: 'hardware',
  coverImage: 'assets/images/catalogs/catalog_godrej_hardware.jpg',
  pdfUrl: 'assets/catalogs/test-catalog.pdf',
  filename: 'Devshree-Brass-2026.pdf',
  pages: 12,
  size: '1.8 MB',
  description: 'Handcrafted solid brass architectural mortise handles and tower bolts.'
};

const updatedCatalogs = [customCatalog, ...defaultCats];
saveActiveCatalogs(updatedCatalogs);
const retrieved = getActiveCatalogs();
assert.strictEqual(retrieved.length, defaultCats.length + 1, 'Custom catalog should be persisted');
assert.strictEqual(retrieved[0].title, 'Devshree Premium Architectural Fittings 2026', 'First catalog should be custom catalog');
console.log('  ✓ PASS: Successfully persisted custom admin-added catalog to localStorage');

// Test resetCatalogsToDefault
resetCatalogsToDefault();
const afterReset = getActiveCatalogs();
assert.strictEqual(afterReset.length, DEVSHREE_CATALOGS.length, 'Catalogs should return to factory count after reset');
console.log('  ✓ PASS: resetCatalogsToDefault properly purges overrides back to defaults\n');


console.log('--- 2. TOP AUTOSCROLLING OFFERS CAROUSEL DATA ---');
import { 
  DEFAULT_OFFERS, 
  getActiveOffers, 
  saveActiveOffers, 
  resetOffersToDefault 
} from '../assets/js/offers-data.js';

assert.ok(Array.isArray(DEFAULT_OFFERS), 'DEFAULT_OFFERS should be an array');
assert.strictEqual(DEFAULT_OFFERS.length, 4, 'Should have exactly 4 default promotional slides');
console.log(`  ✓ PASS: Found ${DEFAULT_OFFERS.length} default carousel slides`);

// Test getActiveOffers fallback
localStorage.clear();
const defaultOffers = getActiveOffers();
assert.strictEqual(defaultOffers.length, 4, 'getActiveOffers should return 4 default slides when empty');
console.log('  ✓ PASS: getActiveOffers returns default promotional slides when storage is clean');

// Test saving custom offer slide
const customOffer = {
  id: 'offer-diwali-mega-sale',
  title: 'Diwali Grand Festivity: Flat 40% Off on Asian Paints Luxury Finishes',
  tagBadge: 'Festive Mega Offer',
  tagSpec: 'Flat 40% OFF',
  subtext: 'Starting at ₹299 / Litre',
  description: 'Limited period architectural emulsions and waterproof exterior primers with free tinting.',
  image: 'assets/images/cat_paints.jpg',
  perks: ['Free computerized tinting', 'Same day dispatch', 'GST Invoice'],
  ctaText: 'Claim Festive Discount',
  ctaLink: '#bestsellers-section',
  categoryFilter: 'cat-paints',
  active: true
};

const updatedOffers = [customOffer, ...defaultOffers];
saveActiveOffers(updatedOffers);
const retrievedOffers = getActiveOffers();
assert.strictEqual(retrievedOffers.length, 5, 'Offers array should contain 5 items');
assert.strictEqual(retrievedOffers[0].id, 'offer-diwali-mega-sale', 'First offer should be custom slide');
console.log('  ✓ PASS: Successfully saved new promotional slide to autoscrolling carousel');

// Test resetOffersToDefault
resetOffersToDefault();
const afterOfferReset = getActiveOffers();
assert.strictEqual(afterOfferReset.length, 4, 'Offers should reset back to 4 default slides');
console.log('  ✓ PASS: resetOffersToDefault restores store factory promotional slides\n');


console.log('--- 3. REGULAR HARDWARE DEALS FILTERING & PRIORITY LOGIC ---');
const sampleProducts = [
  { id: 'p1', name: 'General Screws Box', price: 150, compareAtPrice: 150, discountPercentage: 0, isRegularDeal: false },
  { id: 'p2', name: 'Taparia 10-Inch Adjustable Spanner', price: 430, compareAtPrice: 520, discountPercentage: 17, isRegularDeal: true },
  { id: 'p3', name: 'Normal LED Light', price: 120, compareAtPrice: 120, discountPercentage: 0, isRegularDeal: false },
  { id: 'p4', name: 'Godrej Solid Brass 6-Lever Padlock', price: 749, compareAtPrice: 920, discountPercentage: 18, isRegularDeal: true },
  { id: 'p5', name: 'Big Discount Item 50% Off', price: 500, compareAtPrice: 1000, discountPercentage: 50, isRegularDeal: false }
];

// Replicate home.js deals rail sorting logic
function filterDealsRailProducts(products) {
  const regularDeals = products.filter(p => !!p.isRegularDeal);
  const otherDeals = products.filter(p => {
    if (p.isRegularDeal) return false;
    const disc = p.discountPercentage || 0;
    return disc >= 10 || p.isBestseller || p.isFeatured;
  });
  return [...regularDeals, ...otherDeals];
}

const railItems = filterDealsRailProducts(sampleProducts);
assert.strictEqual(railItems.length, 3, 'Should filter 2 regular deals and 1 50% discount item');
assert.strictEqual(railItems[0].name, 'Taparia 10-Inch Adjustable Spanner', 'First item in shelf must be a Regular Deal');
assert.strictEqual(railItems[1].name, 'Godrej Solid Brass 6-Lever Padlock', 'Second item in shelf must be a Regular Deal');
assert.strictEqual(railItems[2].name, 'Big Discount Item 50% Off', 'Other discount items follow after Regular Deals');
console.log('  ✓ PASS: Regular Hardware Deals are prioritized at the top of the deals shelf');

console.log('\n======================================================');
console.log('🏁 ALL CATALOGS, OFFERS & DEALS TESTS PASSED (100%)');
console.log('======================================================\n');
