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
  const event = new CustomEvent('devshree:cart-updated', {
    detail: { cart, count, totals }
  });
  window.dispatchEvent(event);
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

  const stockLimit = (typeof product.stock === 'number' && !isNaN(product.stock))
    ? product.stock
    : (parseInt(product.stock, 10) || 99);

  if (stockLimit <= 0) {
    showToast(`Sorry, ${product.name} is currently out of stock.`, 'error');
    return false;
  }

  const cart = getCart();
  const existingIndex = cart.findIndex(item => String(item.productId) === String(productId));

  let newQuantity = quantity;
  if (existingIndex > -1) {
    newQuantity = (cart[existingIndex].quantity || 0) + quantity;
  }

  // Stock check
  if (newQuantity > stockLimit) {
    showToast(`Only ${stockLimit} units available in stock.`, 'error');
    return false;
  }

  const cleanSnapshot = {
    id: product.id || String(productId),
    name: product.name || 'Product',
    price: Number(product.price) || 0,
    compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null,
    image: product.image || '',
    brand: product.brand || 'Devshree',
    stock: stockLimit,
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

  const maxStock = item.productSnapshot?.stock || 999;
  if (newQuantity > maxStock) {
    showToast(`Maximum available stock is ${maxStock}.`, 'error');
    newQuantity = maxStock;
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
 * Calculate totals for cart
 * @returns {{subtotal: number, shipping: number, freeShippingThreshold: number, total: number}}
 */
export function getCartTotals() {
  const cart = getCart();
  const subtotal = cart.reduce((sum, item) => {
    const price = item.productSnapshot?.price || 0;
    return sum + (price * item.quantity);
  }, 0);

  const freeShippingThreshold = 1999;
  const shipping = subtotal === 0 ? 0 : (subtotal >= freeShippingThreshold ? 0 : 149);
  const total = subtotal + shipping;

  return {
    subtotal,
    shipping,
    freeShippingThreshold,
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
