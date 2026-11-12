/**
 * DEVSHREE — HOMEPAGE CONTROLLER
 * Renders the 4 main categories, product showcases, quick view modal,
 * mini-cart slide-over drawer, reviews, search, and interactions.
 */

import { MOCK_CATEGORIES, MOCK_PRODUCTS, STORE_INFO } from './mock-data.js';
import { formatINR, calculateDiscount, escapeHTML, showToast, getStorage, setStorage } from './utils.js';
import { renderCustomerFeedback, initFeedbackSystem, openFeedbackModal } from './feedback.js';
import { 
  addToCart, 
  getCart, 
  updateQuantity, 
  removeFromCart, 
  getCartCount, 
  getCartTotals, 
  clearCart, 
  initCartBadge 
} from './cart.js';
import { toggleWishlist, isInWishlist, getWishlistCount, initWishlistBadge } from './wishlist.js';
import { 
  registerCustomer, 
  loginCustomer, 
  loginWithGoogle, 
  logoutCustomer, 
  resetPassword, 
  getCurrentUser, 
  listenAuthState, 
  requireAuth, 
  openAuthModal, 
  closeAuthModal, 
  switchAuthTab,
  updateHeaderAuthUI,
  isAdminEmail,
  checkIsUserAdmin,
  notifyAuthChange
} from './auth.js';
import { 
  createOrderAndInvoice, 
  openUserInvoicesModal, 
  openInvoiceViewer,
  openOrderTrackingModal
} from './orders.js';
import { openCheckoutModal, closeCheckoutModal } from './checkout.js';
import { 
  fetchCategories, 
  fetchProducts, 
  getProductById, 
  seedFirestoreCatalog, 
  isCatalogSeeded 
} from './products.js';
import { setupOrderNotificationsListener } from './order-notifications.js';
import { 
  DEVSHREE_CATALOGS, 
  DEVSHREE_CATEGORIES, 
  getActiveCatalogs, 
  openPdfViewerModal, 
  closePdfViewerModal 
} from './catalogs-data.js';
import { 
  DEFAULT_OFFERS, 
  getActiveOffers 
} from './offers-data.js';

/**
 * Helper to get all available products combining localStorage cache (from admin / firestore) and mock data
 */
function getAllAvailableProducts() {
  const deletedIds = new Set((getStorage('devshree_deleted_product_ids', []) || []).map(String));
  try {
    const cached = getStorage('devshree_cached_products', null);
    if (Array.isArray(cached) && cached.length > 0) {
      const filtered = cached.filter(p => !deletedIds.has(String(p.id)));
      if (filtered.length > 0) return filtered;
    }
  } catch (_) {}
  return MOCK_PRODUCTS.filter(p => !deletedIds.has(String(p.id)));
}

/**
 * Handle mobile catalog synchronization via query string or hash
 */
function checkCatalogSyncUrl() {
  try {
    const url = new URL(window.location.href);
    const syncParam = url.searchParams.get('devshree_sync_catalog') || (url.hash.includes('devshree_sync_catalog=') ? new URLSearchParams(url.hash.substring(1)).get('devshree_sync_catalog') : null);
    if (syncParam) {
      const jsonStr = decodeURIComponent(escape(atob(syncParam)));
      const incomingProducts = JSON.parse(jsonStr);
      if (Array.isArray(incomingProducts) && incomingProducts.length > 0) {
        const existing = getStorage('devshree_cached_products', []);
        const map = new Map();
        existing.forEach(p => map.set(String(p.id), p));
        incomingProducts.forEach(p => map.set(String(p.id), p));
        const combined = Array.from(map.values());
        setStorage('devshree_cached_products', combined);
        showToast(`Store catalog synced! ${incomingProducts.length} product(s) added to your mobile store.`, 'success');

        url.searchParams.delete('devshree_sync_catalog');
        window.history.replaceState({}, document.title, url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : ''));
      }
    }
  } catch (err) {
    console.warn('[Devshree] Catalog sync parameter error:', err);
  }
}

let currentCatalogOptions = {
  categoryId: '',
  sortBy: 'featured',
  inStockOnly: false
};

async function initDevshreeHome() {
  checkCatalogSyncUrl();
  initHeaderAndNavigation();
  initSearchUI();
  initAuthUI();
  initTopCategoriesBar();
  initShopByCategoryRail();
  initOffersCarousel();
  await renderDealsRail();
  initHomeCatalogsCarousel();
  initSyncButton();
  renderCategories();
  renderProductSections();
  renderReviews();
  initFeedbackSystem();
  initQuickViewModal();
  initCartDrawer();
  initTrackingAndCheckoutModals();
  initNewsletterForm();
  initCartBadge();
  initWishlistBadge();
  setupOrderNotificationsListener();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDevshreeHome);
} else {
  initDevshreeHome();
}

/**
 * Initialize Header, Mobile Drawer, and Search
 */
function initHeaderAndNavigation() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const drawer = document.getElementById('mobile-drawer');
  const overlay = document.getElementById('mobile-drawer-overlay');
  const closeBtn = document.getElementById('mobile-drawer-close');

  const openDrawer = () => {
    drawer?.classList.add('active');
    overlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  const closeDrawer = () => {
    drawer?.classList.remove('active');
    overlay?.classList.remove('active');
    document.body.style.overflow = '';
  };

  menuBtn?.addEventListener('click', openDrawer);
  closeBtn?.addEventListener('click', closeDrawer);
  overlay?.addEventListener('click', closeDrawer);

  // Close mobile drawer when clicking a link
  drawer?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeDrawer);
  });

  // Search forms fallback
  const bindSearch = (formId) => {
    const form = document.getElementById(formId);
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input[type="search"]') || form.querySelector('input[name="q"]');
      const query = input?.value.trim();
      const catSelect = form.querySelector('select[name="category"]');
      const category = catSelect ? catSelect.value : '';

      if (!query && !category) {
        showToast('Please enter a product name, brand, or SKU to search.', 'info');
        return;
      }

      filterProductsByQuery(query, category);
    });
  };

  bindSearch('header-search-form');
  bindSearch('mobile-search-form');

  // Header wishlist button
  document.getElementById('header-wishlist-btn')?.addEventListener('click', () => {
    const count = getWishlistCount();
    if (count === 0) {
      showToast('Your wishlist is empty. Click the heart icon on any product to save it.', 'info');
    } else {
      showToast(`You have ${count} saved item(s) in your wishlist.`, 'info');
      document.getElementById('bestsellers-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  });
}

/**
 * Initialize Master Search Experience
 * Includes live debounced autocomplete, category switching, popular suggestions,
 * keyboard navigation (Esc, Ctrl+K), and highlight matching.
 */
function initSearchUI() {
  const form = document.getElementById('master-search-form');
  const input = document.getElementById('master-search-input');
  const catSelect = document.getElementById('search-cat-select');
  const catLabel = document.getElementById('search-cat-label');
  const clearBtn = document.getElementById('search-clear-btn');
  const dropdown = document.getElementById('search-dropdown-panel');
  const headerSearchToggle = document.getElementById('header-search-toggle-btn');
  const searchSection = document.getElementById('site-search-section');

  if (!input || !dropdown) return;

  // Sync category select label
  const updateCatLabel = () => {
    if (!catSelect || !catLabel) return;
    const selectedOption = catSelect.options[catSelect.selectedIndex];
    catLabel.textContent = selectedOption ? selectedOption.text.replace(/^[0-9.]+\s*/, '') : 'All Categories';
  };
  catSelect?.addEventListener('change', () => {
    updateCatLabel();
    renderLiveSuggestions(input.value.trim());
  });
  updateCatLabel();

  // Highlight matching text in string
  const highlightMatch = (text, query) => {
    if (!query) return escapeHTML(text);
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return escapeHTML(text).replace(regex, '<mark class="search-highlight">$1</mark>');
  };

  // Popular search items & category quick links for initial empty state
  const popularSearches = [
    { label: 'Godrej Brass Padlock', query: 'Brass Padlock', cat: 'cat-hardware' },
    { label: 'Havells Modular Switch', query: 'Modular Switch', cat: 'cat-electrical' },
    { label: 'Astral CPVC Pipe', query: 'CPVC', cat: 'cat-plumbing' },
    { label: 'Asian Paints Royale', query: 'Royale', cat: 'cat-paints' },
    { label: 'Anchor 16A Socket', query: 'Socket', cat: 'cat-electrical' },
    { label: 'Brass Ball Valve', query: 'Ball Valve', cat: 'cat-plumbing' }
  ];

  const quickCategories = [
    { id: 'cat-hardware', name: 'Hardware', count: '38 items', icon: '🔩' },
    { id: 'cat-electrical', name: 'Electrical', count: '42 items', icon: '⚡' },
    { id: 'cat-plumbing', name: 'Plumbing', count: '29 items', icon: '🚰' },
    { id: 'cat-paints', name: 'Paints', count: '34 items', icon: '🎨' }
  ];

  // Render initial discovery state (Popular tags + Categories)
  const renderDiscoveryState = () => {
    dropdown.innerHTML = `
      <div class="search-dropdown-inner">
        <div class="search-dropdown-section">
          <div class="search-dropdown-heading">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
            <span>Trending Searches</span>
          </div>
          <div class="search-tags-row">
            ${popularSearches.map(item => `
              <button type="button" class="search-tag-chip" data-search-tag="${escapeHTML(item.query)}" data-search-cat="${item.cat}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                  <polyline points="17 6 23 6 23 12"></polyline>
                </svg>
                <span>${escapeHTML(item.label)}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="search-dropdown-divider"></div>

        <div class="search-dropdown-section">
          <div class="search-dropdown-heading">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <span>Browse 4 Core Categories</span>
          </div>
          <div class="search-quick-cats-grid">
            ${quickCategories.map((c, idx) => `
              <button type="button" class="search-quick-cat-btn" data-category-filter="${c.id}">
                <span class="search-quick-cat-num">0${idx + 1}</span>
                <span class="search-quick-cat-icon">${c.icon}</span>
                <div class="search-quick-cat-info">
                  <span class="search-quick-cat-name">${escapeHTML(c.name)}</span>
                  <span class="search-quick-cat-count">${c.count}</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="search-dropdown-footer">
          <span>Pro tip: Press <kbd>Esc</kbd> to close &bull; <kbd>Ctrl+K</kbd> to search anytime</span>
        </div>
      </div>
    `;

    // Bind chip clicks
    dropdown.querySelectorAll('[data-search-tag]').forEach(btn => {
      btn.addEventListener('click', () => {
        const query = btn.dataset.searchTag;
        const cat = btn.dataset.searchCat || '';
        input.value = query;
        if (catSelect && cat) {
          catSelect.value = cat;
          updateCatLabel();
        }
        updateClearBtn();
        closeDropdown();
        filterProductsByQuery(query, cat);
      });
    });

    dropdown.querySelectorAll('[data-category-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        const catId = btn.dataset.categoryFilter;
        closeDropdown();
        setCatalogCategoryFilter(catId);
      });
    });
  };

  // Render live products matching query
  const renderLiveSuggestions = (query) => {
    const trimmed = (query || '').trim();
    const selectedCat = catSelect ? catSelect.value : '';

    if (!trimmed) {
      renderDiscoveryState();
      return;
    }

    const lowerQuery = trimmed.toLowerCase();
    const allProds = getAllAvailableProducts();
    const matched = allProds.filter(p => {
      const matchCat = !selectedCat || p.categoryId === selectedCat;
      const matchText = 
        p.name.toLowerCase().includes(lowerQuery) ||
        (p.brand && p.brand.toLowerCase().includes(lowerQuery)) ||
        (p.sku && p.sku.toLowerCase().includes(lowerQuery)) ||
        (p.description && p.description.toLowerCase().includes(lowerQuery));
      return matchCat && matchText;
    });

    if (matched.length === 0) {
      dropdown.innerHTML = `
        <div class="search-dropdown-inner">
          <div class="search-empty-state">
            <div class="search-empty-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
              </svg>
            </div>
            <h4>No products found for "${escapeHTML(trimmed)}"</h4>
            <p>Try searching with broader terms like <strong>Switch</strong>, <strong>Padlock</strong>, <strong>CPVC</strong>, or <strong>Paint</strong>.</p>
            ${selectedCat ? `<button type="button" class="btn btn-outline btn-sm" id="search-clear-cat-btn" style="margin-top:0.75rem;">Search All Categories Instead</button>` : ''}
          </div>
        </div>
      `;

      dropdown.querySelector('#search-clear-cat-btn')?.addEventListener('click', () => {
        if (catSelect) {
          catSelect.value = '';
          updateCatLabel();
          renderLiveSuggestions(input.value.trim());
        }
      });
      return;
    }

    const topMatches = matched.slice(0, 5);
    const catNameMap = {
      'cat-hardware': 'Hardware',
      'cat-electrical': 'Electrical',
      'cat-plumbing': 'Plumbing',
      'cat-paints': 'Paints'
    };

    dropdown.innerHTML = `
      <div class="search-dropdown-inner">
        <div class="search-results-header">
          <span class="search-results-count">
            Found <strong>${matched.length}</strong> product${matched.length === 1 ? '' : 's'}
            ${selectedCat ? `<span class="search-cat-active-pill">${catNameMap[selectedCat] || ''}</span>` : ''}
          </span>
          <span class="search-results-hint">Click item to view details</span>
        </div>

        <div class="search-results-list">
          ${topMatches.map(product => {
            return `
              <div class="search-result-row" data-product-id="${product.id}" tabindex="0">
                <div class="search-result-thumb">
                  <img src="${product.image}" alt="${escapeHTML(product.name)}" loading="lazy" />
                </div>
                <div class="search-result-body">
                  <div class="search-result-title">${highlightMatch(product.name, trimmed)}</div>
                  <div class="search-result-meta">
                    <span class="search-meta-brand">${escapeHTML(product.brand || '')}</span>
                    <span class="search-meta-bullet">&bull;</span>
                    <span class="search-meta-cat">${catNameMap[product.categoryId] || 'Devshree'}</span>
                    <span class="search-meta-bullet">&bull;</span>
                    <span class="search-meta-sku">SKU: ${escapeHTML(product.sku)}</span>
                  </div>
                </div>
                <div class="search-result-right">
                  <div class="search-result-price-box">
                    <span class="search-result-price">${formatINR(product.price)}</span>
                    ${product.compareAtPrice ? `<span class="search-result-orig-price">${formatINR(product.compareAtPrice)}</span>` : ''}
                  </div>
                  <button type="button" class="search-result-quick-add" data-quick-add-id="${product.id}" title="Add to cart" aria-label="Add to cart">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="search-dropdown-action-bar">
          <button type="button" class="search-see-all-btn" id="search-see-all-btn">
            <span>View all ${matched.length} product${matched.length === 1 ? '' : 's'} in catalog</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Row click -> opens Quick View modal
    dropdown.querySelectorAll('.search-result-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.search-result-quick-add')) return;
        const pid = row.dataset.productId;
        if (pid) {
          closeDropdown();
          openQuickView(pid);
        }
      });
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const pid = row.dataset.productId;
          if (pid) {
            closeDropdown();
            openQuickView(pid);
          }
        }
      });
    });

    // Quick add to cart button inside search row
    dropdown.querySelectorAll('[data-quick-add-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pid = btn.dataset.quickAddId;
        const allProds = getAllAvailableProducts();
        const p = allProds.find(item => String(item.id) === String(pid));
        if (p) {
          addToCart(p.id, 1, p);
          btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          `;
          btn.classList.add('added');
          setTimeout(() => {
            btn.innerHTML = `
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            `;
            btn.classList.remove('added');
          }, 1500);
        }
      });
    });

    // See all in catalog button
    dropdown.querySelector('#search-see-all-btn')?.addEventListener('click', () => {
      closeDropdown();
      filterProductsByQuery(trimmed, selectedCat);
    });
  };

  const openDropdown = () => {
    dropdown.style.display = 'block';
    dropdown.classList.add('active');
    input.setAttribute('aria-expanded', 'true');
    renderLiveSuggestions(input.value.trim());
  };

  const closeDropdown = () => {
    dropdown.classList.remove('active');
    dropdown.style.display = 'none';
    input.setAttribute('aria-expanded', 'false');
  };

  const updateClearBtn = () => {
    if (!clearBtn) return;
    clearBtn.style.display = input.value.trim() ? 'flex' : 'none';
  };

  let debounceTimer = null;
  input.addEventListener('input', () => {
    updateClearBtn();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      openDropdown();
    }, 120);
  });

  input.addEventListener('focus', () => {
    openDropdown();
  });

  clearBtn?.addEventListener('click', () => {
    input.value = '';
    updateClearBtn();
    input.focus();
    openDropdown();
  });

  // Close dropdown on click outside
  document.addEventListener('click', (e) => {
    if (!form.contains(e.target) && !dropdown.contains(e.target) && e.target !== headerSearchToggle) {
      closeDropdown();
    }
  });

  // Keyboard shortcut Ctrl+K or / to search
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      focusSearch();
    } else if (e.key === '/' && document.activeElement !== input && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      focusSearch();
    } else if (e.key === 'Escape' && dropdown.classList.contains('active')) {
      closeDropdown();
      input.blur();
    }
  });

  const focusSearch = () => {
    if (searchSection) {
      searchSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    input.focus();
    openDropdown();
    form.classList.add('search-spotlight-pulse');
    setTimeout(() => form.classList.remove('search-spotlight-pulse'), 1200);
  };

  headerSearchToggle?.addEventListener('click', (e) => {
    e.preventDefault();
    focusSearch();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = input.value.trim();
    const category = catSelect ? catSelect.value : '';
    closeDropdown();

    if (!query && !category) {
      showToast('Please enter a product name, brand, or SKU to search.', 'info');
      return;
    }

    filterProductsByQuery(query, category);
  });
}

/**
 * Filter products on the page according to search criteria
 */
function filterProductsByQuery(query, category) {
  const lowerQuery = (query || '').toLowerCase();
  const allProds = getAllAvailableProducts();
  const matched = allProds.filter(p => {
    const matchCat = !category || p.categoryId === category;
    const matchText = !query || 
      p.name.toLowerCase().includes(lowerQuery) ||
      p.brand.toLowerCase().includes(lowerQuery) ||
      p.sku.toLowerCase().includes(lowerQuery) ||
      p.description.toLowerCase().includes(lowerQuery);
    return matchCat && matchText;
  });

  // Sync category toolbar tab if category specified
  if (category) {
    currentCatalogOptions.categoryId = category;
    document.querySelectorAll('[data-catalog-cat]').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.catalogCat === category);
    });
  }

  const section = document.getElementById('bestsellers-grid');
  if (section) {
    if (matched.length === 0) {
      section.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; background: #FFF; border-radius: var(--radius-md); border: 1px dashed var(--color-border);">
          <p style="font-size: 1.1rem; color: var(--color-navy); font-weight: 600; margin-bottom: 0.5rem;">No products found matching "${escapeHTML(query)}"</p>
          <p style="color: var(--color-text-secondary); font-size: 0.9rem; margin-bottom: 1.25rem;">Try searching for generic terms like "Switch", "Padlock", "Valve", or "Emulsion".</p>
          <button id="reset-search-btn" class="btn btn-outline btn-sm">Reset Search Results</button>
        </div>
      `;
      document.getElementById('reset-search-btn')?.addEventListener('click', () => {
        const input = document.getElementById('master-search-input');
        const catSelect = document.getElementById('search-cat-select');
        const catLabel = document.getElementById('search-cat-label');
        if (input) input.value = '';
        if (catSelect) catSelect.value = '';
        if (catLabel) catLabel.textContent = 'All Categories';
        document.getElementById('search-clear-btn')?.setAttribute('style', 'display:none;');
        currentCatalogOptions.categoryId = '';
        document.querySelectorAll('[data-catalog-cat]').forEach(tab => {
          tab.classList.toggle('active', tab.dataset.catalogCat === '');
        });
        renderProductSections();
      });
    } else {
      section.innerHTML = matched.map(createProductCardHtml).join('');
      bindProductCardEvents(section);
      showToast(`Found ${matched.length} product(s) matching your search.`, 'info');
    }

    document.getElementById('bestsellers-section')?.scrollIntoView({ behavior: 'smooth' });
  }
}

/**
 * Render the 4 Core Product Categories in Exact Specified Order:
 * 1. Hardware, 2. Electrical, 3. Plumbing, 4. Paints
 */
async function renderCategories() {
  const grid = document.getElementById('categories-grid');
  if (!grid) return;

  // Exactly 4 circular categories in customer-requested order:
  // 1. Hardware, 2. Electrical, 3. Plumbing, 4. Paints
  const circularItems = [
    { id: 'cat-hardware', name: 'Hardware', count: '38+ items', img: 'assets/images/cat_hardware.jpg', order: '01' },
    { id: 'cat-electrical', name: 'Electrical', count: '42+ items', img: 'assets/images/cat_electrical.jpg', order: '02' },
    { id: 'cat-plumbing', name: 'Plumbing', count: '29+ items', img: 'assets/images/cat_plumbing.jpg', order: '03' },
    { id: 'cat-paints', name: 'Paints', count: '34+ items', img: 'assets/images/cat_paints.jpg', order: '04' }
  ];

  grid.innerHTML = circularItems.map(item => `
    <a href="#bestsellers-section" class="category-circle-item" data-category-filter="${item.id}" title="${escapeHTML(item.name)} Products">
      <div class="category-circle-thumb">
        <span class="category-circle-order-badge">${item.order}</span>
        <img src="${item.img}" alt="${escapeHTML(item.name)}" loading="lazy" />
      </div>
      <span class="category-circle-name">${escapeHTML(item.name)}</span>
      <span class="category-circle-count">${escapeHTML(item.count)}</span>
    </a>
  `).join('');

  // Category card click filters the catalog grid
  document.querySelectorAll('[data-category-filter]').forEach(elem => {
    elem.addEventListener('click', (e) => {
      e.preventDefault();
      const catId = elem.dataset.categoryFilter;
      setCatalogCategoryFilter(catId);
    });
  });
}

/**
 * Create reusable HTML for a single product card
 */
function createProductCardHtml(product) {
  const discount = calculateDiscount(product.price, product.compareAtPrice, product.discountPercentage);
  const inWishlist = isInWishlist(product.id);
  const comparePrice = product.compareAtPrice || (discount > 0 ? Math.round(product.price / (1 - discount / 100)) : null);

  let badgeHtml = '';
  if (discount > 0) {
    badgeHtml += `<span class="badge badge-discount">${discount}% OFF</span>`;
  }
  if (product.isBestseller) {
    badgeHtml += `<span class="badge badge-bestseller">BESTSELLER</span>`;
  } else if (product.isNew) {
    badgeHtml += `<span class="badge badge-new">NEW</span>`;
  }

  const stockBadge = product.stock <= 5 
    ? `<span class="badge badge-stock-low">Only ${product.stock} left</span>`
    : `<span class="badge badge-stock-in">In Stock</span>`;

  return `
    <article class="product-card" data-product-id="${product.id}">
      <div class="product-img-wrap">
        <div class="product-badge-stack">
          ${badgeHtml}
        </div>
        <button 
          class="product-wishlist-btn ${inWishlist ? 'active' : ''}" 
          data-wishlist-btn 
          data-product-id="${product.id}"
          title="${inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}"
          aria-label="${inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="${inWishlist ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </button>
        <img 
          src="${product.image}" 
          alt="${escapeHTML(product.name)}" 
          class="product-img" 
          loading="lazy"
        />
        <button class="product-quick-view-btn" data-quick-view-btn data-product-id="${product.id}">
          Quick View
        </button>
      </div>

      <div class="product-body">
        <div class="product-category-brand">
          <span class="product-brand">${escapeHTML(product.brand)}</span>
          ${stockBadge}
        </div>

        <h3 class="product-title">
          <a href="product.html?id=${encodeURIComponent(product.id)}">
            ${escapeHTML(product.name)}
          </a>
        </h3>

        <div class="product-rating product-rating-clean" data-product-rating-box="${product.id}">
          ${(product.reviewCount && product.reviewCount > 0 && product.rating > 0) ? `
            <div class="rating-stars" aria-label="${product.rating} out of 5 stars">
              ${renderStars(product.rating)}
            </div>
            <span class="rating-score">${Number(product.rating).toFixed(1)}</span>
            <span class="rating-count">(${product.reviewCount})</span>
            <button type="button" class="btn-product-review-trigger" data-review-product-id="${product.id}" data-review-product-name="${escapeHTML(product.name)}" title="Add your review">
              + Review
            </button>
          ` : `
            <span class="rating-no-reviews">☆ No reviews yet</span>
            <button type="button" class="btn-product-review-trigger" data-review-product-id="${product.id}" data-review-product-name="${escapeHTML(product.name)}" title="Be the first to review this product">
              ✍️ Review
            </button>
          `}
        </div>

        <div class="product-price-block">
          <span class="price-current">${formatINR(product.price)}</span>
          ${comparePrice ? `<span class="price-original">${formatINR(comparePrice)}</span>` : ''}
          ${discount > 0 && comparePrice ? `<span class="price-discount-chip">Save ${formatINR(comparePrice - product.price)}</span>` : ''}
        </div>

        <div class="product-footer">
          <button class="btn-add-cart" data-add-cart-btn data-product-id="${product.id}">
            Add to Cart
          </button>
        </div>
      </div>
    </article>
  `;
}

/**
 * Render SVG star rating
 */
function renderStars(rating) {
  let stars = '';
  const fullStars = Math.floor(rating);
  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      stars += `<svg width="13" height="13" viewBox="0 0 24 24" fill="#F5A623" stroke="#F5A623" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
    } else {
      stars += `<svg width="13" height="13" viewBox="0 0 24 24" fill="#E2E8F0" stroke="#CBD5E1" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
    }
  }
  return stars;
}

/**
 * Render Product Grids (Live Firestore Catalog, New Arrivals, Special Offers)
 */
async function renderProductSections() {
  await renderCatalogGrid();

  const newArrivalsGrid = document.getElementById('new-arrivals-grid');
  const dealsGrid = document.getElementById('deals-grid');

  if (newArrivalsGrid) {
    const newItems = await fetchProducts({ sortBy: 'newest' });
    newArrivalsGrid.innerHTML = newItems.slice(0, 4).map(createProductCardHtml).join('');
    bindProductCardEvents(newArrivalsGrid);
  }

  if (dealsGrid) {
    const allProducts = await fetchProducts();
    const deals = allProducts.filter(p => calculateDiscount(p.price, p.compareAtPrice, p.discountPercentage) >= 20).slice(0, 4);
    dealsGrid.innerHTML = deals.map(createProductCardHtml).join('');
    bindProductCardEvents(dealsGrid);
  }
}

/**
 * Render the main interactive catalog grid
 */
async function renderCatalogGrid() {
  const bestsellersGrid = document.getElementById('bestsellers-grid');
  if (!bestsellersGrid) return;

  bestsellersGrid.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem; color: var(--color-text-secondary);">
      <p>Loading live products from database...</p>
    </div>
  `;

  const products = await fetchProducts(currentCatalogOptions);

  if (products.length === 0) {
    bestsellersGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; background: #FFF; border-radius: var(--radius-md); border: 1px dashed var(--color-border);">
        <p style="font-size: 1.1rem; color: var(--color-navy); font-weight: 600; margin-bottom: 0.5rem;">No products match the selected filters.</p>
        <button id="reset-catalog-filter-btn" class="btn btn-outline btn-sm">Clear Filters</button>
      </div>
    `;
    bestsellersGrid.querySelector('#reset-catalog-filter-btn')?.addEventListener('click', () => {
      setCatalogCategoryFilter('');
    });
  } else {
    bestsellersGrid.innerHTML = products.map(createProductCardHtml).join('');
    bindProductCardEvents(bestsellersGrid);
  }
}

/**
 * Bind click events for Add to Cart, Buy Now, Wishlist, and Quick View
 */
function bindProductCardEvents(container) {
  if (!container) return;

  container.querySelectorAll('[data-add-cart-btn]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pid = btn.dataset.productId;
      if (pid) {
        const allProds = getAllAvailableProducts();
        const p = allProds.find(item => String(item.id) === String(pid));
        addToCart(pid, 1, p || null);
        openCartDrawer();
      }
    });
  });

  container.querySelectorAll('[data-buy-now-btn]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pid = btn.dataset.productId;
      if (pid) {
        const allProds = getAllAvailableProducts();
        const p = allProds.find(item => String(item.id) === String(pid));
        addToCart(pid, 1, p || null);
        handleInstantCheckout();
      }
    });
  });

  container.querySelectorAll('[data-wishlist-btn]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pid = btn.dataset.productId;
      if (pid) toggleWishlist(pid);
    });
  });

  container.querySelectorAll('[data-quick-view-btn]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const pid = btn.dataset.productId;
      if (pid) openQuickView(pid);
    });
  });

  container.querySelectorAll('.btn-product-review-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const pid = btn.dataset.reviewProductId;
      const pname = btn.dataset.reviewProductName || '';
      openFeedbackModal(pid, pname);
    });
  });
}

/**
 * Instant Checkout Flow ("Buy Now")
 * Opens the interactive multi-step checkout modal with real address & payment
 */
function handleInstantCheckout() {
  openCheckoutModal();
}

/**
 * Initialize Stage 3 Interactive Catalog Controls
 */
function initCatalogToolbar() {
  const tabs = document.querySelectorAll('[data-catalog-cat]');
  const sortSelect = document.getElementById('catalog-sort-select');
  const stockCheckbox = document.getElementById('catalog-stock-checkbox');

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const catId = btn.dataset.catalogCat;
      setCatalogCategoryFilter(catId);
    });
  });

  sortSelect?.addEventListener('change', () => {
    currentCatalogOptions.sortBy = sortSelect.value;
    renderCatalogGrid();
  });

  stockCheckbox?.addEventListener('change', () => {
    currentCatalogOptions.inStockOnly = stockCheckbox.checked;
    renderCatalogGrid();
  });
}

/**
 * Initialize Top Categories Horizontal Scrollbar (Flipkart/Amazon Reference Style)
 */
function initTopCategoriesBar() {
  const container = document.getElementById('top-categories-scroll');
  if (!container) return;

  const items = container.querySelectorAll('.top-cat-item');
  items.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      items.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      const catId = item.dataset.topCat || '';
      const keyword = item.dataset.keyword || '';

      if (keyword) {
        const input = document.getElementById('master-search-input');
        if (input) input.value = keyword;
        filterProductsByQuery(keyword, catId);
      } else {
        setCatalogCategoryFilter(catId);
      }

      document.getElementById('bestsellers-section')?.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

/**
 * Initialize Visual "Shop by Category" Showcase Rail (Positioned Under Second Bar)
 */
function initShopByCategoryRail() {
  const container = document.getElementById('category-cards-rail-track');
  const seeAllBtn = document.getElementById('shop-by-cat-see-all');

  if (seeAllBtn) {
    seeAllBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // Clear filters and reset to all products
      setCatalogCategoryFilter('');
      const input = document.getElementById('master-search-input');
      if (input) input.value = '';
      const clearBtn = document.getElementById('search-clear-btn');
      if (clearBtn) clearBtn.style.display = 'none';

      const cards = container ? container.querySelectorAll('.cat-rail-card') : [];
      cards.forEach(c => c.classList.remove('active'));

      renderProductSections();
      document.getElementById('bestsellers-section')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  if (!container) return;

  const cards = container.querySelectorAll('.cat-rail-card');
  cards.forEach(card => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      cards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      const keyword = (card.dataset.keyword || '').trim();
      const catFilter = card.dataset.catFilter || 'cat-hardware';
      const cardTitle = card.querySelector('.cat-rail-card-title')?.textContent?.trim() || 'Category';

      // Check if keyword matches products in current inventory
      const allProds = getAllAvailableProducts();
      const keywordLower = keyword.toLowerCase();
      const matchingProds = allProds.filter(p => {
        const nameMatch = p.name && p.name.toLowerCase().includes(keywordLower);
        const descMatch = p.description && p.description.toLowerCase().includes(keywordLower);
        const catMatch = p.categoryName && p.categoryName.toLowerCase().includes(keywordLower);
        return nameMatch || descMatch || catMatch;
      });

      if (matchingProds.length > 0) {
        filterProductsByQuery(keyword, catFilter);
      } else {
        // Fallback gracefully to category filter with informative message
        setCatalogCategoryFilter(catFilter);
        showToast(`Showing hardware & building supplies for ${cardTitle}.`, 'info');
      }

      document.getElementById('bestsellers-section')?.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

/**
 * Auto-Scrolling Offers Banner Carousel (Matches Reference Photo with dots & touch support)
 * Dynamically rendered from active offers configured by store admin or default campaigns.
 */
let _offersAutoTimer = null;

function initOffersCarousel() {
  const container = document.getElementById('offers-carousel-container');
  const track = document.getElementById('offers-carousel-track');
  const dotsContainer = document.getElementById('offers-carousel-dots');
  const prevBtn = document.getElementById('offers-carousel-prev');
  const nextBtn = document.getElementById('offers-carousel-next');

  if (!container || !track) return;

  // Retrieve dynamic offers from offers-data.js or localStorage
  const offersList = (typeof getActiveOffers === 'function')
    ? getActiveOffers().filter(o => o && o.active !== false)
    : [];

  if (offersList.length > 0) {
    track.innerHTML = offersList.map((offer, idx) => `
      <article class="offer-slide offer-slide-${idx + 1}" data-slide-index="${idx}">
        <div class="offer-slide-backdrop">
          <img src="${escapeHTML(offer.image || 'assets/images/cat_hardware.jpg')}" alt="${escapeHTML(offer.title)}" class="offer-slide-bg-img" />
          <div class="offer-slide-overlay"></div>
        </div>
        <div class="offer-slide-content">
          <div class="offer-badge-row">
            ${offer.tagBadge ? `<span class="offer-tag-badge">${escapeHTML(offer.tagBadge)}</span>` : ''}
            ${offer.tagSpec ? `<span class="offer-tag-spec">${escapeHTML(offer.tagSpec)}</span>` : ''}
          </div>
          <h2 class="offer-slide-title">${escapeHTML(offer.title)}</h2>
          ${offer.description ? `<p class="offer-slide-desc">${escapeHTML(offer.description)}</p>` : ''}
          <div class="offer-slide-perks">
            ${(offer.perks || []).filter(Boolean).map(perk => `<span class="offer-perk">${escapeHTML(perk)}</span>`).join('')}
          </div>
          <div class="offer-slide-actions">
            <a href="${escapeHTML(offer.ctaLink || '#bestsellers-section')}" class="btn btn-offer-cta" ${offer.categoryFilter ? `data-category-filter="${escapeHTML(offer.categoryFilter)}"` : ''}>
              ${escapeHTML(offer.ctaText || 'Shop Deals')}
            </a>
            ${offer.subtext ? `<span class="offer-subtext">${escapeHTML(offer.subtext)}</span>` : ''}
          </div>
        </div>
      </article>
    `).join('');

    if (dotsContainer) {
      dotsContainer.innerHTML = offersList.map((_, idx) => `
        <button type="button" class="offers-dot ${idx === 0 ? 'active' : ''}" data-slide-to="${idx}" aria-label="Slide ${idx + 1}"></button>
      `).join('');
    }
  }

  const slides = track.querySelectorAll('.offer-slide');
  const totalSlides = slides.length;
  if (totalSlides === 0) return;

  let currentSlide = 0;
  const INTERVAL = 3500; // 3.5s per slide

  function updateDots() {
    if (!dotsContainer) return;
    const dots = dotsContainer.querySelectorAll('.offers-dot');
    dots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === currentSlide);
    });
  }

  function goToSlide(index) {
    currentSlide = (index + totalSlides) % totalSlides;
    track.style.transform = `translateX(-${currentSlide * 100}%)`;
    updateDots();
  }

  function nextSlide() {
    goToSlide(currentSlide + 1);
  }

  function prevSlide() {
    goToSlide(currentSlide - 1);
  }

  function startAutoPlay() {
    stopAutoPlay();
    _offersAutoTimer = setInterval(nextSlide, INTERVAL);
  }

  function stopAutoPlay() {
    if (_offersAutoTimer) {
      clearInterval(_offersAutoTimer);
      _offersAutoTimer = null;
    }
  }

  // Dots click events
  if (dotsContainer) {
    dotsContainer.querySelectorAll('.offers-dot').forEach((dot, idx) => {
      dot.addEventListener('click', (e) => {
        e.preventDefault();
        goToSlide(idx);
        startAutoPlay();
      });
    });
  }

  // Prev / Next button clicks
  prevBtn?.replaceWith(prevBtn.cloneNode(true));
  nextBtn?.replaceWith(nextBtn.cloneNode(true));
  const newPrevBtn = document.getElementById('offers-carousel-prev');
  const newNextBtn = document.getElementById('offers-carousel-next');

  newPrevBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    prevSlide();
    startAutoPlay();
  });

  newNextBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    nextSlide();
    startAutoPlay();
  });

  // Pause on hover
  container.addEventListener('mouseenter', stopAutoPlay);
  container.addEventListener('mouseleave', startAutoPlay);

  // Touch Swipe Gesture Detection for Mobile
  let startX = 0;
  let startY = 0;
  let isSwiping = false;

  container.addEventListener('touchstart', (e) => {
    if (!e.touches || e.touches.length === 0) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isSwiping = true;
    stopAutoPlay();
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (!isSwiping || !e.touches || e.touches.length === 0) return;
    const diffX = e.touches[0].clientX - startX;
    const diffY = e.touches[0].clientY - startY;
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
      // Horizontal swipe detected
    }
  }, { passive: true });

  container.addEventListener('touchend', (e) => {
    if (!isSwiping || !e.changedTouches || e.changedTouches.length === 0) return;
    const diffX = e.changedTouches[0].clientX - startX;
    const diffY = e.changedTouches[0].clientY - startY;
    isSwiping = false;

    if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX < 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
    startAutoPlay();
  }, { passive: true });

  // Slide CTA clicks
  slides.forEach(slide => {
    slide.querySelectorAll('[data-category-filter]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const catId = btn.dataset.categoryFilter;
        if (catId) {
          setCatalogCategoryFilter(catId);
        }
      });
    });
  });

  // Start autoplay
  startAutoPlay();
}

// Live sync listener for offers updates from admin console
if (typeof window !== 'undefined' && !window._devshreeOffersListenerBound) {
  window._devshreeOffersListenerBound = true;
  window.addEventListener('devshree:offers-updated', () => initOffersCarousel());
  window.addEventListener('storage', (e) => {
    if (e.key === 'devshree_custom_offers') initOffersCarousel();
  });
}

/**
 * Render the Under-Autoscrolling Product Rail Shelf (Reference Photo Purple Container)
 * Prioritizes Regular Hardware Deals explicitly marked by store admin.
 */
async function renderDealsRail() {
  const track = document.getElementById('deals-rail-track');
  if (!track) return;

  const allProducts = getAllAvailableProducts();
  if (!allProducts || allProducts.length === 0) return;

  // Regular Hardware Deals explicitly flagged in Admin take top priority
  const regularDeals = allProducts.filter(p => !!p.isRegularDeal);
  const otherDeals = allProducts.filter(p => {
    if (p.isRegularDeal) return false;
    const disc = calculateDiscount(p.price, p.compareAtPrice, p.discountPercentage);
    return disc >= 10 || p.isBestseller || p.isFeatured;
  });

  let dealItems = [...regularDeals, ...otherDeals];
  if (dealItems.length === 0) {
    dealItems = allProducts.slice(0, 8);
  } else if (dealItems.length > 12) {
    dealItems = dealItems.slice(0, 12);
  }

  track.innerHTML = dealItems.map(p => {
    const disc = calculateDiscount(p.price, p.compareAtPrice, p.discountPercentage);
    const comparePrice = p.compareAtPrice || (disc > 0 ? Math.round(p.price / (1 - disc / 100)) : null);
    
    let discBadge = disc > 0 ? `${disc}% off` : (p.isBestseller ? 'Bestseller' : 'Deal');
    if (p.isRegularDeal) {
      discBadge = disc > 0 ? `${disc}% off • Regular Deal` : 'Regular Deal';
    }

    const catObj = (typeof MOCK_CATEGORIES !== 'undefined' && Array.isArray(MOCK_CATEGORIES))
      ? MOCK_CATEGORIES.find(c => c.id === p.categoryId)
      : null;
    const catLabel = catObj ? catObj.name.split(' ')[0] : 'Hardware';

    return `
      <article class="deals-rail-card" data-product-id="${p.id}">
        <a href="product.html?id=${encodeURIComponent(p.id)}" class="deals-rail-card-img-wrap" style="text-decoration:none;" aria-label="${escapeHTML(p.name)}">
          <span class="deals-rail-discount-chip ${p.isRegularDeal ? 'regular-deal-chip' : ''}">${escapeHTML(discBadge)}</span>
          <img src="${p.image}" alt="${escapeHTML(p.name)}" class="deals-rail-card-img" loading="lazy" />
        </a>
        <div class="deals-rail-card-body">
          <span class="deals-rail-card-cat">${escapeHTML(catLabel)}</span>
          <h3 class="deals-rail-card-title" title="${escapeHTML(p.name)}">
            <a href="product.html?id=${encodeURIComponent(p.id)}" style="color:inherit;text-decoration:none;">
              ${escapeHTML(p.name)}
            </a>
          </h3>
          <div class="deals-rail-card-price-row">
            <span class="deals-rail-current-price">${formatINR(p.price)}</span>
            ${comparePrice ? `<span class="deals-rail-compare-price">${formatINR(comparePrice)}</span>` : ''}
          </div>
          <button type="button" class="btn-deals-rail-add" data-add-cart-btn data-product-id="${p.id}" aria-label="Add ${escapeHTML(p.name)} to cart">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <span>Add</span>
          </button>
        </div>
      </article>
    `;
  }).join('');

  bindProductCardEvents(track);
}

/**
 * Filter the catalog grid by a category ID
 */
function setCatalogCategoryFilter(catId) {
  currentCatalogOptions.categoryId = catId;
  const tabs = document.querySelectorAll('[data-catalog-cat]');
  tabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.catalogCat === (catId || ''));
  });

  // Sync Top Category Horizontal Scrollbar active state
  const topItems = document.querySelectorAll('#top-categories-scroll .top-cat-item');
  topItems.forEach(item => {
    const itemCat = item.dataset.topCat || '';
    item.classList.toggle('active', itemCat === (catId || ''));
  });

  // Sync Shop by Category Rail active state
  const railCards = document.querySelectorAll('.cat-rail-card');
  railCards.forEach(card => {
    if (!catId) card.classList.remove('active');
  });

  renderCatalogGrid();
  document.getElementById('bestsellers-section')?.scrollIntoView({ behavior: 'smooth' });
}

/**
 * One-click Firestore database sync/seeding button
 */
function initSyncButton() {
  const syncBtn = document.getElementById('sync-firestore-btn');
  if (!syncBtn) return;

  syncBtn.addEventListener('click', async () => {
    syncBtn.disabled = true;
    const originalHtml = syncBtn.innerHTML;
    syncBtn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F28C28" stroke-width="2.5" style="animation: spin 1s linear infinite;">
        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
      </svg>
      <span style="color:#F28C28;">Syncing...</span>
    `;

    try {
      const res = await seedFirestoreCatalog();
      if (res && res.success) {
        syncBtn.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span style="color:#22C55E;">Synced ✓</span>
        `;
        // Refresh categories and product catalog
        await renderCategories();
        await renderProductSections();
      } else {
        syncBtn.innerHTML = originalHtml;
      }
    } catch (err) {
      console.error('[Devshree] Sync error:', err);
      syncBtn.innerHTML = originalHtml;
    } finally {
      syncBtn.disabled = false;
    }
  });
}

/**
 * Quick View Modal Setup
 */
function initQuickViewModal() {
  const backdrop = document.getElementById('quick-view-modal');
  const closeBtn = document.getElementById('modal-close-btn');

  const closeModal = () => {
    backdrop?.classList.remove('active');
    document.body.style.overflow = '';
  };

  closeBtn?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && backdrop?.classList.contains('active')) {
      closeModal();
    }
  });
}

/**
 * Populate and Open Quick View Modal
 */
async function openQuickView(productId) {
  let product = await getProductById(productId);
  if (!product) {
    const allProds = getAllAvailableProducts();
    product = allProds.find(p => String(p.id) === String(productId));
  }
  if (!product) return;

  const modal = document.getElementById('quick-view-modal');
  const body = document.getElementById('modal-dynamic-body');
  if (!modal || !body) return;

  const discount = calculateDiscount(product.price, product.compareAtPrice, product.discountPercentage);
  const inWishlist = isInWishlist(product.id);
  const comparePrice = product.compareAtPrice || (discount > 0 ? Math.round(product.price / (1 - discount / 100)) : null);
  const stockLimit = (typeof product.stock === 'number' && !isNaN(product.stock)) 
    ? product.stock 
    : (parseInt(product.stock, 10) || 50);

  // Technical Specs Chips
  let specsHtml = '';
  if (product.specifications && Object.keys(product.specifications).length > 0) {
    const specEntries = Object.entries(product.specifications);
    specsHtml = `
      <div class="modal-specs-section">
        <div class="modal-specs-header">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 11 12 14 22 4"></polyline>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
          <h4>Verified Trade Specifications</h4>
        </div>
        <div class="modal-specs-grid">
          ${specEntries.map(([key, val]) => `
            <div class="spec-chip">
              <span class="spec-label">${escapeHTML(key)}</span>
              <span class="spec-val">${escapeHTML(String(val))}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Visual Badges
  let badgesHtml = '';
  if (product.isBestseller) {
    badgesHtml += `<span class="badge badge-bestseller">BESTSELLER</span>`;
  }
  if (product.isNew) {
    badgesHtml += `<span class="badge badge-new">NEW</span>`;
  }
  if (discount > 0) {
    badgesHtml += `<span class="badge badge-discount">${discount}% OFF</span>`;
  }

  body.innerHTML = `
    <div class="modal-product-layout">
      <!-- Left Visual Gallery -->
      <div class="modal-gallery">
        <div class="modal-main-img-wrap">
          <div class="modal-badge-stack">
            ${badgesHtml}
          </div>

          <button type="button" class="modal-gallery-wishlist-btn ${inWishlist ? 'active' : ''}" id="modal-wishlist-toggle" aria-label="Toggle Wishlist" title="${inWishlist ? 'Remove from wishlist' : 'Save to wishlist'}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="${inWishlist ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </button>

          <div class="modal-img-container">
            <img src="${product.image}" alt="${escapeHTML(product.name)}" class="modal-main-img" id="modal-primary-img" />
          </div>

          <div class="modal-zoom-hint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="11" y1="8" x2="11" y2="14"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
            <span>High-Definition Trade Standard</span>
          </div>
        </div>

        <div class="modal-trust-strip">
          <div class="trust-strip-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <span>100% Genuine</span>
          </div>
          <div class="trust-strip-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            <span>GST Invoice</span>
          </div>
          <div class="trust-strip-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="8" r="7"></circle>
              <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
            </svg>
            <span>Brand Warranty</span>
          </div>
        </div>
      </div>

      <!-- Right Details & Purchasing Column -->
      <div class="modal-details">
        <div class="modal-header-meta">
          <span class="modal-brand-tag">${escapeHTML(product.brand || 'Devshree')}</span>
          <span class="modal-meta-dot">&bull;</span>
          <span class="modal-cat-name">${escapeHTML(product.categoryName || 'Supplies')}</span>
          <span class="modal-sku-chip">SKU: ${escapeHTML(product.sku || product.id.slice(0, 8).toUpperCase())}</span>
        </div>

        <h2 class="modal-title" id="modal-title">${escapeHTML(product.name)}</h2>

        <div class="modal-rating-stock-row">
          <div class="modal-stars-rating">
            ${(product.reviewCount && product.reviewCount > 0 && product.rating > 0) ? `
              <div class="rating-stars">${renderStars(product.rating)}</div>
              <span class="rating-score">${Number(product.rating).toFixed(1)}</span>
              <span class="rating-count">(${product.reviewCount} customer review${product.reviewCount === 1 ? '' : 's'})</span>
            ` : `
              <span class="rating-no-reviews" style="color:var(--color-text-secondary); font-size:0.85rem;">☆ No customer reviews yet</span>
            `}
            <button type="button" class="btn btn-outline btn-xs btn-modal-write-review" data-prod-id="${product.id}" data-prod-name="${escapeHTML(product.name)}" style="margin-left:8px; padding:3px 10px; font-size:0.78rem; border-radius:12px; cursor:pointer;">
              ✍️ Review Product
            </button>
          </div>
          <div class="modal-stock-indicator ${stockLimit <= 5 ? 'low' : 'in'}">
            <span class="stock-pulse-dot"></span>
            <span>${stockLimit <= 5 ? `Only ${stockLimit} units left in stock` : `In Stock &bull; Ready to Dispatch`}</span>
          </div>
        </div>

        <div class="modal-pricing-box">
          <div class="modal-price-main">
            <span class="modal-price-current">${formatINR(product.price)}</span>
            ${comparePrice ? `<span class="modal-price-mrp">${formatINR(comparePrice)}</span>` : ''}
            ${discount > 0 && comparePrice ? `<span class="modal-savings-tag">Save ${formatINR(comparePrice - product.price)} (${discount}% OFF)</span>` : ''}
          </div>
          <div class="modal-gst-note">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <span>Price inclusive of all taxes &bull; Official GST Tax Invoice included</span>
          </div>
        </div>

        <div class="modal-description-text">
          ${escapeHTML(product.description || 'Premium architectural-grade hardware and trade supplies carefully curated for longevity and superior performance.')}
        </div>

        ${specsHtml}

        <div class="modal-purchase-footer">
          <div class="modal-qty-wrapper">
            <label for="modal-qty-input" class="modal-qty-label">Quantity</label>
            <div class="qty-counter modal-qty-counter">
              <button type="button" class="qty-btn" id="modal-qty-minus" aria-label="Decrease quantity">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
              <input type="number" id="modal-qty-input" class="qty-input" value="1" min="1" max="${stockLimit}" readonly />
              <button type="button" class="qty-btn" id="modal-qty-plus" aria-label="Increase quantity">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
            </div>
          </div>

          <div class="modal-cta-buttons">
            <button type="button" class="btn btn-primary modal-btn-cart" id="modal-add-cart-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
              </svg>
              <span>Add to Cart</span>
            </button>

            <button type="button" class="btn modal-btn-buy" id="modal-buy-now-btn">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
              <span>Instant Buy</span>
            </button>
          </div>
        </div>

        <div class="modal-shipping-banner">
          <div class="shipping-banner-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="1" y="3" width="15" height="13"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
          </div>
          <div class="shipping-banner-text">
            <strong>Free Dispatch Across India</strong> on orders ₹1,999+ &bull; Ships within 24h
          </div>
        </div>

        <div style="margin-top: 1rem; text-align: center; border-top: 1px dashed var(--color-border); padding-top: 0.75rem;">
          <a href="product.html?id=${encodeURIComponent(product.id)}" class="view-all-link" style="font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px; font-weight: 700; color: var(--color-terracotta);">
            <span>Open Standalone Product Page &amp; Bulk Trade Specs</span> &rarr;
          </a>
        </div>
      </div>
    </div>
  `;

  const qtyInput = document.getElementById('modal-qty-input');
  const minusBtn = document.getElementById('modal-qty-minus');
  const plusBtn = document.getElementById('modal-qty-plus');

  minusBtn?.addEventListener('click', () => {
    let current = parseInt(qtyInput.value, 10) || 1;
    if (current > 1) qtyInput.value = current - 1;
  });

  plusBtn?.addEventListener('click', () => {
    let current = parseInt(qtyInput.value, 10) || 1;
    if (current < stockLimit) qtyInput.value = current + 1;
    else showToast(`Maximum available stock is ${stockLimit}.`, 'info');
  });

  document.getElementById('modal-add-cart-btn')?.addEventListener('click', () => {
    const qty = parseInt(qtyInput.value, 10) || 1;
    addToCart(product.id, qty, product);
    modal.classList.remove('active');
    document.body.style.overflow = '';
    openCartDrawer();
  });

  document.getElementById('modal-buy-now-btn')?.addEventListener('click', () => {
    const qty = parseInt(qtyInput.value, 10) || 1;
    addToCart(product.id, qty, product);
    modal.classList.remove('active');
    document.body.style.overflow = '';
    handleInstantCheckout();
  });

  body.querySelector('.btn-modal-write-review')?.addEventListener('click', (e) => {
    e.preventDefault();
    modal.classList.remove('active');
    document.body.style.overflow = '';
    openFeedbackModal(product.id, product.name);
  });

  const modalWishBtn = document.getElementById('modal-wishlist-toggle');
  modalWishBtn?.addEventListener('click', () => {
    const isNowIn = toggleWishlist(product.id);
    modalWishBtn.classList.toggle('active', isNowIn);
    const svgPath = modalWishBtn.querySelector('path');
    if (svgPath) {
      modalWishBtn.querySelector('svg').setAttribute('fill', isNowIn ? 'currentColor' : 'none');
    }
  });

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

/**
 * Slide-Over Mini Cart Drawer Management
 */
function initCartDrawer() {
  const backdrop = document.getElementById('cart-drawer-backdrop');
  const closeBtn = document.getElementById('cart-drawer-close');
  const headerCartBtn = document.getElementById('header-cart-btn');
  const continueBtn = document.getElementById('cart-continue-btn');
  const checkoutBtn = document.getElementById('cart-checkout-btn');

  const closeCart = () => {
    backdrop?.classList.remove('active');
    document.body.style.overflow = '';
  };

  headerCartBtn?.addEventListener('click', () => {
    renderCartDrawerContent();
    backdrop?.classList.add('active');
    document.body.style.overflow = 'hidden';
  });

  closeBtn?.addEventListener('click', closeCart);
  continueBtn?.addEventListener('click', closeCart);
  backdrop?.addEventListener('click', (e) => {
    if (e.target === backdrop) closeCart();
  });

  checkoutBtn?.addEventListener('click', () => {
    const count = getCartCount();
    if (count === 0) {
      showToast('Your cart is empty. Add products before checkout.', 'info');
      return;
    }
    openCheckoutModal();
  });

  window.addEventListener('devshree:cart-updated', () => {
    renderCartDrawerContent();
  });
}

/**
 * Setup modal controls for Checkout, Razorpay Simulation, and Order Tracking
 */
function initTrackingAndCheckoutModals() {
  document.getElementById('checkout-modal-close-btn')?.addEventListener('click', closeCheckoutModal);
  document.getElementById('checkout-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('checkout-modal')) closeCheckoutModal();
  });

  document.getElementById('track-order-close-btn')?.addEventListener('click', () => {
    document.getElementById('track-order-modal')?.classList.remove('active');
    document.body.style.overflow = '';
  });
  document.getElementById('track-order-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('track-order-modal')) {
      document.getElementById('track-order-modal')?.classList.remove('active');
      document.body.style.overflow = '';
    }
  });

  // Track Order links in header & announcement bar
  document.getElementById('header-track-order-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    openOrderTrackingModal();
  });

  // Razorpay simulation nav pills toggle
  document.querySelectorAll('.rzp-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.rzp-pill').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.rzp-tab-pane').forEach(pane => pane.style.display = 'none');
      pill.classList.add('active');

      if (pill.id === 'rzp-pill-upi') {
        const pane = document.getElementById('rzp-pane-upi');
        if (pane) pane.style.display = 'block';
      } else if (pill.id === 'rzp-pill-cards') {
        const pane = document.getElementById('rzp-pane-cards');
        if (pane) pane.style.display = 'block';
      } else if (pill.id === 'rzp-pill-netbanking') {
        const pane = document.getElementById('rzp-pane-netbanking');
        if (pane) pane.style.display = 'block';
      }
    });
  });
}

export function openCartDrawer() {
  renderCartDrawerContent();
  const backdrop = document.getElementById('cart-drawer-backdrop');
  backdrop?.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function renderCartDrawerContent() {
  const itemsContainer = document.getElementById('cart-drawer-items');
  const countEl = document.getElementById('cart-drawer-count');
  const subtotalEl = document.getElementById('cart-drawer-subtotal');
  const shippingEl = document.getElementById('cart-drawer-shipping');
  const totalEl = document.getElementById('cart-drawer-total');
  const meterText = document.getElementById('shipping-meter-text');
  const meterFill = document.getElementById('shipping-meter-fill');

  const cart = getCart();
  const totals = getCartTotals();
  const count = getCartCount();

  if (countEl) countEl.textContent = count;
  if (subtotalEl) subtotalEl.textContent = formatINR(totals.subtotal);
  if (shippingEl) shippingEl.textContent = totals.shipping === 0 ? (totals.subtotal > 0 ? 'FREE' : '₹0') : formatINR(totals.shipping);
  if (totalEl) totalEl.textContent = formatINR(totals.total);

  // Free shipping progress bar
  if (meterText && meterFill) {
    if (totals.subtotal >= totals.freeShippingThreshold) {
      meterText.innerHTML = `🎉 <strong>Congratulations!</strong> You have unlocked FREE Express Delivery!`;
      meterFill.style.width = '100%';
    } else {
      const remaining = totals.freeShippingThreshold - totals.subtotal;
      const pct = Math.min(100, Math.round((totals.subtotal / totals.freeShippingThreshold) * 100));
      meterText.innerHTML = `Add <strong>${formatINR(remaining)}</strong> more to qualify for <strong>FREE Delivery</strong>!`;
      meterFill.style.width = `${pct}%`;
    }
  }

  if (!itemsContainer) return;

  if (cart.length === 0) {
    itemsContainer.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem; color: var(--color-text-secondary);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 1rem; color: #CBD5E1;">
          <circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>
        <p style="font-weight: 700; color: var(--color-navy); font-size: 1.05rem; margin-bottom: 0.35rem;">Your Cart is Empty</p>
        <p style="font-size: 0.85rem; margin-bottom: 1.5rem;">Explore top electrical switches, wire bundles, pipes, and paints.</p>
        <a href="#categories-section" class="btn btn-outline btn-sm" id="cart-drawer-shop-now">Browse Categories</a>
      </div>
    `;
    itemsContainer.querySelector('#cart-drawer-shop-now')?.addEventListener('click', () => {
      document.getElementById('cart-drawer-backdrop')?.classList.remove('active');
      document.body.style.overflow = '';
    });
    return;
  }

  itemsContainer.innerHTML = cart.map(item => `
    <div class="cart-item" data-cart-item-id="${item.productId}">
      <div class="cart-item-img-box">
        <img src="${item.productSnapshot?.image || ''}" alt="${escapeHTML(item.productSnapshot?.name || '')}" style="max-width:100%;max-height:100%;object-fit:contain;" />
      </div>
      <div class="cart-item-details">
        <h4 class="cart-item-name">${escapeHTML(item.productSnapshot?.name || '')}</h4>
        <div class="cart-item-price">${formatINR(item.productSnapshot?.price || 0)}</div>
        <div class="cart-item-stepper">
          <div class="qty-counter" style="height:30px;">
            <button type="button" class="qty-btn" data-cart-minus="${item.productId}" style="width:28px;height:30px;font-size:0.9rem;">-</button>
            <span style="width:32px;display:flex;align-items:center;justify-content:center;font-size:0.85rem;font-weight:700;">${item.quantity}</span>
            <button type="button" class="qty-btn" data-cart-plus="${item.productId}" style="width:28px;height:30px;font-size:0.9rem;">+</button>
          </div>
          <button type="button" class="cart-item-remove-btn" data-cart-remove="${item.productId}">Remove</button>
        </div>
      </div>
    </div>
  `).join('');

  // Bind Stepper & Remove inside Cart Drawer
  itemsContainer.querySelectorAll('[data-cart-minus]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.dataset.cartMinus;
      const current = cart.find(i => i.productId === pid)?.quantity || 1;
      updateQuantity(pid, current - 1);
    });
  });

  itemsContainer.querySelectorAll('[data-cart-plus]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.dataset.cartPlus;
      const current = cart.find(i => i.productId === pid)?.quantity || 1;
      updateQuantity(pid, current + 1);
    });
  });

  itemsContainer.querySelectorAll('[data-cart-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.dataset.cartRemove;
      removeFromCart(pid);
    });
  });
}

/**
 * Render Customer Reviews & Feedback
 */
function renderReviews() {
  renderCustomerFeedback('reviews-grid');
}

/**
 * Newsletter Form Validation and Feedback
 */
function initNewsletterForm() {
  const form = document.getElementById('newsletter-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const emailInput = form.querySelector('input[type="email"]');
    const email = emailInput?.value.trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Please provide a valid email address.', 'error');
      emailInput?.focus();
      return;
    }

    showToast('Thank you for subscribing! We will notify you about contractor discounts and offers.', 'success');
    form.reset();
  });
}

/**
 * Initialize Authentication, Account Dropdown, and Modal Controls
 */
function initAuthUI() {
  // Listen for live auth state changes
  listenAuthState((user) => {
    updateAccountModalProfile(user);
  });

  window.addEventListener('devshree:auth-state-changed', (e) => {
    updateAccountModalProfile(e.detail?.user || null);
  });

  window.addEventListener('devshree:review-submitted', (e) => {
    const { productId, rating, reviewCount } = e.detail || {};
    if (!productId) return;
    document.querySelectorAll(`[data-product-rating-box="${productId}"]`).forEach(box => {
      box.innerHTML = `
        <div class="rating-stars" aria-label="${rating} out of 5 stars">
          ${renderStars(rating)}
        </div>
        <span class="rating-score">${Number(rating).toFixed(1)}</span>
        <span class="rating-count">(${reviewCount})</span>
        <button type="button" class="btn-product-review-trigger" data-review-product-id="${productId}" data-review-product-name="" title="Add your review">
          + Review
        </button>
      `;
      box.querySelector('.btn-product-review-trigger')?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        openFeedbackModal(productId);
      });
    });
  });

  // Account button in header
  const accountBtn = document.getElementById('header-account-btn');
  accountBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    if (user) {
      updateAccountModalProfile(user);
      openUserInvoicesModal();
    } else {
      openAuthModal('login');
    }
  });

  // Account button in mobile drawer
  document.getElementById('mobile-account-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('mobile-drawer')?.classList.remove('active');
    document.getElementById('mobile-drawer-overlay')?.classList.remove('active');
    document.body.style.overflow = '';
    const user = getCurrentUser();
    if (user) {
      updateAccountModalProfile(user);
      openUserInvoicesModal();
    } else {
      openAuthModal('login');
    }
  });

  // Close buttons for modals
  document.getElementById('auth-modal-close-btn')?.addEventListener('click', closeAuthModal);
  document.getElementById('auth-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('auth-modal')) closeAuthModal();
  });

  document.getElementById('invoices-modal-close-btn')?.addEventListener('click', () => {
    document.getElementById('invoices-list-modal')?.classList.remove('active');
    document.body.style.overflow = '';
  });
  document.getElementById('invoices-list-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('invoices-list-modal')) {
      document.getElementById('invoices-list-modal')?.classList.remove('active');
      document.body.style.overflow = '';
    }
  });

  document.getElementById('tax-invoice-close-btn')?.addEventListener('click', () => {
    document.getElementById('tax-invoice-modal')?.classList.remove('active');
    document.body.style.overflow = '';
  });
  document.getElementById('tax-invoice-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('tax-invoice-modal')) {
      document.getElementById('tax-invoice-modal')?.classList.remove('active');
      document.body.style.overflow = '';
    }
  });

  // Switch Auth Tabs
  document.getElementById('tab-btn-login')?.addEventListener('click', () => switchAuthTab('login'));
  document.getElementById('tab-btn-register')?.addEventListener('click', () => switchAuthTab('register'));
  document.getElementById('switch-to-register')?.addEventListener('click', () => switchAuthTab('register'));
  document.getElementById('switch-to-login')?.addEventListener('click', () => switchAuthTab('login'));
  document.getElementById('link-to-forgot')?.addEventListener('click', () => switchAuthTab('forgot'));
  document.getElementById('forgot-back-to-login')?.addEventListener('click', () => switchAuthTab('login'));

  // Sign out button
  document.getElementById('user-signout-btn')?.addEventListener('click', async (e) => {
    e?.preventDefault();
    const modal = document.getElementById('invoices-list-modal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
    updateAccountModalProfile(null);
    try {
      await logoutCustomer();
    } catch (err) {
      console.warn('[Home] Sign out error:', err);
    }
  });

  // Sign in form submit
  const loginForm = document.getElementById('auth-login-form');
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email')?.value.trim();
    const password = document.getElementById('login-password')?.value;

    if (!email || !password) {
      showToast('Please enter both your email address and password.', 'error');
      return;
    }

    const submitBtn = document.getElementById('login-submit-btn');
    const originalText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.textContent = 'Signing in...';
      submitBtn.disabled = true;
    }

    try {
      const user = await loginCustomer(email, password);
      closeAuthModal();
      loginForm.reset();
      const isAdmin = user && (user.role === 'admin' || isAdminEmail(user.email));
      if (isAdmin) {
        showToast('Admin access verified! Opening Admin Console...', 'success');
      }
    } catch (err) {
      console.warn('[Devshree] Login attempt failed:', err);
    } finally {
      if (submitBtn) {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    }
  });

  // Register form submit
  const registerForm = document.getElementById('auth-register-form');
  registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name')?.value.trim();
    const email = document.getElementById('reg-email')?.value.trim();
    const phone = document.getElementById('reg-phone')?.value.trim();
    const password = document.getElementById('reg-password')?.value;
    const confirmPassword = document.getElementById('reg-confirm-password')?.value;

    if (!name || !email || !password) {
      showToast('Please fill in your name, email, and password.', 'error');
      return;
    }

    if (password.length < 6) {
      showToast('Password must be at least 6 characters long.', 'error');
      return;
    }

    if (password !== confirmPassword) {
      showToast('Passwords do not match. Please re-enter carefully.', 'error');
      return;
    }

    const submitBtn = document.getElementById('register-submit-btn');
    const originalText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.textContent = 'Creating account...';
      submitBtn.disabled = true;
    }

    try {
      await registerCustomer(name, email, phone, password);
      closeAuthModal();
      registerForm.reset();
    } catch (err) {
      console.warn('[Devshree] Register attempt failed:', err);
    } finally {
      if (submitBtn) {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    }
  });

  // Forgot password form submit
  const forgotForm = document.getElementById('auth-forgot-form');
  forgotForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email')?.value.trim();
    if (!email) {
      showToast('Please enter your email address.', 'error');
      return;
    }
    await resetPassword(email);
    switchAuthTab('login');
  });

  // Google sign-in
  document.getElementById('google-signin-btn')?.addEventListener('click', async () => {
    try {
      await loginWithGoogle();
      closeAuthModal();
    } catch (err) {
      console.warn('[Devshree] Google sign-in error:', err);
    }
  });

  // Instant Guest Access button (for quick browsing / fallback)
  document.getElementById('auth-demo-guest-btn')?.addEventListener('click', () => {
    const demoGuest = {
      uid: 'guest-' + Date.now().toString(36),
      displayName: 'Valued Customer',
      email: 'customer@devshree.in',
      phone: '+91 98765 43210',
      role: 'customer'
    };
    setStorage('devshree_current_user', demoGuest);
    notifyAuthChange(demoGuest);
    showToast('Signed in as Guest Customer! You can now place orders & generate GST bills.', 'success');
    closeAuthModal();
  });
}

async function updateAccountModalProfile(user) {
  const nameEl = document.getElementById('user-display-name');
  const emailEl = document.getElementById('user-display-email');
  const initialEl = document.getElementById('user-avatar-initial');
  const roleBadge = document.getElementById('user-role-badge');
  const quickActions = document.getElementById('admin-profile-quick-actions');
  if (!user) {
    if (nameEl) nameEl.textContent = 'Customer Account';
    if (emailEl) emailEl.textContent = 'user@devshree.in';
    if (initialEl) initialEl.textContent = 'U';
    if (roleBadge) {
      roleBadge.textContent = 'Verified Customer';
      roleBadge.style.background = '';
      roleBadge.style.color = '';
    }
    if (quickActions) quickActions.innerHTML = '';
    return;
  }

  const displayName = user.displayName || user.email?.split('@')[0] || 'Customer';
  if (nameEl) nameEl.textContent = displayName;
  if (emailEl) emailEl.textContent = user.email || '';
  if (initialEl) initialEl.textContent = displayName.charAt(0).toUpperCase();

  const isAdmin = await checkIsUserAdmin(user);
  if (isAdmin) {
    if (roleBadge) {
      roleBadge.textContent = 'Store Administrator';
      roleBadge.style.background = '#F28C28';
      roleBadge.style.color = '#FFFFFF';
    }
    if (quickActions) {
      quickActions.innerHTML = `
        <a href="admin.html" class="btn btn-primary btn-sm" style="font-size:0.775rem;padding:0.35rem 0.65rem;background:#F28C28;border:none;text-decoration:none;">
          Open Admin Console &rarr;
        </a>
      `;
    }
  } else {
    if (roleBadge) {
      roleBadge.textContent = 'Verified Customer';
      roleBadge.style.background = '';
      roleBadge.style.color = '';
    }
    if (quickActions) {
      quickActions.innerHTML = '';
    }
  }
}



/**
 * Initialize Home Page Catalogs Carousel Track & View Pill Handlers
 * Matches reference photo with direct PDF downloads and in-browser modal viewing
 */
/**
 * Initialize Home Page Official Brand PDF Catalogs Rail & View / Download Handlers
 * Matches Devshree's Scandinavian architectural library aesthetic with modal previews and direct downloads.
 */
function initHomeCatalogsCarousel() {
  const track = document.getElementById('home-pdf-catalogs-track') || document.getElementById('home-catalogs-track');
  const prevBtn = document.getElementById('pdf-catalogs-prev');
  const nextBtn = document.getElementById('pdf-catalogs-next') || document.getElementById('home-catalogs-next');
  if (!track) return;

  // Retrieve dynamic catalogs from catalogs-data.js or localStorage
  const sourceCatalogs = (typeof getActiveCatalogs === 'function')
    ? getActiveCatalogs()
    : (typeof DEVSHREE_CATALOGS !== 'undefined' ? DEVSHREE_CATALOGS : []);

  if (sourceCatalogs && sourceCatalogs.length > 0) {
    track.innerHTML = sourceCatalogs.map(c => `
      <article class="pdf-catalog-card" data-catalog-id="${escapeHTML(c.id)}">
        <div class="pdf-card-cover-wrap">
          <img src="${escapeHTML(c.coverImage || 'assets/images/catalogs/catalog_acrysoft_genoa.jpg')}" alt="${escapeHTML(c.title)}" class="pdf-card-cover-img" loading="lazy" />
          <span class="pdf-brand-badge">${escapeHTML(c.brand)}</span>
          <span class="pdf-type-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8" fill="none" stroke="#FFF" stroke-width="2"></polyline></svg>
            PDF
          </span>
        </div>
        <div class="pdf-card-body">
          <span class="pdf-card-cat">${escapeHTML(c.category)}</span>
          <h3 class="pdf-card-title">${escapeHTML(c.title)}</h3>
          <p class="pdf-card-desc">${escapeHTML(c.description || '')}</p>
          <div class="pdf-card-meta">
            <span class="pdf-meta-pill">${c.pages || 1} Pages</span>
            <span class="pdf-meta-pill">${escapeHTML(c.size || 'PDF')}</span>
          </div>
          <div class="pdf-card-actions">
            <button type="button" class="btn-pdf-view" data-view-pdf="${escapeHTML(c.pdfUrl)}" data-title="${escapeHTML(c.title)}" data-filename="${escapeHTML(c.filename || 'catalog.pdf')}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              <span>View PDF</span>
            </button>
            <a href="${escapeHTML(c.pdfUrl)}" download="${escapeHTML(c.filename || 'catalog.pdf')}" class="btn-pdf-download" title="Download ${escapeHTML(c.title)} PDF">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span>Download</span>
            </a>
          </div>
        </div>
      </article>
    `).join('');
  }

  // Next / Prev Smooth Horizontal Scrolling
  prevBtn?.replaceWith(prevBtn.cloneNode(true));
  nextBtn?.replaceWith(nextBtn.cloneNode(true));
  const newPrevBtn = document.getElementById('pdf-catalogs-prev');
  const newNextBtn = document.getElementById('pdf-catalogs-next') || document.getElementById('home-catalogs-next');

  newPrevBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    track.scrollBy({ left: -340, behavior: 'smooth' });
  });

  newNextBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    track.scrollBy({ left: 340, behavior: 'smooth' });
  });

  // Modal PDF Viewer Binding for in-browser inspection
  track.querySelectorAll('.btn-pdf-view, .btn-catalog-view-pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pdf = btn.dataset.viewPdf || btn.getAttribute('href');
      const title = btn.dataset.title || 'Brand Catalog Lookbook';
      const filename = btn.dataset.filename || 'catalog.pdf';
      if (typeof openPdfViewerModal === 'function') {
        e.preventDefault();
        openPdfViewerModal(pdf, title, filename);
      }
    });
  });
}

// Live sync listener for catalogs & products updates from admin console
if (typeof window !== 'undefined' && !window._devshreeHomeCatalogsBound) {
  window._devshreeHomeCatalogsBound = true;
  window.addEventListener('devshree:catalogs-updated', () => initHomeCatalogsCarousel());
  window.addEventListener('storage', (e) => {
    if (e.key === 'devshree_custom_catalogs') initHomeCatalogsCarousel();
    if (e.key === 'devshree_cached_products') {
      renderProductSections();
      renderDealsRail();
    }
  });
  window.addEventListener('devshree:products-updated', () => {
    renderProductSections();
    renderDealsRail();
  });
}
