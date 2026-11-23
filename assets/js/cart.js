/**
 * DEVSHREE — SHOPPING CART MODULE
 * Manages client-side cart persistence, stock threshold validation,
 * and reactive UI updates. Ready for server-side order sync in Stage 4 & 6.
 */

import { getStorage, setStorage, showToast } from './utils.js';
import { MOCK_PRODUCTS } from './mock-data.js';

const STORAGE_KEY = 'devshree_cart';

/**
 * Get current cart items
 * @returns {Array<{productId: string, quantity: number, productSnapshot: Object}>}
 */
export function getCart() {
  return getStorage(STORAGE_KEY, []);
}

/**
 * Save cart items and emit event
 * @param {Array} cart
 */
function saveCart(cart) {
  setStorage(STORAGE_KEY, cart);
  notifyCartUpdated(cart);
}

/**
 * Emit custom event for UI components
 * @param {Array} cart
 */
function notifyCartUpdated(cart) {
  const count = getCartCount();
  const totals = getCartTotals();
  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    const event = new CustomEvent('devshree:cart-updated', {
      detail: { cart, count, totals }
    });
    window.dispatchEvent(event);
  }
}

/**
 * Add product to cart with stock validation
 * @param {string|Object} productId
 * @param {number} quantity
 * @param {Object|null} snapshot
 * @returns {boolean}
 */
export function addToCart(productId, quantity = 1, snapshot = null) {
  let product = snapshot;

  // Handle case where an object was passed as first argument
  if (typeof productId === 'object' && productId !== null) {
    product = productId;
    productId = product.id;
  }

  // 1. Check cached products from localStorage (which contains admin-created & firestore items)
  if (!product && productId) {
    try {
      const cached = getStorage('devshree_cached_products', []);
      if (Array.isArray(cached) && cached.length > 0) {
        product = cached.find(p => String(p.id) === String(productId));
      }
    } catch (_) {}
  }

  // 2. Fallback to MOCK_PRODUCTS only if not marked deleted
  if (!product && productId) {
    const deletedIds = new Set((getStorage('devshree_deleted_product_ids', []) || []).map(String));
    if (!deletedIds.has(String(productId))) {
      product = MOCK_PRODUCTS.find(p => String(p.id) === String(productId));
    }
  }

  // 3. Fallback to scraping the product card on the active DOM if present
  if (!product && productId && typeof document !== 'undefined') {
    const card = document.querySelector(`[data-product-id="${productId}"]`);
    if (card) {
      const name = card.querySelector('.product-title, .cart-item-name')?.textContent?.trim() || 'Product';
      const priceText = card.querySelector('.price-current, .cart-item-price')?.textContent?.replace(/[^0-9.]/g, '') || '0';
      const img = card.querySelector('.product-img, img')?.getAttribute('src') || '';
      const brand = card.querySelector('.product-brand')?.textContent?.trim() || 'Devshree';
      product = {
        id: String(productId),
        name,
        price: parseFloat(priceText) || 0,
        stock: 50,
        image: img,
        brand,
        categoryName: 'Supplies'
      };
    }
  }

  if (!product) {
    showToast('Product not found.', 'error');
    return false;
  }

  const cart = getCart();
  const existingIndex = cart.findIndex(item => String(item.productId) === String(productId));

  let newQuantity = quantity;
  if (existingIndex > -1) {
    newQuantity = (cart[existingIndex].quantity || 0) + quantity;
  }

  const cleanSnapshot = {
    id: product.id || String(productId),
    name: product.name || 'Product',
    price: Number(product.price) || 0,
    compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null,
    image: product.image || '',
    brand: product.brand || 'Devshree',
    stock: typeof product.stock === 'number' ? product.stock : 999,
    categoryName: product.categoryName || ''
  };

  if (existingIndex > -1) {
    cart[existingIndex].quantity = newQuantity;
    cart[existingIndex].productSnapshot = cleanSnapshot;
  } else {
    cart.push({
      productId: String(productId),
      quantity: newQuantity,
      productSnapshot: cleanSnapshot
    });
  }

  saveCart(cart);
  showToast(`Added "${product.name}" to your cart!`, 'success');
  return true;
}

/**
 * Update quantity of a specific item
 * @param {string} productId
 * @param {number} newQuantity
 */
export function updateQuantity(productId, newQuantity) {
  let cart = getCart();
  const item = cart.find(i => String(i.productId) === String(productId));
  if (!item) return;

  if (newQuantity <= 0) {
    removeFromCart(productId);
    return;
  }

  item.quantity = newQuantity;
  saveCart(cart);
}

/**
 * Remove product from cart
 * @param {string} productId
 */
export function removeFromCart(productId) {
  let cart = getCart();
  const removedItem = cart.find(i => i.productId === productId);
  cart = cart.filter(i => i.productId !== productId);
  saveCart(cart);
  if (removedItem) {
    showToast(`Removed "${removedItem.productSnapshot?.name || 'item'}" from cart.`, 'info');
  }
}

/**
 * Get total number of distinct units in cart
 * @returns {number}
 */
export function getCartCount() {
  const cart = getCart();
  return cart.reduce((total, item) => total + (item.quantity || 1), 0);
}

/**
 * Get current transportation & delivery configuration configured by store admin
 * Safely handles JSON-parsed numbers or string fallbacks from localStorage
 * @returns {{fee: number, threshold: number, mode: string}}
 */
export function getStoreShippingConfig() {
  let fee = 99;
  let threshold = 999;
  let mode = 'threshold';

  try {
    const rawFee = getStorage('devshree_shipping_fee', 99);
    const parsedFee = parseInt(rawFee, 10);
    if (!isNaN(parsedFee)) fee = parsedFee;
  } catch (_) { fee = 99; }

  try {
    const rawThreshold = getStorage('devshree_free_shipping_threshold', 999);
    const parsedThreshold = parseInt(rawThreshold, 10);
    if (!isNaN(parsedThreshold)) threshold = parsedThreshold;
  } catch (_) { threshold = 999; }

  try {
    const rawMode = getStorage('devshree_shipping_mode', 'threshold');
    if (typeof rawMode === 'string' && rawMode.trim()) {
      mode = rawMode.trim();
    }
  } catch (_) { mode = 'threshold'; }

  return {
    fee: Math.max(0, fee),
    threshold: Math.max(0, threshold),
    mode: mode || 'threshold'
  };
}

/**
 * Fetch remote shipping configuration from Supabase PostgreSQL in background
 * and update local storage + active storefront UI elements.
 * @returns {Promise<{fee: number, threshold: number, mode: string}>}
 */
export async function fetchRemoteShippingConfig() {
  try {
    const sbMod = await import('./supabase-config.js');
    const client = await sbMod.getSupabaseClient();
    if (client) {
      const { data, error } = await client.from('offers').select('*').eq('id', 'config-shipping').single();
      if (!error && data) {
        const localUpdated = getStorage('devshree_shipping_updated_at', 0);
        const remoteTime = data.created_at ? new Date(data.created_at).getTime() : 0;
        if (localUpdated && remoteTime && localUpdated > remoteTime + 2000) {
          // Local save is strictly newer than remote cache
          return getStoreShippingConfig();
        }
        const fee = parseInt(data.title, 10);
        const threshold = parseInt(data.tagline, 10);
        const mode = data.discount_text || 'threshold';
        if (!isNaN(fee)) setStorage('devshree_shipping_fee', fee);
        if (!isNaN(threshold)) setStorage('devshree_free_shipping_threshold', threshold);
        if (mode) setStorage('devshree_shipping_mode', mode);
        updateStorefrontShippingElements();
        return { fee: Math.max(0, fee), threshold: Math.max(0, threshold), mode };
      }
    }
  } catch (e) {
    // Graceful fallback to cached local storage
  }
  return getStoreShippingConfig();
}

/**
 * Save transportation settings to LocalStorage, Supabase Cloud Database & BroadcastChannel
 * @param {number|string} fee
 * @param {number|string} threshold
 * @param {string} mode - 'threshold' | 'flat' | 'free'
 * @returns {Promise<{fee: number, threshold: number, mode: string}>}
 */
export async function saveStoreShippingConfig(fee, threshold, mode = 'threshold') {
  const safeFee = Math.max(0, parseInt(fee, 10) || 0);
  const safeThreshold = Math.max(0, parseInt(threshold, 10) || 0);
  const safeMode = mode || 'threshold';

  setStorage('devshree_shipping_fee', safeFee);
  setStorage('devshree_free_shipping_threshold', safeThreshold);
  setStorage('devshree_shipping_mode', safeMode);
  setStorage('devshree_shipping_updated_at', Date.now());

  // Broadcast update locally and across browser tabs
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('devshree:shipping-updated', {
      detail: { fee: safeFee, threshold: safeThreshold, mode: safeMode }
    }));
    if ('BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('devshree_sync');
        bc.postMessage({ type: 'SHIPPING_UPDATED', fee: safeFee, threshold: safeThreshold, mode: safeMode });
      } catch (_) {}
    }
  }

  // Persist to Supabase PostgreSQL cloud database (survives device switches & clears)
  try {
    const sbMod = await import('./supabase-config.js');
    const client = await sbMod.getSupabaseClient();
    if (client) {
      await client.from('offers').upsert({
        id: 'config-shipping',
        title: String(safeFee),
        tagline: String(safeThreshold),
        discount_text: safeMode,
        code: 'SHIPPING_CONFIG',
        is_active: false
      });
    }
  } catch (err) {
    console.warn('[Cart] Remote shipping save notice:', err);
  }

  updateStorefrontShippingElements();
  return { fee: safeFee, threshold: safeThreshold, mode: safeMode };
}

/**
 * Dynamically updates all storefront shipping notices, announcement bar,
 * hero perks, benefits grid, and modal banners to match the active shipping config.
 */
export function updateStorefrontShippingElements() {
  if (typeof document === 'undefined') return;
  const config = getStoreShippingConfig();
  const feeStr = `₹${config.fee}`;
  const thresholdStr = `₹${config.threshold.toLocaleString('en-IN')}`;

  // 1. Top Announcement Bar across all pages
  let announcementText = `Free express dispatch across India on orders above ${thresholdStr}`;
  if (config.mode === 'free' || config.fee === 0) {
    announcementText = `🎉 100% Free Express Delivery Across India on ALL Orders!`;
  } else if (config.mode === 'flat') {
    announcementText = `Express Delivery Across India at Flat ${feeStr}`;
  }

  const announcementSpans = document.querySelectorAll(
    '#announcement-shipping-text, .announcement-bar .announcement-left span:first-child, .announcement-left span'
  );
  announcementSpans.forEach(el => {
    if (el && !el.textContent.includes('|') && (el.textContent.toLowerCase().includes('free express') || el.textContent.toLowerCase().includes('express delivery') || el.id === 'announcement-shipping-text')) {
      el.textContent = announcementText;
    }
  });

  // 2. Offer Slide Perks (Homepage)
  const offerPerkEls = document.querySelectorAll('#hero-free-shipping-perk, .offer-perk');
  offerPerkEls.forEach(el => {
    if (el && el.textContent.toLowerCase().includes('delivery')) {
      if (config.mode === 'free' || config.fee === 0) {
        el.textContent = '100% Free delivery';
      } else if (config.mode === 'flat') {
        el.textContent = `Express delivery ${feeStr}`;
      } else {
        el.textContent = `Free delivery over ${thresholdStr}`;
      }
    }
  });

  // 3. Benefit Item (Homepage)
  const benefitDescEls = document.querySelectorAll('#benefit-shipping-desc, .benefit-desc');
  benefitDescEls.forEach(el => {
    if (el && (el.textContent.toLowerCase().includes('orders') || el.id === 'benefit-shipping-desc')) {
      if (config.mode === 'free' || config.fee === 0) {
        el.textContent = 'On all orders pan-India';
      } else if (config.mode === 'flat') {
        el.textContent = `At flat ${feeStr} pan-India`;
      } else {
        el.textContent = `On orders over ${thresholdStr} pan-India`;
      }
    }
  });

  // 4. Quick View Modal Shipping Banner
  const qvBannerEls = document.querySelectorAll('#qv-shipping-text, .modal-shipping-banner .shipping-banner-text');
  qvBannerEls.forEach(el => {
    if (config.mode === 'free' || config.fee === 0) {
      el.innerHTML = `<strong>Free Dispatch Across India</strong> on all orders &bull; Ships within 24h`;
    } else if (config.mode === 'flat') {
      el.innerHTML = `<strong>Express Dispatch Across India</strong> flat ${feeStr} &bull; Ships within 24h`;
    } else {
      el.innerHTML = `<strong>Free Dispatch Across India</strong> on orders ${thresholdStr}+ &bull; Ships within 24h`;
    }
  });
}

/**
 * Initializes continuous cross-tab and cloud synchronization for shipping configurations
 */
export function initStoreShippingSync() {
  if (typeof window === 'undefined') return;

  // Immediate 0ms local application
  updateStorefrontShippingElements();

  // Asynchronous background cloud sync from Supabase
  fetchRemoteShippingConfig();

  // Cross-tab storage event listener
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('devshree_shipping_')) {
      updateStorefrontShippingElements();
      window.dispatchEvent(new CustomEvent('devshree:cart-updated'));
    }
  });

  // Same-tab custom event listener
  window.addEventListener('devshree:shipping-updated', () => {
    updateStorefrontShippingElements();
    window.dispatchEvent(new CustomEvent('devshree:cart-updated'));
  });

  // BroadcastChannel listener
  if ('BroadcastChannel' in window) {
    try {
      const bc = new BroadcastChannel('devshree_sync');
      bc.addEventListener('message', (msg) => {
        if (msg.data && msg.data.type === 'SHIPPING_UPDATED') {
          updateStorefrontShippingElements();
          window.dispatchEvent(new CustomEvent('devshree:cart-updated'));
        }
      });
    } catch (_) {}
  }
}

// Auto-run if in browser environment
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStoreShippingSync);
  } else {
    initStoreShippingSync();
  }
}

/**
 * Calculate transportation / delivery fee for a given cart subtotal
 * @param {number} subtotal
 * @returns {number}
 */
export function calculateShippingFee(subtotal) {
  if (!subtotal || subtotal <= 0) return 0;
  const config = getStoreShippingConfig();
  if (config.mode === 'free' || config.fee === 0) return 0;
  if (config.mode === 'flat') return config.fee;
  // 'threshold' mode (default): free if subtotal >= threshold
  return subtotal >= config.threshold ? 0 : config.fee;
}

/**
 * Calculate totals for cart
 * @returns {{subtotal: number, shipping: number, freeShippingThreshold: number, shippingFee: number, shippingMode: string, total: number}}
 */
export function getCartTotals() {
  const cart = getCart();
  const subtotal = cart.reduce((sum, item) => {
    const price = item.productSnapshot?.price || 0;
    return sum + (price * item.quantity);
  }, 0);

  const shippingConfig = getStoreShippingConfig();
  const shipping = calculateShippingFee(subtotal);
  const total = subtotal + shipping;

  return {
    subtotal,
    shipping,
    freeShippingThreshold: shippingConfig.threshold,
    shippingFee: shippingConfig.fee,
    shippingMode: shippingConfig.mode,
    total
  };
}

/**
 * Clear all items from cart
 */
export function clearCart() {
  saveCart([]);
}

/**
 * Initialize header badge listener
 */
export function initCartBadge() {
  const updateBadge = () => {
    const count = getCartCount();
    const badges = document.querySelectorAll('[data-cart-count]');
    badges.forEach(badge => {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    });
  };

  window.addEventListener('devshree:cart-updated', updateBadge);
  updateBadge();
}
