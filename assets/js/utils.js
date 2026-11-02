/**
 * DEVSHREE — UTILITY MODULE
 * Helper functions for formatting, security, storage, and UI toasts.
 */

/**
 * Format numbers as Indian Rupee currency (e.g. ₹1,299 or ₹1,50,000)
 * @param {number} amount
 * @returns {string}
 */
export function formatINR(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return '₹0';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Calculate percentage discount between selling price and original price
 * @param {number} price
 * @param {number} compareAtPrice
 * @returns {number}
 */
export function calculateDiscount(price, compareAtPrice, discountPercentage = null) {
  if (discountPercentage != null && discountPercentage > 0) {
    return Math.round(discountPercentage);
  }
  if (!compareAtPrice || compareAtPrice <= price) return 0;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}

/**
 * Escape HTML to protect against XSS when rendering user or API text
 * @param {string} str
 * @returns {string}
 */
export function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Safe LocalStorage getter with JSON parsing
 * @param {string} key
 * @param {any} defaultValue
 * @returns {any}
 */
export function getStorage(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (err) {
    console.warn(`[Devshree] Storage read error for "${key}":`, err);
    return defaultValue;
  }
}

/**
 * Safe LocalStorage setter with JSON serialization
 * @param {string} key
 * @param {any} value
 */
export function setStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[Devshree] Storage write error for "${key}":`, err);
  }
}

/**
 * Display toast notification to the user
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 * @param {number} duration in ms (strictly 1 to 2 seconds)
 */
export function showToast(message, type = 'success', duration = 1800) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  // Prevent unbounded stacking: keep at most 2-3 active toasts
  while (container.children.length >= 3) {
    const oldest = container.firstElementChild;
    if (oldest) oldest.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('title', 'Click to dismiss');

  const iconSvg = type === 'success' 
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`
    : type === 'error'
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

  toast.innerHTML = `
    <span style="display:flex;align-items:center;flex-shrink:0;">${iconSvg}</span>
    <span style="flex:1;">${escapeHTML(message)}</span>
    <button type="button" class="toast-close-btn" aria-label="Dismiss">&times;</button>
  `;

  container.appendChild(toast);

  // Trigger enter animation
  requestAnimationFrame(() => {
    toast.classList.add('toast-show');
  });

  // Reliable dismissal helper
  let isDismissed = false;
  const dismissToast = () => {
    if (isDismissed || toast.dataset.dismissing === 'true') return;
    isDismissed = true;
    toast.dataset.dismissing = 'true';
    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');

    const cleanup = () => {
      if (toast.parentNode) {
        toast.remove();
      }
    };

    toast.addEventListener('transitionend', cleanup, { once: true });
    // Guaranteed fallback removal if transitionend does not fire
    setTimeout(cleanup, 220);
  };

  // Click on toast or close button to dismiss immediately
  toast.addEventListener('click', dismissToast);

  // Strict 1-2 second duration limit (default 1800ms)
  const effectiveDuration = Math.min(Math.max(Number(duration) || 1800, 1000), 2000);
  setTimeout(dismissToast, effectiveDuration);
}

if (typeof window !== 'undefined') {
  window.showToast = showToast;
}

/**
 * Debounce a callback function
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
export function debounce(fn, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
