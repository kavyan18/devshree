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
import { 
  getSupabaseClient, 
  isSupabaseConfigured, 
  getPublicStorageUrl 
} from './supabase-config.js';
import { MOCK_CATEGORIES, MOCK_PRODUCTS } from './mock-data.js';
import { showToast, getStorage, setStorage } from './utils.js';
import { showSafeErrorToast } from './error-handler.js';

const CACHE_PRODUCTS_KEY = 'devshree_cached_products';
const CACHE_CATEGORIES_KEY = 'devshree_cached_categories';

/**
 * Fetch the 4 main product categories
 * Reads from Supabase PostgreSQL first, then Cloud Firestore, then local storage / mock data
 * Optimized with 0ms local cache return & 1.5s network timeout to prevent egress throttling stalls
 * @returns {Promise<Array>}
 */
export async function fetchCategories() {
  // 0. Instant Cache Return (0ms speed!)
  const cached = getStorage(CACHE_CATEGORIES_KEY, null);
  if (Array.isArray(cached) && cached.length >= 5) {
    // If we have cached categories, return immediately so navigation paints in 0ms
    // Revalidate in background asynchronously without blocking page render
    setTimeout(async () => {
      if (isSupabaseConfigured) {
        try {
          const client = await getSupabaseClient();
          if (client) {
            const queryPromise = client.from('categories').select('*').order('name');
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1500));
            const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
            if (!error && Array.isArray(data) && data.length > 0) {
              const formatted = data.map(c => ({
                id: c.id,
                name: c.name,
                slug: c.slug,
                description: c.description,
                imageUrl: c.image_url,
                badgeClass: c.id.replace('cat-', '')
              }));
              setStorage(CACHE_CATEGORIES_KEY, formatted);
            }
          }
        } catch (_) { }
      }
    }, 100);
    return cached;
  }

  // 1. Primary: Supabase PostgreSQL (with 1.5s timeout)
  if (isSupabaseConfigured) {
    try {
      const client = await getSupabaseClient();
      if (client) {
        const queryPromise = client.from('categories').select('*').order('name');
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Supabase fetchCategories timeout (egress throttled)')), 1500)
        );
        const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
        if (!error && Array.isArray(data) && data.length > 0) {
          const formatted = data.map(c => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            description: c.description,
            imageUrl: c.image_url,
            badgeClass: c.id.replace('cat-', '')
          }));
          setStorage(CACHE_CATEGORIES_KEY, formatted);
          return formatted;
        }
      }
    } catch (sbErr) {
      console.warn('[Devshree] Supabase fetchCategories fallback:', sbErr.message || sbErr);
    }
  }

  // 2. Cloud Firestore
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

  // 3. Fallback to local storage cache or mock data
  return getStorage(CACHE_CATEGORIES_KEY, MOCK_CATEGORIES);
}

/**
 * Fetch products with dynamic filtering and sorting
 * Reads from Supabase PostgreSQL first, falls back to Cloud Firestore and localStorage
 * Optimized with 1.8s timeout & pagination limit safeguard (zero-leak egress protection)
 * @param {Object} options
 * @param {string} [options.categoryId]
 * @param {string} [options.subcategoryId]
 * @param {string} [options.brand]
 * @param {string} [options.searchQuery]
 * @param {string} [options.sortBy] - 'featured'|'price-low'|'price-high'|'rating'|'bestseller'|'newest'
 * @param {boolean} [options.inStockOnly]
 * @param {number} [options.maxPrice]
 * @param {number} [options.limit] - Max items to fetch (defaults to 100 to prevent unbounded egress)
 * @param {number} [options.offset] - Pagination offset (0-based)
 * @returns {Promise<Array>}
 */
export async function fetchProducts(options = {}) {
  let fetchedProducts = [];
  const deletedIds = new Set((getStorage('devshree_deleted_product_ids', []) || []).map(String));

  // 1. Primary: Supabase PostgreSQL (fast query + Cloudflare CDN images with 1.8s timeout)
  if (isSupabaseConfigured) {
    try {
      const client = await getSupabaseClient();
      if (client) {
        let q = client.from('products').select('*');
        if (options.categoryId && options.categoryId !== 'all') {
          if (options.categoryId === 'cat-electric' || options.categoryId === 'cat-electrical') {
            q = q.in('category_id', ['cat-electric', 'cat-electrical']);
          } else {
            q = q.eq('category_id', options.categoryId);
          }
        }

        // Pagination & limit safeguard (prevents downloading massive unbound datasets)
        if (options.limit && Number.isInteger(options.limit) && options.limit > 0) {
          const from = options.offset || 0;
          q = q.range(from, from + options.limit - 1);
        } else {
          // Default safeguard: max 100 products per initial query
          q = q.limit(100);
        }

        // Race timeout: if Supabase egress is currently throttled, do NOT hang the browser!
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Supabase products query timed out (1.8s) - falling back to cache')), 1800)
        );
        const { data, error } = await Promise.race([q, timeoutPromise]);

        if (!error && Array.isArray(data) && data.length > 0) {
          data.forEach(d => {
            if (deletedIds.has(String(d.id))) return;
            const img = d.image_url || d.image || 'assets/images/placeholder.webp';
            fetchedProducts.push({
              id: d.id,
              name: d.name,
              categoryId: d.category_id,
              subcategoryId: d.subcategory_id || null,
              subcategoryName: d.subcategory_name || null,
              brand: d.brand || 'Devshree',
              sku: d.sku || '',
              description: d.description || '',
              price: Number(d.price),
              compareAtPrice: d.compare_at_price ? Number(d.compare_at_price) : undefined,
              basePrice: d.base_price ? Number(d.base_price) : undefined,
              discountPercentage: d.discount_percentage ? Number(d.discount_percentage) : undefined,
              gstRate: Number(d.gst_rate || 18),
              stock: Number(d.stock || 0),
              isInStock: Boolean(d.is_in_stock),
              isFeatured: Boolean(d.is_featured),
              featured: Boolean(d.is_featured),
              isBestseller: Boolean(d.is_bestseller),
              isNew: Boolean(d.is_new),
              rating: Number(d.rating || 4.8),
              reviewCount: Number(d.review_count || 1),
              image: img,
              imageUrl: d.image_url || img,
              createdAt: d.created_at,
              updatedAt: d.updated_at
            });
          });
        }
      }
    } catch (sbErr) {
      console.warn('[Devshree] Supabase fetchProducts notice, falling back:', sbErr);
    }
  }

  // 2. Secondary fallback: Cloud Firestore
  if (fetchedProducts.length === 0 && isConfigured && db) {
    try {
      const colRef = collection(db, 'products');
      let q = colRef;
      if (options.categoryId) {
        q = query(colRef, where('categoryId', '==', options.categoryId));
      }

      const snap = await getDocs(q);
      if (!snap.empty) {
        snap.forEach(d => {
          if (deletedIds.has(String(d.id))) return;
          const data = d.data();
          let createdAt = data.createdAt;
          if (createdAt && typeof createdAt.toDate === 'function') {
            createdAt = createdAt.toDate().toISOString();
          }
          fetchedProducts.push({ id: d.id, ...data, ...(createdAt ? { createdAt } : {}) });
        });
      }
    } catch (err) {
      console.warn('[Devshree] Error fetching products from Firestore, using fallback:', err);
    }
  }

  // Combine database products, local storage cache, and fallback into a complete catalog
  const catalogMap = new Map();

  if (fetchedProducts.length > 0) {
    // Live database products are authoritative — never pollute with demo products
    fetchedProducts.forEach(p => {
      if (!deletedIds.has(String(p.id))) {
        catalogMap.set(String(p.id), p);
      }
    });
  } else {
    // Cached items from admin / localStorage when database is offline or loading
    const cached = getStorage(CACHE_PRODUCTS_KEY, null);
    if (Array.isArray(cached) && cached.length > 0) {
      cached.forEach(p => {
        if (!deletedIds.has(String(p.id))) {
          catalogMap.set(String(p.id), p);
        }
      });
    } else {
      // Fallback to mock products ONLY if both databases and local storage are completely empty
      MOCK_PRODUCTS.forEach(p => {
        if (!deletedIds.has(String(p.id))) {
          catalogMap.set(String(p.id), p);
        }
      });
    }
  }

  let products = Array.from(catalogMap.values());

  if (!options.categoryId && products.length > 0) {
    setStorage(CACHE_PRODUCTS_KEY, products);
  }

  // Apply in-memory filtering (robust against missing Firestore composite indexes)
  if (options.categoryId && products.length > 0) {
    const targetCat = options.categoryId;
    products = products.filter(p => {
      const pCat = p.categoryId || p.category_id || '';
      if (pCat === targetCat) return true;
      if ((targetCat === 'cat-electric' || targetCat === 'cat-electrical') && (pCat === 'cat-electric' || pCat === 'cat-electrical')) return true;
      return false;
    });
  }

  if (options.subcategoryId && options.subcategoryId !== 'all' && products.length > 0) {
    const targetSub = String(options.subcategoryId).toLowerCase();

    // Intelligent subcategory keywords lookup for auto-categorization fallback
    const subcatKeywords = {
      'subcat-hw-handles': ['handle', 'knob', 'mortice', 'mortise'],
      'subcat-hw-aldrops': ['aldrop', 'latch', 'tower bolt', 'bed fitting'],
      'subcat-hw-hinges': ['hinge', 'butt hinge', 'bearing'],
      'subcat-hw-locks': ['lock', 'padlock', 'cylindrical', 'lever'],
      'subcat-hw-closers': ['closer', 'spring', 'floor spring'],
      'subcat-hw-fasteners': ['nail', 'screw', 'fastener', 'spanner', 'pepar', 'gaindar'],
      'subcat-hw-drawer': ['tandam', 'drawer', 'channel', 'tandem', 'bracket'],
      'subcat-el-switches': ['switch', 'socket', 'coral'],
      'subcat-el-wires': ['wire', 'cable', 'copper', 'coil'],
      'subcat-el-lighting': ['bulb', 'led', 'lamp', 'panel', 'light'],
      'subcat-el-mcb': ['mcb', 'distribution', 'breaker', 'rccb'],
      'subcat-el-conduit': ['conduit', 'pvc pipe'],
      'subcat-el-accessories': ['holder', 'plug', 'accessory', 'board'],
      'subcat-pl-pipes': ['pipe', 'elbow', 'upvc', 'cpvc'],
      'subcat-pl-valves': ['valve', 'nrv', 'ball valve'],
      'subcat-pl-taps': ['cock', 'tap', 'bib', 'angel cock'],
      'subcat-pl-sanitary': ['basin', 'sanitary', 'faucet'],
      'subcat-pl-cements': ['cement', 'solvent', 'teflon', 'white cement'],
      'subcat-pl-drainage': ['waste', 'trap', 'drain'],
      'subcat-pa-interior': ['emulsion', 'putty', 'stainer', 'white putty'],
      'subcat-pa-exterior': ['exterior', 'weatherproof', 'apex'],
      'subcat-pa-primers': ['primer', 'putty', 'undercoat'],
      'subcat-pa-enamels': ['enamel', 'metal primer'],
      'subcat-pa-wood': ['wood', 'melamyne', 'stain'],
      'subcat-pa-tools': ['brush', 'roller', 'painting tool'],
      'subcat-la-decorative': ['laminate', 'mica', 'prelam', 'sheet'],
      'subcat-la-acrylic': ['acrylic', 'high gloss', 'mirror'],
      'subcat-la-edgeband': ['edgeband', 'tape', 'trim', 'biding'],
      'subcat-la-pvc': ['pvc', 'charcoal', 'panel'],
      'subcat-la-adhesives': ['fevicol', 'adhesive', 'glue', 'sr glue']
    };

    const keywords = subcatKeywords[targetSub] || [];

    products = products.filter(p => {
      const pSubId = String(p.subcategoryId || p.subcategory_id || '').toLowerCase();
      const pSubName = String(p.subcategoryName || p.subcategory_name || '').toLowerCase();
      if (pSubId === targetSub || pSubName === targetSub || pSubName.includes(targetSub)) {
        return true;
      }
      // Fallback matching against product name & description
      const pText = (p.name + ' ' + (p.description || '')).toLowerCase();
      return keywords.some(k => pText.includes(k));
    });
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
 * Synchronously retrieves all available products from local cache or default seeds.
 * Excludes any product IDs marked as deleted by the admin.
 * @returns {Array<Object>}
 */
export function getAllAvailableProducts() {
  const deletedIds = new Set((getStorage('devshree_deleted_product_ids', []) || []).map(String));
  const combinedMap = new Map();
  try {
    const cached = getStorage('devshree_cached_products', null);
    if (Array.isArray(cached) && cached.length > 0) {
      cached.forEach(p => {
        if (!deletedIds.has(String(p.id))) combinedMap.set(String(p.id), p);
      });
      return Array.from(combinedMap.values());
    }
  } catch (_) {}

  // Only fall back to MOCK_PRODUCTS if cache is completely empty
  MOCK_PRODUCTS.forEach(p => {
    if (!deletedIds.has(String(p.id))) combinedMap.set(String(p.id), p);
  });
  return Array.from(combinedMap.values());
}

/**
 * Get a single product by ID
 * Checks Supabase PostgreSQL first, then Firestore, then localStorage, then mock
 * @param {string} productId
 * @returns {Promise<Object|null>}
 */
export async function getProductById(productId) {
  const deletedIds = new Set((getStorage('devshree_deleted_product_ids', []) || []).map(String));
  if (deletedIds.has(String(productId))) {
    return null;
  }

  // 1. Supabase PostgreSQL (with 1.5s timeout to prevent throttled hangs)
  if (isSupabaseConfigured) {
    try {
      const client = await getSupabaseClient();
      if (client) {
        const queryPromise = client.from('products').select('*').eq('id', productId).maybeSingle();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Supabase getProductById timeout (1.5s)')), 1500)
        );
        const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
        if (!error && data) {
          const img = data.image_url || data.image || 'assets/images/placeholder.webp';
          return {
            id: data.id,
            name: data.name,
            categoryId: data.category_id,
            brand: data.brand || 'Devshree',
            sku: data.sku || '',
            description: data.description || '',
            price: Number(data.price),
            compareAtPrice: data.compare_at_price ? Number(data.compare_at_price) : undefined,
            basePrice: data.base_price ? Number(data.base_price) : undefined,
            discountPercentage: data.discount_percentage ? Number(data.discount_percentage) : undefined,
            gstRate: Number(data.gst_rate || 18),
            stock: Number(data.stock || 0),
            isInStock: Boolean(data.is_in_stock),
            isFeatured: Boolean(data.is_featured),
            featured: Boolean(data.is_featured),
            isBestseller: Boolean(data.is_bestseller),
            isNew: Boolean(data.is_new),
            rating: Number(data.rating || 4.8),
            reviewCount: Number(data.review_count || 1),
            image: img,
            imageUrl: data.image_url || img,
            createdAt: data.created_at,
            updatedAt: data.updated_at
          };
        }
      }
    } catch (sbErr) {
      console.warn('[Devshree] Supabase getProductById notice:', sbErr);
    }
  }

  // 2. Cloud Firestore
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

  // 3. Check cached products in localStorage (which includes admin additions)
  const cached = getStorage(CACHE_PRODUCTS_KEY, []);
  if (Array.isArray(cached) && cached.length > 0) {
    const found = cached.find(p => String(p.id) === String(productId));
    if (found && !deletedIds.has(String(found.id))) return found;
  }

  // 4. Fallback to MOCK_PRODUCTS so product detail pages always resolve
  return MOCK_PRODUCTS.find(p => String(p.id) === String(productId) && !deletedIds.has(String(p.id))) || null;
}

/**
 * Add or update a product in Supabase PostgreSQL (Admin Functionality)
 * @param {Object} productData
 * @returns {Promise<Object>}
 */
export async function saveProductToSupabase(productData) {
  const client = await getSupabaseClient();
  if (!client) throw new Error('Supabase client is not available');

  const targetId = productData.id || `prod-${Date.now()}`;
  const nowIso = new Date().toISOString();

  const row = {
    id: targetId,
    name: productData.name,
    category_id: productData.categoryId || productData.category_id || 'cat-hardware',
    subcategory_id: productData.subcategoryId || productData.subcategory_id || null,
    subcategory_name: productData.subcategoryName || productData.subcategory_name || null,
    brand: productData.brand || 'Devshree',
    sku: productData.sku || '',
    description: productData.description || '',
    price: Number(productData.price),
    compare_at_price: productData.compareAtPrice ? Number(productData.compareAtPrice) : null,
    base_price: productData.basePrice ? Number(productData.basePrice) : null,
    discount_percentage: productData.discountPercentage ? Number(productData.discountPercentage) : null,
    gst_rate: Number(productData.gstRate || 18),
    stock: Number(productData.stock || 0),
    is_in_stock: productData.isInStock !== undefined ? Boolean(productData.isInStock) : true,
    is_featured: Boolean(productData.isFeatured || productData.featured),
    is_bestseller: Boolean(productData.isBestseller),
    is_new: Boolean(productData.isNew),
    rating: Number(productData.rating || 4.8),
    review_count: Number(productData.reviewCount || 1),
    image_url: productData.imageUrl || productData.image || '',
    image: productData.imageUrl || productData.image || '',
    updated_at: nowIso
  };

  const { error } = await client.from('products').upsert(row);
  if (error) {
    console.error('[Devshree] Supabase product upsert error:', error);
    throw error;
  }

  return { id: targetId, ...productData };
}

/**
 * Delete a product from Supabase PostgreSQL (Admin Functionality)
 * @param {string} productId
 */
export async function deleteProductFromSupabase(productId) {
  const client = await getSupabaseClient();
  if (!client) return;
  const { error } = await client.from('products').delete().eq('id', productId);
  if (error) {
    console.warn('[Devshree] Supabase product delete error:', error);
  }
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
    showToast('Database connection is initializing or offline. Please refresh the page.', 'warning');
    throw new Error('Database connection not established');
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
        rating: 0,
        reviewCount: 0,
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

  const targetId = productData.id || `prod-${Date.now()}`;
  const payload = {
    ...productData,
    id: targetId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(doc(db, 'products', targetId), payload, { merge: true });
  showToast(`Product "${productData.name}" synced to Cloud database!`, 'success');
  return { id: targetId, ...payload };
}
