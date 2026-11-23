/**
 * DEVSHREE BRASS — DEDICATED CATEGORY & SUBCATEGORY CONTROLLER (category.js)
 * Matching the exact visual architecture from the reference screen recording:
 * 1. Dedicated 2-column layout (Left: Circular Subcategories Rail, Right: Products Grid).
 * 2. 52px circular subcategory thumbnails with terracotta active indicator & circular ring border.
 * 3. Dynamic breadcrumb synchronization: Home › [Department] › [Subcategory].
 * 4. Instant 0ms client-side product filtering & sorting.
 * 5. Full shopping capabilities: Quick View modal, Cart Drawer, Wishlist, WhatsApp alerts.
 */

import { getAllAvailableProducts, getProductById } from './products.js';
import { getActiveCategories, getSubcategoriesForCategory, DEFAULT_CATEGORIES } from './categories-data.js';
import { addToCart, initCartBadge, getCart, getCartCount, getCartTotals, updateQuantity, removeFromCart } from './cart.js';
import { initWishlistBadge, isInWishlist, toggleWishlist } from './wishlist.js';
import { 
  formatINR, 
  calculateDiscount, 
  escapeHTML,
  showToast 
} from './utils.js';
import { SUBCATEGORY_SIDEBAR_THUMBNAILS } from './home.js';

// Department naming and icon fallbacks
const DEPT_META = {
  'cat-hardware': { name: 'Hardware', title: 'Hardware Supplies', icon: '🔩', image: 'assets/images/cat_hardware.jpg' },
  'cat-electric': { name: 'Electric', title: 'Electric Supplies', icon: '⚡', image: 'assets/images/cat_electrical.jpg' },
  'cat-electrical': { name: 'Electric', title: 'Electric Supplies', icon: '⚡', image: 'assets/images/cat_electrical.jpg' },
  'cat-plumbing': { name: 'Plumbing', title: 'Plumbing Supplies', icon: '🚰', image: 'assets/images/cat_plumbing.jpg' },
  'cat-paints': { name: 'Paints', title: 'Paints & Wall Putty', icon: '🎨', image: 'assets/images/cat_paints.jpg' },
  'cat-lamination': { name: 'Lamination', title: 'Laminates & Panels', icon: '🪵', image: 'assets/images/categories/cat_laminates_liners.jpg' },
};

// Current active state on category page
let activeCatId = 'cat-hardware';
let activeSubcatId = '';
let currentSort = 'featured';
let currentSearchQuery = '';

/**
 * Initialize Category Page
 */
export async function initCategoryPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const paramCat = urlParams.get('cat') || urlParams.get('dept') || 'cat-hardware';
  const paramSubcat = urlParams.get('subcat') || '';

  activeCatId = (paramCat === 'all' || !paramCat) ? 'cat-hardware' : paramCat;
  activeSubcatId = paramSubcat;

  // Initialize UI subsystems
  initCartDrawer();
  initCartBadge();
  initWishlistBadge();
  initMobileDrawer();
  initHeaderCatStrip();
  initSearchAndSort();
  initViewAllButton();

  // Render Category Subsystem
  renderCategoryView(activeCatId, activeSubcatId);

  // Handle browser back / forward navigation
  window.addEventListener('popstate', () => {
    const p = new URLSearchParams(window.location.search);
    activeCatId = p.get('cat') || 'cat-hardware';
    activeSubcatId = p.get('subcat') || '';
    renderCategoryView(activeCatId, activeSubcatId, false);
  });
}

/**
 * Render Complete Category View: Sidebar, Breadcrumbs, Banner & Products
 */
function renderCategoryView(catId, subcatId = '', updateUrl = true) {
  activeCatId = catId;
  activeSubcatId = subcatId;

  if (updateUrl) {
    const url = new URL(window.location);
    url.searchParams.set('cat', catId);
    if (subcatId) {
      url.searchParams.set('subcat', subcatId);
    } else {
      url.searchParams.delete('subcat');
    }
    window.history.pushState({}, '', url);
  }

  // 1. Render Left Dedicated Circular Subcategories Rail
  renderSubcategorySidebar(catId, subcatId);

  // 2. Render Breadcrumb Navigation
  renderBreadcrumbs(catId, subcatId);

  // 3. Render Header Banner Title & Count
  renderHeaderBanner(catId, subcatId);

  // 4. Render Products Grid
  renderProductsGrid(catId, subcatId);

  // 5. Update Active State in Header Category Strip
  syncHeaderCategoryStrip(catId);
}

/**
 * Render Left Column: Dedicated Circular Subcategories Rail (Matching Reference Video)
 */
function renderSubcategorySidebar(catId, selectedSubcatId) {
  const railTrack = document.getElementById('category-subcat-rail-track');
  if (!railTrack) return;

  const allCategories = getActiveCategories();
  const currentCat = allCategories.find(c => c.id === catId || ((catId === 'cat-electric' || catId === 'cat-electrical') && (c.id === 'cat-electric' || c.id === 'cat-electrical'))) || DEPT_META[catId] || {
    id: catId,
    name: 'Hardware',
    image: 'assets/images/cat_hardware.jpg'
  };

  const subcategories = getSubcategoriesForCategory(catId);
  const allProds = getAllAvailableProducts();
  const catProds = allProds.filter(p => {
    const pCat = p.categoryId || p.category_id || '';
    return pCat === catId || ((catId === 'cat-electric' || catId === 'cat-electrical') && (pCat === 'cat-electric' || pCat === 'cat-electrical'));
  });

  // 1. "All [Department]" Button (Circular thumbnail with department image)
  let railHtml = `
    <button 
      type="button" 
      class="subcat-vrail-item ${!selectedSubcatId ? 'active' : ''}" 
      data-vrail-cat="${escapeHTML(currentCat.id)}" 
      data-vrail-subcat="" 
      title="View all ${escapeHTML(currentCat.name)} products"
      role="tab"
      aria-selected="${!selectedSubcatId ? 'true' : 'false'}"
    >
      <div class="subcat-vrail-thumb">
        <img src="${escapeHTML(currentCat.image || currentCat.imageUrl || 'assets/images/cat_hardware.jpg')}" alt="All ${escapeHTML(currentCat.name)}" class="subcat-vrail-img" loading="eager" />
      </div>
      <span class="subcat-vrail-label">All ${escapeHTML(currentCat.name)}</span>
    </button>
  `;

  // 2. Each Subcategory Button with 52px Circular Thumbnail (Matching Video Reference)
  subcategories.forEach(sub => {
    const isSubActive = String(selectedSubcatId).toLowerCase() === String(sub.id).toLowerCase() || 
                        String(selectedSubcatId).toLowerCase() === String(sub.name).toLowerCase();
    const thumbImg = SUBCATEGORY_SIDEBAR_THUMBNAILS[sub.id] || currentCat.image || currentCat.imageUrl || 'assets/images/cat_hardware.jpg';

    railHtml += `
      <button 
        type="button" 
        class="subcat-vrail-item ${isSubActive ? 'active' : ''}" 
        data-vrail-cat="${escapeHTML(currentCat.id)}" 
        data-vrail-subcat="${escapeHTML(sub.id)}" 
        title="Filter by ${escapeHTML(sub.name)}"
        role="tab"
        aria-selected="${isSubActive ? 'true' : 'false'}"
      >
        <div class="subcat-vrail-thumb">
          <img src="${escapeHTML(thumbImg)}" alt="${escapeHTML(sub.name)}" class="subcat-vrail-img" loading="lazy" />
        </div>
        <span class="subcat-vrail-label">${escapeHTML(sub.name)}</span>
      </button>
    `;
  });

  railTrack.innerHTML = railHtml;

  // Attach click listeners to circular rail items
  railTrack.querySelectorAll('.subcat-vrail-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetSubcat = btn.dataset.vrailSubcat || '';
      renderCategoryView(catId, targetSubcat, true);
    });
  });
}

/**
 * Render Breadcrumb Navigation (Home › Department › Subcategory)
 */
function renderBreadcrumbs(catId, subcatId) {
  const deptItem = document.getElementById('cat-page-crumb-dept-item');
  const deptLink = document.getElementById('cat-page-crumb-dept-link');
  const subcatItem = document.getElementById('cat-page-crumb-subcat-item');
  const subcatText = document.getElementById('cat-page-crumb-subcat-text');

  const allCategories = getActiveCategories();
  const currentCat = allCategories.find(c => c.id === catId || ((catId === 'cat-electric' || catId === 'cat-electrical') && (c.id === 'cat-electric' || c.id === 'cat-electrical'))) || DEPT_META[catId] || { name: 'Hardware' };

  if (deptLink) {
    deptLink.textContent = currentCat.name;
    deptLink.onclick = (e) => {
      e.preventDefault();
      renderCategoryView(catId, '', true);
    };
  }

  if (subcatId) {
    const subcategories = getSubcategoriesForCategory(catId);
    const subObj = subcategories.find(s => s.id === subcatId || s.name.toLowerCase() === subcatId.toLowerCase());
    const subName = subObj ? subObj.name : subcatId;

    if (subcatItem && subcatText) {
      subcatItem.style.display = 'inline-flex';
      subcatText.textContent = subName;
    }
  } else {
    if (subcatItem) subcatItem.style.display = 'none';
  }
}

/**
 * Render Category Header Banner (Title & Count)
 */
function renderHeaderBanner(catId, subcatId) {
  const pageTitle = document.getElementById('category-page-title');
  const pageCount = document.getElementById('category-page-count');
  const filterChip = document.getElementById('category-filter-chip');
  const filterChipText = document.getElementById('category-filter-chip-text');

  const allCategories = getActiveCategories();
  const currentCat = allCategories.find(c => c.id === catId || ((catId === 'cat-electric' || catId === 'cat-electrical') && (c.id === 'cat-electric' || c.id === 'cat-electrical'))) || DEPT_META[catId] || { name: 'Hardware', title: 'Hardware Supplies' };

  if (subcatId) {
    const subcategories = getSubcategoriesForCategory(catId);
    const subObj = subcategories.find(s => s.id === subcatId || s.name.toLowerCase() === subcatId.toLowerCase());
    const subName = subObj ? subObj.name : subcatId;

    if (pageTitle) pageTitle.textContent = subName;
    if (filterChip && filterChipText) {
      filterChipText.textContent = `${currentCat.name} › ${subName}`;
      filterChip.style.display = 'inline-flex';
    }
  } else {
    if (pageTitle) pageTitle.textContent = currentCat.title || `${currentCat.name} Supplies`;
    if (filterChip) filterChip.style.display = 'none';
  }
}

/**
 * Render Product Cards into 4-Column Grid
 */
function renderProductsGrid(catId, subcatId) {
  const grid = document.getElementById('category-products-grid');
  const emptyState = document.getElementById('category-empty-state');
  const pageCount = document.getElementById('category-page-count');
  if (!grid) return;

  const allProds = getAllAvailableProducts();
  const subcategories = getSubcategoriesForCategory(catId);
  const activeSubObj = subcategories.find(s => s.id === subcatId || s.name.toLowerCase() === subcatId.toLowerCase());
  const subName = activeSubObj ? activeSubObj.name : subcatId;

  // 1. Filter by Department
  let filtered = allProds.filter(p => {
    const pCat = p.categoryId || p.category_id || '';
    return pCat === catId || ((catId === 'cat-electric' || catId === 'cat-electrical') && (pCat === 'cat-electric' || pCat === 'cat-electrical'));
  });

  // 2. Filter by Subcategory if selected
  if (subcatId) {
    const subTarget = subcatId.toLowerCase();
    const subNameTarget = subName.toLowerCase();
    filtered = filtered.filter(p => {
      const pSub = String(p.subcategoryId || p.subcategory_id || '').toLowerCase();
      const pSubName = String(p.subcategoryName || p.subcategory_name || '').toLowerCase();
      const pName = String(p.name || '').toLowerCase();
      return pSub === subTarget || pSubName === subNameTarget || pSubName.includes(subNameTarget) || pName.includes(subNameTarget);
    });
  }

  // 3. Filter by search query if typed
  if (currentSearchQuery) {
    const q = currentSearchQuery.toLowerCase();
    filtered = filtered.filter(p => {
      const pName = String(p.name || '').toLowerCase();
      const pBrand = String(p.brand || '').toLowerCase();
      const pSku = String(p.sku || '').toLowerCase();
      return pName.includes(q) || pBrand.includes(q) || pSku.includes(q);
    });
  }

  // 4. Sort products
  if (currentSort === 'price-low') {
    filtered.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
  } else if (currentSort === 'price-high') {
    filtered.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
  } else if (currentSort === 'name-asc') {
    filtered.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }

  // 5. Update count
  if (pageCount) {
    pageCount.textContent = `${filtered.length} Verified Product${filtered.length === 1 ? '' : 's'} Available`;
  }

  // 6. Handle empty state
  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  // 7. Render Product Cards (Instant 0ms paint)
  grid.innerHTML = filtered.map(product => createCategoryProductCardHtml(product)).join('');

  // Attach button event listeners
  grid.querySelectorAll('[data-add-cart-btn]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const pid = btn.dataset.productId;
      if (pid) {
        addToCart(pid, 1);
        btn.textContent = '✓ Added!';
        setTimeout(() => { btn.textContent = 'Add to Cart'; }, 1500);
      }
    });
  });

  grid.querySelectorAll('[data-quick-view-btn]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const pid = btn.dataset.productId;
      if (pid) openQuickViewModal(pid);
    });
  });

  grid.querySelectorAll('[data-wishlist-btn]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const pid = btn.dataset.productId;
      if (pid) {
        const isNowInWishlist = toggleWishlist(pid);
        btn.classList.toggle('active', isNowInWishlist);
        initWishlistBadge();
      }
    });
  });
}

/**
 * Reusable Product Card HTML Template
 */
function createCategoryProductCardHtml(product) {
  const discount = calculateDiscount(product.price, product.compareAtPrice, product.discountPercentage);
  const inWishlist = isInWishlist(product.id);
  const comparePrice = product.compareAtPrice || (discount > 0 ? Math.round(product.price / (1 - discount / 100)) : null);

  let badgeHtml = '';
  if (discount > 0) {
    badgeHtml += `<span class="badge badge-discount">${discount}% OFF</span>`;
  }
  if (product.isBestseller) {
    badgeHtml += `<span class="badge badge-bestseller">BESTSELLER</span>`;
  }

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
          <span class="product-brand">${escapeHTML(product.brand || 'Devshree')}</span>
        </div>

        <h3 class="product-title">
          <a href="product.html?id=${encodeURIComponent(product.id)}">
            ${escapeHTML(product.name)}
          </a>
        </h3>

        <div class="product-rating product-rating-clean" data-product-rating-box="${product.id}">
          ${(product.reviewCount && product.reviewCount > 0 && product.rating > 0) ? `
            <div class="rating-stars" aria-label="${product.rating} out of 5 stars">
              ${renderRatingStars(product.rating)}
            </div>
            <span class="rating-score">${Number(product.rating).toFixed(1)}</span>
            <span class="rating-count">(${product.reviewCount})</span>
          ` : `
            <span class="rating-no-reviews">☆ 5.0 (Trade Verified)</span>
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

function renderRatingStars(rating) {
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
 * Quick View Modal Launcher
 */
async function openQuickViewModal(productId) {
  const modal = document.getElementById('quick-view-modal');
  const body = document.getElementById('modal-dynamic-body');
  const closeBtn = document.getElementById('modal-close-btn');
  if (!modal || !body) return;

  const product = await getProductById(productId);
  if (!product) return;

  body.innerHTML = `
    <div style="display:flex; gap:1.5rem; flex-wrap:wrap;">
      <div style="flex:1; min-width:260px; text-align:center;">
        <img src="${product.image}" alt="${escapeHTML(product.name)}" style="max-width:100%; max-height:280px; object-fit:contain; border-radius:12px;" />
      </div>
      <div style="flex:1.2; min-width:280px; display:flex; flex-direction:column; gap:0.75rem;">
        <span style="font-size:0.75rem; color:var(--color-accent); font-weight:700; text-transform:uppercase;">${escapeHTML(product.brand || 'Devshree')}</span>
        <h2 style="font-size:1.25rem; font-weight:700; margin:0;">${escapeHTML(product.name)}</h2>
        <div style="font-size:1.35rem; font-weight:800; color:var(--color-accent);">${formatINR(product.price)}</div>
        <p style="font-size:0.85rem; color:var(--color-text-secondary); line-height:1.5;">${escapeHTML(product.description || 'Verified architectural trade hardware item.')}</p>
        <div style="display:flex; gap:0.75rem; margin-top:auto;">
          <button type="button" class="btn btn-primary" id="modal-add-cart-action" style="flex:1;">Add to Cart</button>
          <a href="product.html?id=${encodeURIComponent(product.id)}" class="btn btn-secondary">Full Details</a>
        </div>
      </div>
    </div>
  `;

  modal.classList.add('is-open');

  const addAction = body.querySelector('#modal-add-cart-action');
  addAction?.addEventListener('click', () => {
    addToCart(product.id, 1);
    addAction.textContent = '✓ Added to Cart!';
    setTimeout(() => { modal.classList.remove('is-open'); }, 800);
  });

  closeBtn?.addEventListener('click', () => modal.classList.remove('is-open'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('is-open');
  });
}

/**
 * Setup Slide-Over Cart Drawer
 */
function initCartDrawer() {
  const cartBtn = document.getElementById('header-cart-btn');
  const drawer = document.getElementById('cart-drawer');
  const backdrop = document.getElementById('cart-drawer-backdrop');
  const closeBtn = document.getElementById('cart-drawer-close');

  const openDrawer = () => {
    renderCartDrawerItems();
    drawer?.classList.add('active');
    backdrop?.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  const closeDrawer = () => {
    drawer?.classList.remove('active');
    backdrop?.classList.remove('active');
    document.body.style.overflow = '';
  };

  cartBtn?.addEventListener('click', openDrawer);
  closeBtn?.addEventListener('click', closeDrawer);
  backdrop?.addEventListener('click', closeDrawer);

  window.addEventListener('storage', () => {
    initCartBadge();
    if (drawer?.classList.contains('active')) renderCartDrawerItems();
  });
}

function renderCartDrawerItems() {
  const container = document.getElementById('cart-drawer-items');
  const countEl = document.getElementById('cart-drawer-count');
  const subtotalEl = document.getElementById('cart-subtotal-val');
  if (!container) return;

  const cart = getCart();
  const count = getCartCount();
  const totals = getCartTotals();

  if (countEl) countEl.textContent = `(${count})`;
  if (subtotalEl) subtotalEl.textContent = formatINR(totals.subtotal);

  if (cart.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:3rem 1rem; color:var(--color-text-secondary);">
        <p style="font-weight:700; font-size:1.05rem; margin-bottom:0.35rem;">Your Cart is Empty</p>
        <p style="font-size:0.85rem;">Browse verified architectural hardware, electric supplies, and laminates.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item" data-cart-item-id="${item.productId}" style="display:flex; gap:0.75rem; padding:0.75rem 0; border-bottom:1px solid #E5E0D8; align-items:center;">
      <div style="width:48px; height:48px; background:#FAF7F2; border-radius:8px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
        <img src="${item.productSnapshot?.image || 'assets/images/placeholder.webp'}" alt="${escapeHTML(item.productSnapshot?.name || '')}" style="max-width:100%; max-height:100%; object-fit:contain;" />
      </div>
      <div style="flex:1;">
        <h4 style="font-size:0.85rem; font-weight:600; margin:0 0 0.25rem;">${escapeHTML(item.productSnapshot?.name || '')}</h4>
        <div style="font-size:0.85rem; font-weight:700; color:var(--color-accent);">${formatINR(item.productSnapshot?.price || 0)}</div>
        <div style="display:flex; align-items:center; gap:0.5rem; margin-top:0.25rem;">
          <button type="button" class="qty-btn" data-cart-minus="${item.productId}" style="width:22px; height:22px; border:1px solid #CBD5E1; border-radius:4px; background:#FFF; cursor:pointer;">-</button>
          <span style="font-size:0.8rem; font-weight:700;">${item.quantity}</span>
          <button type="button" class="qty-btn" data-cart-plus="${item.productId}" style="width:22px; height:22px; border:1px solid #CBD5E1; border-radius:4px; background:#FFF; cursor:pointer;">+</button>
          <button type="button" class="btn-link" data-cart-remove="${item.productId}" style="margin-left:auto; font-size:0.75rem; color:#EF4444; background:none; border:none; cursor:pointer;">Remove</button>
        </div>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-cart-minus]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.dataset.cartMinus;
      const current = cart.find(i => i.productId === pid)?.quantity || 1;
      updateQuantity(pid, current - 1);
      initCartBadge();
      renderCartDrawerItems();
    });
  });

  container.querySelectorAll('[data-cart-plus]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.dataset.cartPlus;
      const current = cart.find(i => i.productId === pid)?.quantity || 1;
      updateQuantity(pid, current + 1);
      initCartBadge();
      renderCartDrawerItems();
    });
  });

  container.querySelectorAll('[data-cart-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.dataset.cartRemove;
      removeFromCart(pid);
      initCartBadge();
      renderCartDrawerItems();
    });
  });
}

/**
 * Setup Header Category Strip Interaction
 */
function initHeaderCatStrip() {
  const links = document.querySelectorAll('.header-cat-link, .dropdown-subcat-link, .dropdown-dept-all-btn');
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      const cat = link.dataset.catId;
      const sub = link.dataset.subcatId || '';
      if (cat) {
        e.preventDefault();
        renderCategoryView(cat, sub, true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });
}

function syncHeaderCategoryStrip(catId) {
  document.querySelectorAll('.header-cat-item').forEach(item => {
    const itemCat = item.dataset.cat;
    item.classList.toggle('active', itemCat === catId || ((catId === 'cat-electric' || catId === 'cat-electrical') && (itemCat === 'cat-electric' || itemCat === 'cat-electrical')));
  });
}

/**
 * Setup Search and Sort Handlers
 */
function initSearchAndSort() {
  const searchForm = document.getElementById('category-search-form');
  const searchInput = document.getElementById('category-search-input');
  const sortSelect = document.getElementById('category-sort-select');
  const clearFilterBtn = document.getElementById('category-filter-chip-clear');

  searchForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    currentSearchQuery = searchInput?.value?.trim() || '';
    renderProductsGrid(activeCatId, activeSubcatId);
  });

  searchInput?.addEventListener('input', () => {
    currentSearchQuery = searchInput.value.trim();
    renderProductsGrid(activeCatId, activeSubcatId);
  });

  sortSelect?.addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderProductsGrid(activeCatId, activeSubcatId);
  });

  clearFilterBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    renderCategoryView(activeCatId, '', true);
  });
}

function initViewAllButton() {
  const btn = document.getElementById('btn-category-view-all');
  btn?.addEventListener('click', (e) => {
    e.preventDefault();
    renderCategoryView(activeCatId, '', true);
  });
}

function initMobileDrawer() {
  const btn = document.getElementById('mobile-menu-btn');
  const close = document.getElementById('mobile-drawer-close');
  const overlay = document.getElementById('mobile-drawer-overlay');
  const drawer = document.getElementById('mobile-drawer');

  btn?.addEventListener('click', () => {
    drawer?.classList.add('is-open');
    overlay?.classList.add('is-open');
  });

  const closeDrawer = () => {
    drawer?.classList.remove('is-open');
    overlay?.classList.remove('is-open');
  };

  close?.addEventListener('click', closeDrawer);
  overlay?.addEventListener('click', closeDrawer);
}

// Auto-run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCategoryPage);
} else {
  initCategoryPage();
}
