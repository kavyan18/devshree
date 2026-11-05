/**
 * DEVSHREE — PRODUCTS & CATALOG SERVICE (STAGE 3)
 * Manages Cloud Firestore category & product queries, live catalog synchronization,
 * dynamic search/filtering/sorting, and automated database seeding.
 */

import { 
  db, 
  isConfigured, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp 
} from './firebase-config.js';
import { MOCK_CATEGORIES, MOCK_PRODUCTS } from './mock-data.js';
import { showToast, getStorage, setStorage } from './utils.js';
import { showSafeErrorToast } from './error-handler.js';

const CACHE_PRODUCTS_KEY = 'devshree_cached_products';
const CACHE_CATEGORIES_KEY = 'devshree_cached_categories';

/**
 * Fetch the 4 main product categories
 * Reads from Cloud Firestore if available, falls back to mock data
 * @returns {Promise<Array>}
 */
export async function fetchCategories() {
  if (isConfigured && db) {
    try {
      const colRef = collection(db, 'categories');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        const categories = [];
        snap.forEach(d => categories.push({ id: d.id, ...d.data() }));
        setStorage(CACHE_CATEGORIES_KEY, categories);
        return categories;
      }
    } catch (err) {
      console.warn('[Devshree] Error reading categories from Firestore, using local fallback:', err);
    }
  }

  // Fallback to local storage cache or mock data
  return getStorage(CACHE_CATEGORIES_KEY, MOCK_CATEGORIES);
}

/**
 * Fetch products with dynamic filtering and sorting
 * @param {Object} options
 * @param {string} [options.categoryId]
 * @param {string} [options.brand]
 * @param {string} [options.searchQuery]
 * @param {string} [options.sortBy] - 'featured'|'price-low'|'price-high'|'rating'|'bestseller'|'newest'
 * @param {boolean} [options.inStockOnly]
 * @param {number} [options.maxPrice]
 * @returns {Promise<Array>}
 */
export async function fetchProducts(options = {}) {
  let products = [];

  if (isConfigured && db) {
    try {
      const colRef = collection(db, 'products');
      let q = colRef;
      if (options.categoryId) {
        q = query(colRef, where('categoryId', '==', options.categoryId));
      }

      const snap = await getDocs(q);
      if (!snap.empty) {
        snap.forEach(d => products.push({ id: d.id, ...d.data() }));
        setStorage(CACHE_PRODUCTS_KEY, products);
      }
    } catch (err) {
      console.warn('[Devshree] Error fetching products from Firestore, using fallback:', err);
    }
  }

  // If Firestore returned no products or errored, use cached or mock products
  if (!Array.isArray(products) || products.length === 0) {
    const cached = getStorage(CACHE_PRODUCTS_KEY, null);
    if (Array.isArray(cached) && cached.length > 0) {
      products = [...cached];
    } else {
      products = [...MOCK_PRODUCTS];
    }
  }

  // Apply in-memory filtering (robust against missing Firestore composite indexes)
  if (options.categoryId && products.length > 0) {
    products = products.filter(p => p.categoryId === options.categoryId);
  }

  if (options.brand) {
    products = products.filter(p => p.brand.toLowerCase() === options.brand.toLowerCase());
  }

  if (options.inStockOnly) {
    products = products.filter(p => (p.stock || 0) > 0);
  }

  if (options.maxPrice) {
    products = products.filter(p => p.price <= options.maxPrice);
  }

  if (options.searchQuery) {
    const q = options.searchQuery.toLowerCase().trim();
    products = products.filter(p => 
      p.name.toLowerCase().includes(q) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  }

  // Apply sorting
  switch (options.sortBy) {
    case 'price-low':
      products.sort((a, b) => a.price - b.price);
      break;
    case 'price-high':
      products.sort((a, b) => b.price - a.price);
      break;
    case 'rating':
      products.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      break;
    case 'newest':
      products.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0);
      });
      break;
    case 'bestseller':
      products.sort((a, b) => (b.isBestseller ? 1 : 0) - (a.isBestseller ? 1 : 0));
      break;
    default:
      // 'featured' / default: prioritize newly added/custom products, then featured and bestsellers
      products.sort((a, b) => {
        // Newly created items (e.g. from admin) go directly to the top
        const aIsNewCustom = (a.createdAt && String(a.id || '').startsWith('prod-') && !String(a.id).startsWith('prod-10'));
        const bIsNewCustom = (b.createdAt && String(b.id || '').startsWith('prod-') && !String(b.id).startsWith('prod-10'));
        if (aIsNewCustom !== bIsNewCustom) return bIsNewCustom ? 1 : -1;

        if (aIsNewCustom && bIsNewCustom && a.createdAt && b.createdAt) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }

        const aScore = ((a.isFeatured || a.featured || a.isBestseller || a.isNew) ? 1 : 0);
        const bScore = ((b.isFeatured || b.featured || b.isBestseller || b.isNew) ? 1 : 0);
        return bScore - aScore;
      });
      break;
  }

  return products;
}

/**
 * Get a single product by ID
 * @param {string} productId
 * @returns {Promise<Object|null>}
 */
export async function getProductById(productId) {
  if (isConfigured && db) {
    try {
      const docRef = doc(db, 'products', productId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() };
      }
    } catch (err) {
      console.warn('[Devshree] Error reading product by ID from Firestore:', err);
    }
  }

  // Check cached products in localStorage (which includes admin additions)
  const cached = getStorage(CACHE_PRODUCTS_KEY, []);
  if (Array.isArray(cached) && cached.length > 0) {
    const found = cached.find(p => String(p.id) === String(productId));
    if (found) return found;
  }

  return MOCK_PRODUCTS.find(p => String(p.id) === String(productId)) || null;
}

/**
 * Check if the Cloud Firestore catalog is currently seeded
 * @returns {Promise<boolean>}
 */
export async function isCatalogSeeded() {
  if (!isConfigured || !db) return false;
  try {
    const colRef = collection(db, 'products');
    const snap = await getDocs(colRef);
    return !snap.empty;
  } catch (err) {
    console.warn('[Devshree] Failed checking catalog seed status:', err);
    return false;
  }
}

/**
 * Seed initial 4 categories & catalog products into Cloud Firestore
 * Safe and idempotent: writes each document with its defined key
 * @returns {Promise<{categoriesCount: number, productsCount: number}>}
 */
export async function seedFirestoreCatalog() {
  if (!isConfigured || !db) {
    showToast('Catalog database service is initializing. Running in offline demo mode.', 'info');
    throw new Error('Database service not initialized');
  }

  showToast('Starting catalog sync to Cloud Firestore...', 'info');

  try {
    // 1. Seed the 4 Categories
    let catCount = 0;
    for (const cat of MOCK_CATEGORIES) {
      const catDoc = {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        productCount: cat.productCount,
        badgeClass: cat.badgeClass,
        updatedAt: serverTimestamp()
      };
      await setDoc(doc(db, 'categories', cat.id), catDoc, { merge: true });
      catCount++;
    }

    // 2. Seed the Catalog Products
    let prodCount = 0;
    for (const prod of MOCK_PRODUCTS) {
      const prodDoc = {
        name: prod.name,
        slug: prod.slug,
        sku: prod.sku,
        categoryId: prod.categoryId,
        categoryName: prod.categoryName,
        brand: prod.brand,
        price: prod.price,
        compareAtPrice: prod.compareAtPrice,
        stock: prod.stock,
        featured: prod.featured || false,
        isBestseller: prod.isBestseller || false,
        isNew: prod.isNew || false,
        rating: prod.rating || 4.5,
        reviewCount: prod.reviewCount || 10,
        image: prod.image,
        description: prod.description,
        specifications: prod.specifications || {},
        updatedAt: serverTimestamp()
      };
      await setDoc(doc(db, 'products', prod.id), prodDoc, { merge: true });
      prodCount++;
    }

    // Cache locally
    setStorage(CACHE_CATEGORIES_KEY, MOCK_CATEGORIES);
    setStorage(CACHE_PRODUCTS_KEY, MOCK_PRODUCTS);

    showToast(`Success! Synced ${catCount} categories and ${prodCount} products to Firestore!`, 'success');
    return { categoriesCount: catCount, productsCount: prodCount };
  } catch (err) {
    showSafeErrorToast(err, 'Unable to sync catalog at this time. Please try again.');
    throw err;
  }
}

/**
 * Add a new product (Admin Functionality)
 * @param {Object} productData
 * @returns {Promise<Object>}
 */
export async function createProductInFirestore(productData) {
  if (!isConfigured || !db) {
    throw new Error('Firebase must be configured to create products.');
  }

  const newId = `prod-${Date.now()}`;
  const payload = {
    ...productData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(doc(db, 'products', newId), payload);
  showToast(`Product "${productData.name}" added to catalog!`, 'success');
  return { id: newId, ...payload };
}
