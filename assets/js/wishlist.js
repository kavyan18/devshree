/**
 * DEVSHREE — WISHLIST MODULE
 * Manages customer saved items and syncs with header counter.
 */

import { getStorage, setStorage, showToast } from './utils.js';
import { MOCK_PRODUCTS } from './mock-data.js';

const STORAGE_KEY = 'devshree_wishlist';

/**
 * Get wishlist product IDs
 * @returns {string[]}
 */
export function getWishlist() {
  return getStorage(STORAGE_KEY, []);
}

/**
 * Check if a product is in wishlist
 * @param {string} productId
 * @returns {boolean}
 */
export function isInWishlist(productId) {
  const wishlist = getWishlist();
  return wishlist.includes(productId);
}

/**
 * Toggle product in wishlist
 * @param {string} productId
 * @returns {boolean} true if added, false if removed
 */
export function toggleWishlist(productId) {
  let wishlist = getWishlist();
  const index = wishlist.indexOf(productId);
  let isAdded = false;

  const cached = getStorage('devshree_cached_products', []);
  const product = (Array.isArray(cached) && cached.find(p => String(p.id) === String(productId))) || MOCK_PRODUCTS.find(p => String(p.id) === String(productId));
  const productName = product ? product.name : 'Product';

  if (index > -1) {
    wishlist.splice(index, 1);
    isAdded = false;
    showToast(`Removed "${productName}" from wishlist.`, 'info');
  } else {
    wishlist.push(productId);
    isAdded = true;
    showToast(`Added "${productName}" to wishlist!`, 'success');
  }

  setStorage(STORAGE_KEY, wishlist);

  // Dispatch event for UI
  const event = new CustomEvent('devshree:wishlist-updated', {
    detail: { wishlist, count: wishlist.length, productId, isAdded }
  });
  window.dispatchEvent(event);

  return isAdded;
}

/**
 * Get total number of wishlist items
 * @returns {number}
 */
export function getWishlistCount() {
  return getWishlist().length;
}

/**
 * Initialize header wishlist badge listener
 */
export function initWishlistBadge() {
  const updateBadge = () => {
    const count = getWishlistCount();
    const badges = document.querySelectorAll('[data-wishlist-count]');
    badges.forEach(badge => {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    });

    // Also update any heart icons on active cards
    const buttons = document.querySelectorAll('[data-wishlist-btn]');
    buttons.forEach(btn => {
      const pid = btn.dataset.productId;
      if (pid) {
        if (isInWishlist(pid)) {
          btn.classList.add('active');
          btn.setAttribute('aria-label', 'Remove from wishlist');
        } else {
          btn.classList.remove('active');
          btn.setAttribute('aria-label', 'Add to wishlist');
        }
      }
    });
  };

  window.addEventListener('devshree:wishlist-updated', updateBadge);
  updateBadge();
}
