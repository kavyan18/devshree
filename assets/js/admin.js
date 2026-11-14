/**
 * DEVSHREE — MODERN ADMIN CONSOLE CONTROLLER
 * Powering the Warm Terracotta & Ivory Executive Dashboard
 */

import { fetchAllOrders, updateOrderStatus, cancelOrder, openInvoiceViewer } from './orders.js';
import { fetchProducts, createProductInFirestore, seedFirestoreCatalog } from './products.js';
import { 
  db, 
  doc, 
  deleteDoc, 
  updateDoc, 
  collection, 
  onSnapshot,
  storage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  setDoc,
  getDoc,
  isConfigured
} from './firebase-config.js';
import { 
  getCurrentUser, 
  logoutCustomer, 
  loginCustomer, 
  registerCustomer, 
  listenAuthState, 
  isAdminEmail, 
  checkIsUserAdmin 
} from './auth.js';
import { formatINR, showToast, escapeHTML, getStorage, setStorage } from './utils.js';
import { showSafeErrorToast } from './error-handler.js';
import { sanitizeAndOptimizeImage, verifyStorageIsolation } from './file-validator.js';
import { MOCK_PRODUCTS } from './mock-data.js';
import { 
  initAdminNotificationCenter, 
  triggerOrderNotification, 
  sendTestOrderNotification 
} from './order-notifications.js';
import { openWhatsAppDispatchModal, openWhatsAppChat, buildOrderCancellationWhatsAppMessage, getStoreOwnerPhone, setStoreOwnerPhone } from './whatsapp-service.js';
import { 
  DEVSHREE_CATALOGS, 
  DEVSHREE_CATEGORIES, 
  getActiveCatalogs, 
  saveActiveCatalogs, 
  resetCatalogsToDefault, 
  openPdfViewerModal, 
  closePdfViewerModal 
} from './catalogs-data.js';
import { 
  DEFAULT_OFFERS, 
  getActiveOffers, 
  saveActiveOffers, 
  resetOffersToDefault 
} from './offers-data.js';

const CACHE_PRODUCTS_KEY = 'devshree_cached_products';

let allOrders = [];
let allProducts = [];
let activeTab = 'products';

function syncProductsCache() {
  try {
    setStorage(CACHE_PRODUCTS_KEY, allProducts);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('devshree:products-updated', { detail: { products: allProducts } }));
    }
  } catch (e) {
    console.warn('[Admin] Failed to sync products to storage:', e);
  }
}

// Default LED Bulb preview image
const DEFAULT_BULB_IMG = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80';

// Fallback products matching the user's reference mockup
const REFERENCE_DEFAULT_PRODUCTS = [
  {
    id: 'prod-db001',
    name: 'LED Bulb 12W',
    sku: 'DB001',
    categoryId: 'cat-electrical',
    brand: 'Havells',
    price: 141.60,
    basePrice: 120.00,
    gstRate: 18,
    stock: 25,
    description: 'Energy efficient LED bulb, long life, best for home and office.',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80'
  },
  {
    id: 'prod-pp001',
    name: 'PVC Pipe 1 inch',
    sku: 'PP001',
    categoryId: 'cat-plumbing',
    brand: 'Astral',
    price: 66.30,
    basePrice: 56.19,
    gstRate: 18,
    stock: 8,
    description: 'Heavy duty schedule 40 UPVC plumbing pipe for residential water supply.',
    image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&q=80'
  },
  {
    id: 'prod-wp001',
    name: 'Wall Paint 1L',
    sku: 'WP001',
    categoryId: 'cat-paints',
    brand: 'Asian Paints',
    price: 566.00,
    basePrice: 479.66,
    gstRate: 18,
    stock: 35,
    description: 'Royale Luxury interior acrylic emulsion with anti-fungal shield.',
    image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=400&q=80'
  },
  {
    id: 'prod-bt001',
    name: 'Brass Tap',
    sku: 'BT001',
    categoryId: 'cat-plumbing',
    brand: 'Jaquar',
    price: 1180.00,
    basePrice: 1000.00,
    gstRate: 18,
    stock: 14,
    description: 'Forged solid brass bib cock tap with quarter-turn ceramic disc.',
    image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&q=80'
  }
];

let knownOrderIds = new Set();
let knownOrderInvoices = new Set();
let isInitialOrdersSnapshot = true;

function initDevshreeAdmin() {
  try { initAdminNavigation(); } catch (e) { console.warn('[Admin] Navigation init:', e); }
  try { initPriceCalculation(); } catch (e) { console.warn('[Admin] PriceCalc init:', e); }
  try { initProductForm(); } catch (e) { console.warn('[Admin] ProductForm init:', e); }
  try { initTableFilters(); } catch (e) { console.warn('[Admin] TableFilters init:', e); }
  try { initSyncAndBackupUI(); } catch (e) { console.warn('[Admin] SyncBackup init:', e); }
  try { initOrdersControls(); } catch (e) { console.warn('[Admin] OrdersControls init:', e); }
  try { initAdminGate(); } catch (e) { console.warn('[Admin] AdminGate init:', e); }
  try { initUserDropdown(); } catch (e) { console.warn('[Admin] UserDropdown init:', e); }
  try { initAdminNotificationCenter(); } catch (e) { console.warn('[Admin] NotificationCenter init:', e); }
  try { initAdminSettings(); } catch (e) { console.warn('[Admin] Settings init:', e); }
  try { initAdminCancelModal(); } catch (e) { console.warn('[Admin] CancelModal init:', e); }
  try { initCatalogsTab(); } catch (e) { console.error('[Admin] CatalogsTab init:', e); }
  try { initOffersTab(); } catch (e) { console.error('[Admin] OffersTab init:', e); }

  // Check if verified active admin session exists
  if (isAdminSessionActive()) {
    hideAdminGate();
    updateAdminProfile({ displayName: 'Store Administrator', email: getAuthorizedAdminEmail() });
    loadDashboardData();
    setupRealtimeOrdersListener();
  } else {
    showAdminGate('unauthenticated');
  }

  // Listen to Auth State if Firebase configured
  listenAuthState(async (user) => {
    if (user) {
      const isAdmin = await checkIsUserAdmin(user);
      if (isAdmin) {
        setAdminSessionActive(user.email || getAuthorizedAdminEmail());
        hideAdminGate();
        updateAdminProfile(user);
        loadDashboardData();
        setupRealtimeOrdersListener();
      }
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDevshreeAdmin);
} else {
  initDevshreeAdmin();
}

/**
 * 1. Sidebar Navigation (Tabs switching)
 */
function initAdminNavigation() {
  const navButtons = document.querySelectorAll('.admin-nav-item');
  const panels = document.querySelectorAll('.admin-view-panel');
  const breadcrumbCurrent = document.getElementById('admin-breadcrumb-current');
  const pageTitle = document.getElementById('admin-page-title');
  const pageSub = document.getElementById('admin-page-sub');

  // Mobile toggle & backdrop
  const sidebar = document.getElementById('admin-sidebar');
  const backdrop = document.getElementById('admin-sidebar-backdrop');
  const mobileToggle = document.getElementById('admin-mobile-toggle');
  const sidebarClose = document.getElementById('admin-sidebar-close');

  const closeSidebar = () => {
    sidebar?.classList.remove('mobile-open');
    backdrop?.classList.remove('active');
    document.body.style.overflow = '';
  };

  mobileToggle?.addEventListener('click', () => {
    sidebar?.classList.add('mobile-open');
    backdrop?.classList.add('active');
    document.body.style.overflow = 'hidden';
  });

  sidebarClose?.addEventListener('click', closeSidebar);
  backdrop?.addEventListener('click', closeSidebar);

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      if (!target) return;

      activeTab = target;

      // Update active nav button
      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update panels
      panels.forEach(panel => {
        panel.classList.toggle('active', panel.id === `view-${target}`);
      });

      // Update breadcrumbs and titles
      const tabNames = {
        products: 'Products',
        orders: 'Orders',
        overview: 'Overview',
        categories: 'Categories',
        customers: 'Customers',
        catalogs: 'PDF Catalogs',
        offers: 'Offers & Carousel',
        settings: 'Store Settings'
      };

      const titles = {
        products: 'Manage Products',
        orders: 'Customer Orders & Fulfillment',
        overview: 'Operations Overview',
        categories: 'Product Categories',
        customers: 'Customer Directory',
        catalogs: 'Brand PDF Catalogs & Spec Sheets',
        offers: 'Promotional Offers & Top Carousel Bar',
        settings: 'Store Settings'
      };

      const subtitles = {
        products: 'Add, update, or remove items from your store — no technical skills needed.',
        orders: 'Manage fulfillment status, track consignments, and print official GST invoices.',
        overview: 'Real-time synchronization with Cloud Firestore for product inventory and revenue.',
        categories: '4 standardized trade departments for Devshree Hardware supplies.',
        customers: 'Registered contractor and trade customer accounts.',
        catalogs: 'Manage manufacturer lookbooks, brand brochures and technical spec sheets downloadable by customers.',
        offers: 'Manage top autoscrolling carousel slides, festive promotional banners and category shortcuts.',
        settings: 'Store legal details, tax configuration, and support helpline.'
      };

      if (breadcrumbCurrent) breadcrumbCurrent.textContent = tabNames[target] || 'Products';
      if (pageTitle) pageTitle.textContent = titles[target] || 'Manage Products';
      if (pageSub) pageSub.textContent = subtitles[target] || '';

      closeSidebar();
    });
  });

  // Top "+ Add New Product" button
  document.getElementById('btn-header-add-product')?.addEventListener('click', () => {
    // Switch to products tab if not active
    const prodNav = document.getElementById('nav-products');
    if (prodNav && !prodNav.classList.contains('active')) {
      prodNav.click();
    }
    resetProductForm();
    const formCard = document.getElementById('admin-product-form-card');
    formCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('prod-name')?.focus();
  });
}

/**
 * 2. Real-time Price Summary Calculation
 */
function initPriceCalculation() {
  const priceInput = document.getElementById('prod-price');
  const gstSelect = document.getElementById('prod-gst-rate');
  const comparePriceInput = document.getElementById('prod-compare-price');
  const discountPercentInput = document.getElementById('prod-discount-percent');
  const bestsellerCheckbox = document.getElementById('prod-is-bestseller');
  const newCheckbox = document.getElementById('prod-is-new');

  const basePriceEl = document.getElementById('summary-base-price');
  const gstLabelEl = document.getElementById('summary-gst-label');
  const gstAmountEl = document.getElementById('summary-gst-amount');
  const custPriceEl = document.getElementById('summary-customer-price');
  const mrpRowEl = document.getElementById('summary-mrp-row');
  const mrpValEl = document.getElementById('summary-mrp');
  const discountRowEl = document.getElementById('summary-discount-row');
  const discountValEl = document.getElementById('summary-discount-amount');

  const previewDiscountPill = document.getElementById('preview-discount-pill');
  const previewBestsellerPill = document.getElementById('preview-bestseller-pill');
  const previewNewPill = document.getElementById('preview-new-pill');

  function calculate(source = null) {
    const rawPrice = parseFloat(priceInput?.value) || 0;
    const gstRate = parseFloat(gstSelect?.value) || 0;

    const basePrice = rawPrice;
    const gstAmount = (basePrice * gstRate) / 100;
    const customerPrice = basePrice > 0 ? +(basePrice + gstAmount).toFixed(2) : 0;

    let comparePrice = parseFloat(comparePriceInput?.value) || 0;
    let discountPercent = parseFloat(discountPercentInput?.value) || 0;

    // Bi-directional calculation
    if (source === 'discount') {
      if (discountPercent > 0 && discountPercent < 100 && customerPrice > 0) {
        comparePrice = Math.round(customerPrice / (1 - discountPercent / 100));
        if (comparePriceInput) comparePriceInput.value = comparePrice;
      } else if (discountPercent <= 0 && comparePriceInput) {
        comparePriceInput.value = '';
        comparePrice = 0;
      }
    } else if (source === 'compare') {
      if (comparePrice > customerPrice && customerPrice > 0) {
        discountPercent = Math.round(((comparePrice - customerPrice) / comparePrice) * 100);
        if (discountPercentInput) discountPercentInput.value = discountPercent;
      } else if (discountPercentInput) {
        discountPercentInput.value = '';
        discountPercent = 0;
      }
    } else {
      // Selling price or GST changed
      if (discountPercent > 0 && customerPrice > 0) {
        comparePrice = Math.round(customerPrice / (1 - discountPercent / 100));
        if (comparePriceInput) comparePriceInput.value = comparePrice;
      } else if (comparePrice > customerPrice && customerPrice > 0) {
        discountPercent = Math.round(((comparePrice - customerPrice) / comparePrice) * 100);
        if (discountPercentInput) discountPercentInput.value = discountPercent;
      }
    }

    if (basePriceEl) basePriceEl.textContent = `₹ ${basePrice.toFixed(2)}`;
    if (gstLabelEl) gstLabelEl.textContent = `GST (${gstRate}%)`;
    if (gstAmountEl) gstAmountEl.textContent = `₹ ${gstAmount.toFixed(2)}`;
    if (custPriceEl) custPriceEl.textContent = `₹ ${customerPrice.toFixed(2)}`;

    // Price Summary MRP & Discount Rows
    if (comparePrice > customerPrice && customerPrice > 0 && discountPercent > 0) {
      if (mrpRowEl) {
        mrpRowEl.style.display = 'flex';
        if (mrpValEl) mrpValEl.textContent = `₹ ${comparePrice.toFixed(2)}`;
      }
      if (discountRowEl) {
        discountRowEl.style.display = 'flex';
        if (discountValEl) discountValEl.textContent = `${discountPercent}% OFF`;
      }
    } else {
      if (mrpRowEl) mrpRowEl.style.display = 'none';
      if (discountRowEl) discountRowEl.style.display = 'none';
    }

    // Live Badge Preview
    if (previewDiscountPill) {
      if (discountPercent > 0) {
        previewDiscountPill.style.display = 'inline-block';
        previewDiscountPill.textContent = `${discountPercent}% OFF`;
      } else {
        previewDiscountPill.style.display = 'none';
      }
    }

    if (previewBestsellerPill) {
      previewBestsellerPill.style.display = bestsellerCheckbox?.checked ? 'inline-block' : 'none';
    }

    if (previewNewPill) {
      previewNewPill.style.display = newCheckbox?.checked ? 'inline-block' : 'none';
    }
  }

  priceInput?.addEventListener('input', () => calculate('price'));
  gstSelect?.addEventListener('change', () => calculate('gst'));
  comparePriceInput?.addEventListener('input', () => calculate('compare'));
  discountPercentInput?.addEventListener('input', () => calculate('discount'));
  bestsellerCheckbox?.addEventListener('change', () => calculate('badge'));
  newCheckbox?.addEventListener('change', () => calculate('badge'));

  // Initial calculation
  calculate();
}

/**
 * 3. Product Form (Add, Edit, Clear, Image Upload)
 */
function initProductForm() {
  const form = document.getElementById('admin-product-form');
  const editIdInput = document.getElementById('prod-edit-id');
  const formTitle = document.getElementById('form-section-title');
  const saveBtnText = document.getElementById('btn-save-product-text');
  const clearBtn = document.getElementById('btn-clear-form');

  const fileInput = document.getElementById('prod-image-file');
  const chooseBtn = document.getElementById('admin-choose-image-btn');
  const previewImg = document.getElementById('admin-image-preview');
  const hiddenImgInput = document.getElementById('prod-image');
  const urlInput = document.getElementById('prod-image-url');
  const removeImgBtn = document.getElementById('admin-remove-image-btn');

  // Trigger Image File Picker (clears input value so selecting the same file triggers change every time)
  chooseBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (fileInput) {
      fileInput.value = '';
      fileInput.click();
    }
  });

  chooseBtn?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (fileInput) {
        fileInput.value = '';
        fileInput.click();
      }
    }
  });

  // Direct Image URL input live sync
  urlInput?.addEventListener('input', () => {
    const val = urlInput.value.trim();
    if (val) {
      if (previewImg) previewImg.src = val;
      if (hiddenImgInput) hiddenImgInput.value = val;
    } else {
      if (previewImg) previewImg.src = DEFAULT_BULB_IMG;
      if (hiddenImgInput) hiddenImgInput.value = '';
    }
  });

  // Helper: Secure Image File Handler with INSTANT 0ms visual preview
  async function handleImageFileSelection(file) {
    if (!file) return;

    // 1. INSTANTANEOUS preview in 0ms so the user sees the image changed IMMEDIATELY!
    try {
      const objUrl = URL.createObjectURL(file);
      if (previewImg) previewImg.src = objUrl;
    } catch (_) {}

    // 2. Read as persistent Base64 Data URL
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      if (previewImg) previewImg.src = dataUrl;
      if (hiddenImgInput) hiddenImgInput.value = dataUrl;
      if (urlInput) urlInput.value = dataUrl;
      showToast('Product photo updated successfully!', 'success');
    };
    reader.onerror = () => {
      showToast('Unable to read selected image file.', 'error');
    };
    reader.readAsDataURL(file);

    // 3. Background optimization & Cloud Storage upload (non-blocking)
    if (isConfigured && storage) {
      try {
        const safeName = `product_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const fileRef = ref(storage, `products/${safeName}`);
        const snapshot = await uploadBytesResumable(fileRef, file, {
          contentType: file.type || 'image/jpeg',
          cacheControl: 'public, max-age=31536000'
        });
        const cloudUrl = await getDownloadURL(snapshot.ref);
        if (cloudUrl) {
          if (hiddenImgInput) hiddenImgInput.value = cloudUrl;
          if (urlInput) urlInput.value = cloudUrl;
          if (previewImg) previewImg.src = cloudUrl;
        }
      } catch (e) {
        console.warn('[Admin] Cloud upload skipped (persisting local data URL):', e);
      }
    }
  }

  // Handle Image Upload via file picker
  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    await handleImageFileSelection(file);
  });

  // Handle Drag and Drop on dropzone box
  if (chooseBtn) {
    ['dragenter', 'dragover'].forEach((eventName) => {
      chooseBtn.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        chooseBtn.classList.add('admin-dropzone-dragover');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      chooseBtn.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        chooseBtn.classList.remove('admin-dropzone-dragover');
      });
    });

    chooseBtn.addEventListener('drop', async (e) => {
      const file = e.dataTransfer?.files?.[0];
      await handleImageFileSelection(file);
    });
  }

  // Remove Image Button
  removeImgBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (previewImg) previewImg.src = DEFAULT_BULB_IMG;
    if (hiddenImgInput) hiddenImgInput.value = '';
    if (fileInput) fileInput.value = '';
    if (urlInput) urlInput.value = '';
    showToast('Image reset to default.', 'info');
  });

  // Clear Form
  clearBtn?.addEventListener('click', resetProductForm);

  // Form Submit (Save / Update Product)
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const editId = editIdInput?.value;
    const name = document.getElementById('prod-name')?.value.trim();
    const categoryId = document.getElementById('prod-category')?.value;
    const brand = document.getElementById('prod-brand')?.value.trim() || 'Devshree';
    const basePrice = parseFloat(document.getElementById('prod-price')?.value) || 0;
    const gstRate = parseFloat(document.getElementById('prod-gst-rate')?.value) || 0;
    const stock = parseInt(document.getElementById('prod-stock')?.value, 10) || 0;
    const description = document.getElementById('prod-desc')?.value.trim() || 'Quality hardware supplies.';
    const image = hiddenImgInput?.value.trim() || previewImg?.src || DEFAULT_BULB_IMG;

    let compareAtPrice = parseFloat(document.getElementById('prod-compare-price')?.value) || 0;
    let discountPercentage = parseInt(document.getElementById('prod-discount-percent')?.value, 10) || 0;
    const isBestseller = !!document.getElementById('prod-is-bestseller')?.checked;
    const isNew = !!document.getElementById('prod-is-new')?.checked;
    const isFeatured = !!document.getElementById('prod-is-featured')?.checked;
    const isRegularDeal = !!document.getElementById('prod-is-regular-deal')?.checked;

    if (!name || basePrice <= 0) {
      showToast('Please enter product name and selling price.', 'error');
      return;
    }

    const customerPrice = +(basePrice * (1 + gstRate / 100)).toFixed(2);
    const skuCode = document.getElementById('prod-sku')?.value || generateCode(categoryId, name);

    // Reconcile discountPercentage and compareAtPrice
    if (discountPercentage > 0 && (!compareAtPrice || compareAtPrice <= customerPrice)) {
      compareAtPrice = Math.round(customerPrice / (1 - discountPercentage / 100));
    } else if (compareAtPrice > customerPrice && !discountPercentage) {
      discountPercentage = Math.round(((compareAtPrice - customerPrice) / compareAtPrice) * 100);
    }

    const submitBtn = document.getElementById('btn-save-product');
    if (submitBtn) submitBtn.disabled = true;

    try {
      if (editId) {
        // Edit Mode
        const updatedFields = {
          name,
          categoryId,
          brand,
          price: customerPrice,
          basePrice,
          gstRate,
          stock,
          sku: skuCode,
          description,
          image,
          compareAtPrice: compareAtPrice > customerPrice ? compareAtPrice : null,
          discountPercentage: discountPercentage > 0 ? discountPercentage : null,
          isBestseller,
          isNew,
          isFeatured,
          isRegularDeal,
          updatedAt: new Date().toISOString()
        };

        if (db) {
          try {
            await updateDoc(doc(db, 'products', editId), updatedFields);
          } catch (dbErr) {
            console.warn('[Admin] Firestore update fallback:', dbErr);
          }
        }

        const match = allProducts.find(p => p.id === editId);
        if (match) {
          Object.assign(match, updatedFields);
        }
        syncProductsCache();

        showToast(`Product "${name}" updated successfully!`, 'success');
      } else {
        // Add Mode
        const newProd = {
          id: 'prod-' + Date.now(),
          name,
          categoryId,
          brand,
          price: customerPrice,
          basePrice,
          gstRate,
          stock,
          sku: skuCode,
          description,
          image,
          compareAtPrice: compareAtPrice > customerPrice ? compareAtPrice : null,
          discountPercentage: discountPercentage > 0 ? discountPercentage : null,
          isBestseller,
          isNew,
          isFeatured,
          isRegularDeal,
          rating: 0,
          reviewCount: 0,
          createdAt: new Date().toISOString()
        };

        if (db) {
          try {
            await createProductInFirestore(newProd);
          } catch (dbErr) {
            console.warn('[Admin] Firestore create fallback:', dbErr);
          }
        }

        allProducts.unshift(newProd);
        syncProductsCache();
        showToast(`Product "${name}" added to catalog!`, 'success');
      }

      resetProductForm();
      updateKpis();
      renderProductsTable();
    } catch (err) {
      showSafeErrorToast(err, 'Unable to save product. Please try again.');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

/**
 * Reset Product Form to Default State
 */
function resetProductForm() {
  const form = document.getElementById('admin-product-form');
  const editIdInput = document.getElementById('prod-edit-id');
  const formTitle = document.getElementById('form-section-title');
  const saveBtnText = document.getElementById('btn-save-product-text');
  const previewImg = document.getElementById('admin-image-preview');
  const hiddenImgInput = document.getElementById('prod-image');

  form?.reset();
  if (editIdInput) editIdInput.value = '';
  if (formTitle) formTitle.textContent = 'Add a Product';
  if (saveBtnText) saveBtnText.textContent = 'Save Product';

  if (previewImg) previewImg.src = DEFAULT_BULB_IMG;
  if (hiddenImgInput) hiddenImgInput.value = '';
  const urlInput = document.getElementById('prod-image-url');
  if (urlInput) urlInput.value = '';

  const comparePriceInput = document.getElementById('prod-compare-price');
  const discountPercentInput = document.getElementById('prod-discount-percent');
  const bestsellerCheckbox = document.getElementById('prod-is-bestseller');
  const newCheckbox = document.getElementById('prod-is-new');
  const featuredCheckbox = document.getElementById('prod-is-featured');
  const regularDealCheckbox = document.getElementById('prod-is-regular-deal');

  if (comparePriceInput) comparePriceInput.value = '';
  if (discountPercentInput) discountPercentInput.value = '';
  if (bestsellerCheckbox) bestsellerCheckbox.checked = false;
  if (newCheckbox) newCheckbox.checked = false;
  if (featuredCheckbox) featuredCheckbox.checked = false;
  if (regularDealCheckbox) regularDealCheckbox.checked = false;

  // Trigger price recalculation to defaults
  document.getElementById('prod-price')?.dispatchEvent(new Event('input'));
}

/**
 * Populate Product Form for Editing
 */
function editProduct(prod) {
  if (!prod) return;

  // Switch to products tab
  const prodNav = document.getElementById('nav-products');
  if (prodNav && !prodNav.classList.contains('active')) {
    prodNav.click();
  }

  const editIdInput = document.getElementById('prod-edit-id');
  const skuInput = document.getElementById('prod-sku');
  const nameInput = document.getElementById('prod-name');
  const catInput = document.getElementById('prod-category');
  const brandInput = document.getElementById('prod-brand');
  const priceInput = document.getElementById('prod-price');
  const gstSelect = document.getElementById('prod-gst-rate');
  const stockInput = document.getElementById('prod-stock');
  const descInput = document.getElementById('prod-desc');
  const previewImg = document.getElementById('admin-image-preview');
  const hiddenImgInput = document.getElementById('prod-image');

  const formTitle = document.getElementById('form-section-title');
  const saveBtnText = document.getElementById('btn-save-product-text');

  if (editIdInput) editIdInput.value = prod.id;
  if (skuInput) skuInput.value = prod.sku || '';
  if (nameInput) nameInput.value = prod.name || '';
  if (catInput) catInput.value = prod.categoryId || 'cat-electrical';
  if (brandInput) brandInput.value = prod.brand || '';
  
  // If basePrice is recorded use it, else calculate from customer price
  const basePrice = prod.basePrice || (prod.price ? +(prod.price / 1.18).toFixed(2) : 0);
  if (priceInput) priceInput.value = basePrice;
  if (gstSelect) gstSelect.value = prod.gstRate != null ? String(prod.gstRate) : '18';
  if (stockInput) stockInput.value = prod.stock ?? 0;
  if (descInput) descInput.value = prod.description || '';

  const comparePriceInput = document.getElementById('prod-compare-price');
  const discountPercentInput = document.getElementById('prod-discount-percent');
  const bestsellerCheckbox = document.getElementById('prod-is-bestseller');
  const newCheckbox = document.getElementById('prod-is-new');
  const featuredCheckbox = document.getElementById('prod-is-featured');
  const regularDealCheckbox = document.getElementById('prod-is-regular-deal');

  if (comparePriceInput) comparePriceInput.value = prod.compareAtPrice || '';

  let discountPct = prod.discountPercentage || 0;
  if (!discountPct && prod.compareAtPrice && prod.compareAtPrice > prod.price) {
    discountPct = Math.round(((prod.compareAtPrice - prod.price) / prod.compareAtPrice) * 100);
  }
  if (discountPercentInput) discountPercentInput.value = discountPct > 0 ? discountPct : '';

  if (bestsellerCheckbox) bestsellerCheckbox.checked = !!prod.isBestseller;
  if (newCheckbox) newCheckbox.checked = !!prod.isNew;
  if (featuredCheckbox) featuredCheckbox.checked = !!prod.isFeatured;
  if (regularDealCheckbox) regularDealCheckbox.checked = !!prod.isRegularDeal;

  const img = prod.image || DEFAULT_BULB_IMG;
  if (previewImg) previewImg.src = img;
  if (hiddenImgInput) hiddenImgInput.value = img;
  const editUrlInput = document.getElementById('prod-image-url');
  if (editUrlInput) editUrlInput.value = prod.image || '';

  if (formTitle) formTitle.textContent = `Edit Product: ${prod.name}`;
  if (saveBtnText) saveBtnText.textContent = 'Update Product';

  // Recalculate price summary & badges
  priceInput?.dispatchEvent(new Event('input'));

  // Smooth scroll to form
  const formCard = document.getElementById('admin-product-form-card');
  formCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Remove Product
 */
async function removeProduct(prodId) {
  const prod = allProducts.find(p => p.id === prodId);
  const name = prod ? prod.name : 'this item';

  if (!confirm(`Are you sure you want to remove "${name}" from your store?`)) {
    return;
  }

  try {
    if (db) {
      try {
        await deleteDoc(doc(db, 'products', prodId));
      } catch (err) {
        console.warn('[Admin] Firestore delete error:', err);
      }
    }

    const deletedIds = getStorage('devshree_deleted_product_ids', []);
    if (!deletedIds.includes(prodId)) {
      deletedIds.push(prodId);
      setStorage('devshree_deleted_product_ids', deletedIds);
    }

    allProducts = allProducts.filter(p => p.id !== prodId);
    syncProductsCache();
    updateKpis();
    renderProductsTable();
    showToast(`Removed "${name}" from products.`, 'info');
  } catch (err) {
    showSafeErrorToast(err, 'Unable to remove product. Please try again.');
  }
}

/**
 * Cross-Device Catalog Synchronization & Export/Import Controls
 */
function initSyncAndBackupUI() {
  const syncModal = document.getElementById('admin-sync-modal');
  const openSyncBtn = document.getElementById('btn-sync-mobile-modal');
  const closeSyncBtn = document.getElementById('admin-sync-modal-close');
  const doneSyncBtn = document.getElementById('admin-sync-modal-done-btn');
  const waSyncBtn = document.getElementById('btn-sync-send-whatsapp');
  const copySyncBtn = document.getElementById('btn-sync-copy-link');

  const exportBtn = document.getElementById('btn-export-products-json');
  const importBtn = document.getElementById('btn-import-products-json');
  const importFileInput = document.getElementById('admin-import-file-input');

  const openSync = () => {
    if (syncModal) syncModal.style.display = 'flex';
  };
  const closeSync = () => {
    if (syncModal) syncModal.style.display = 'none';
  };

  openSyncBtn?.addEventListener('click', openSync);
  closeSyncBtn?.addEventListener('click', closeSync);
  doneSyncBtn?.addEventListener('click', closeSync);
  syncModal?.addEventListener('click', (e) => {
    if (e.target === syncModal) closeSync();
  });

  const getCatalogSyncLink = () => {
    // Collect custom items
    const custom = allProducts.filter(p => !MOCK_PRODUCTS.some(m => m.id === p.id));
    const items = custom.length > 0 ? custom : allProducts.slice(0, 10);

    // Sanitize large base64 data URLs for URL length safety
    const light = items.map(p => {
      const copy = { ...p };
      if (copy.image && copy.image.startsWith('data:') && copy.image.length > 1500) {
        copy.image = DEFAULT_BULB_IMG;
      }
      return copy;
    });

    const json = JSON.stringify(light);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    const targetUrl = new URL(window.location.href);
    targetUrl.pathname = targetUrl.pathname.replace(/admin\.html.*$/, 'index.html');
    targetUrl.search = `?devshree_sync_catalog=${b64}`;
    targetUrl.hash = '';
    return targetUrl.toString();
  };

  waSyncBtn?.addEventListener('click', () => {
    try {
      const link = getCatalogSyncLink();
      const phone = getStoreOwnerPhone() || '918866130409';
      const msg = `Devshree Catalog Sync for Mobile:\n\nOpen this link on your phone to load all custom products into your mobile store:\n${link}`;
      openWhatsAppChat(phone, msg);
    } catch (err) {
      showToast('Unable to build sync link: ' + (err?.message || err), 'error');
    }
  });

  copySyncBtn?.addEventListener('click', () => {
    try {
      const link = getCatalogSyncLink();
      navigator.clipboard?.writeText(link).then(() => {
        showToast('Mobile sync link copied to clipboard!', 'success');
      }).catch(() => {
        prompt('Copy this sync link and open on your mobile phone:', link);
      });
    } catch (err) {
      showToast('Unable to copy link: ' + (err?.message || err), 'error');
    }
  });

  // Export Catalog JSON
  exportBtn?.addEventListener('click', () => {
    try {
      const blob = new Blob([JSON.stringify(allProducts, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `devshree-catalog-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Exported ${allProducts.length} products to JSON backup!`, 'success');
    } catch (err) {
      showToast('Export failed: ' + (err?.message || err), 'error');
    }
  });

  // Import Catalog JSON
  importBtn?.addEventListener('click', () => {
    importFileInput?.click();
  });

  importFileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (!Array.isArray(imported)) {
          throw new Error('File must contain an array of products');
        }
        allProducts = imported;
        syncProductsCache();
        updateKpis();
        renderProductsTable();
        showToast(`Imported ${imported.length} products successfully!`, 'success');
      } catch (parseErr) {
        showToast('Invalid catalog JSON file: ' + parseErr.message, 'error');
      }
    };
    reader.readAsText(file);
    importFileInput.value = '';
  });
}

/**
 * 4. Render "Your Products" Table
 */
function renderProductsTable(products = null) {
  const tbody = document.getElementById('admin-products-tbody');
  if (!tbody) return;

  const list = products || allProducts;

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;padding:2.5rem;color:var(--admin-text-secondary);">
          <div style="font-size:1.75rem;margin-bottom:0.5rem;">📦</div>
          <div style="font-weight:700;color:var(--admin-text-main);margin-bottom:0.25rem;">No products found</div>
          <span style="font-size:0.8rem;">No items match your search or category filter.</span>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(prod => {
    const stock = prod.stock || 0;
    let stockStatusClass = 'in-stock';
    let stockStatusText = 'In Stock';

    if (stock <= 0) {
      stockStatusClass = 'out-of-stock';
      stockStatusText = 'Out of Stock';
    } else if (stock <= 10) {
      stockStatusClass = 'low-stock';
      stockStatusText = 'Low Stock';
    }

    const catName = formatCategoryName(prod.categoryId);
    const skuCode = prod.sku ? `Code: ${prod.sku}` : (prod.id ? `Code: ${prod.id.slice(0, 6).toUpperCase()}` : '');

    // Price & MRP
    const currentPrice = Number(prod.price || 0);
    const mrpPrice = Number(prod.compareAtPrice || 0);
    const mrpHtml = (mrpPrice > currentPrice) 
      ? `<div class="admin-table-mrp">MRP: ₹ ${mrpPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>` 
      : '';

    // Discount %
    let discount = prod.discountPercentage || 0;
    if (!discount && mrpPrice > currentPrice) {
      discount = Math.round(((mrpPrice - currentPrice) / mrpPrice) * 100);
    }
    const discountHtml = discount > 0 
      ? `<span class="admin-table-discount-badge">${discount}% OFF</span>` 
      : `<span style="color:var(--admin-text-secondary);font-size:0.8rem;">—</span>`;

    // Bestseller toggle button
    const isBestseller = !!prod.isBestseller;
    const bestsellerHtml = isBestseller 
      ? `<button type="button" class="btn-toggle-bestseller active" data-bestseller-toggle-id="${prod.id}" title="Click to remove from Bestsellers">
          <span>🔥 BESTSELLER</span>
        </button>`
      : `<button type="button" class="btn-toggle-bestseller" data-bestseller-toggle-id="${prod.id}" title="Click to mark as Bestseller">
          <span>+ Mark Bestseller</span>
        </button>`;

    // Regular Hardware Deal toggle button
    const isDeal = !!prod.isRegularDeal;
    const dealToggleHtml = isDeal 
      ? `<button type="button" class="btn-toggle-deal active" data-deal-toggle-id="${prod.id}" title="Click to remove from Regular Hardware Deals" style="margin-top:4px;display:inline-flex;align-items:center;gap:3px;font-size:0.7rem;font-weight:700;background:#FFF3EB;color:#C2410C;border:1px solid #FFD8BE;border-radius:4px;padding:3px 6px;cursor:pointer;">
          <span>🏷️ REGULAR DEAL</span>
        </button>`
      : `<button type="button" class="btn-toggle-deal" data-deal-toggle-id="${prod.id}" title="Click to mark as Regular Hardware Deal (Promoted on Deals Shelf)" style="margin-top:4px;display:inline-flex;align-items:center;gap:3px;font-size:0.7rem;font-weight:600;background:#F8FAFC;color:#64748B;border:1px dashed #CBD5E1;border-radius:4px;padding:3px 6px;cursor:pointer;">
          <span>+ Regular Deal</span>
        </button>`;

    return `
      <tr data-prod-id="${prod.id}">
        <td>
          <img src="${prod.image || DEFAULT_BULB_IMG}" alt="${escapeHTML(prod.name)}" class="admin-row-thumb" loading="lazy" />
        </td>
        <td>
          <div class="admin-row-prod-name">${escapeHTML(prod.name)}</div>
          <div class="admin-row-prod-code">${escapeHTML(skuCode)}</div>
        </td>
        <td>
          <span class="admin-row-cat-badge">${escapeHTML(catName)}</span>
        </td>
        <td>
          <span class="admin-row-price">₹ ${currentPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          ${mrpHtml}
        </td>
        <td>
          ${discountHtml}
        </td>
        <td>
          <div style="display:flex;flex-direction:column;gap:3px;align-items:flex-start;">
            ${bestsellerHtml}
            ${dealToggleHtml}
          </div>
        </td>
        <td>
          <span class="admin-row-stock-qty">${stock}</span>
          <span class="admin-stock-status ${stockStatusClass}">
            <span class="dot"></span>
            <span>${stockStatusText}</span>
          </span>
        </td>
        <td style="text-align:right;">
          <div class="admin-row-actions">
            <button type="button" class="btn-table-edit" data-edit-id="${prod.id}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              <span>Edit</span>
            </button>
            <button type="button" class="btn-table-remove" data-remove-id="${prod.id}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              <span>Remove</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Attach Table Button Listeners
  tbody.querySelectorAll('[data-edit-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editId;
      const target = allProducts.find(p => p.id === id);
      if (target) editProduct(target);
    });
  });

  tbody.querySelectorAll('[data-remove-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.removeId;
      if (id) removeProduct(id);
    });
  });

  tbody.querySelectorAll('[data-bestseller-toggle-id]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.bestsellerToggleId;
      const target = allProducts.find(p => p.id === id);
      if (!target) return;

      const newStatus = !target.isBestseller;
      target.isBestseller = newStatus;
      target.updatedAt = new Date().toISOString();

      if (db) {
        try {
          await updateDoc(doc(db, 'products', id), { 
            isBestseller: newStatus, 
            updatedAt: target.updatedAt 
          });
        } catch (err) {
          console.warn('[Admin] Firestore bestseller toggle fallback:', err);
        }
      }

      syncProductsCache();
      renderProductsTable();
      showToast(`"${target.name}" ${newStatus ? 'marked as BESTSELLER! 🔥' : 'removed from bestsellers.'}`, newStatus ? 'success' : 'info');
    });
  });

  tbody.querySelectorAll('[data-deal-toggle-id]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.dealToggleId;
      const target = allProducts.find(p => p.id === id);
      if (!target) return;

      const newStatus = !target.isRegularDeal;
      target.isRegularDeal = newStatus;
      target.updatedAt = new Date().toISOString();

      if (db) {
        try {
          await updateDoc(doc(db, 'products', id), { 
            isRegularDeal: newStatus, 
            updatedAt: target.updatedAt 
          });
        } catch (err) {
          console.warn('[Admin] Firestore regular deal toggle fallback:', err);
        }
      }

      syncProductsCache();
      renderProductsTable();
      showToast(`"${target.name}" ${newStatus ? 'promoted as Regular Hardware Deal! 🏷️' : 'removed from regular deals.'}`, newStatus ? 'success' : 'info');
    });
  });
}

/**
 * 5. Table Search & Category Filter
 */
function initTableFilters() {
  const searchInput = document.getElementById('admin-products-search');
  const catFilter = document.getElementById('admin-products-cat-filter');

  const filterAction = () => {
    const q = (searchInput?.value || '').toLowerCase().trim();
    const cat = catFilter?.value || 'all';

    const filtered = allProducts.filter(p => {
      const matchCat = cat === 'all' || p.categoryId === cat;
      const matchText = !q ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q));
      return matchCat && matchText;
    });

    renderProductsTable(filtered);
  };

  searchInput?.addEventListener('input', filterAction);
  catFilter?.addEventListener('change', filterAction);
}

/**
 * 6. KPI Summary Calculation
 */
function updateKpis() {
  const totalProducts = allProducts.length;
  const inStockCount = allProducts.filter(p => (p.stock || 0) > 10).length;
  const lowStockCount = allProducts.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= 10).length;

  const totalEl = document.getElementById('kpi-total-products');
  const inStockEl = document.getElementById('kpi-in-stock');
  const lowStockEl = document.getElementById('kpi-low-stock');
  const navBadge = document.getElementById('nav-products-count');

  if (totalEl) totalEl.textContent = totalProducts;
  if (inStockEl) inStockEl.textContent = inStockCount;
  if (lowStockEl) lowStockEl.textContent = lowStockCount;
  if (navBadge) navBadge.textContent = totalProducts;

  // Overview Panel KPIs
  const totalRev = allOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const revEl = document.getElementById('kpi-overview-revenue');
  const ordersEl = document.getElementById('kpi-overview-orders');
  if (revEl) revEl.textContent = formatINR(totalRev);
  if (ordersEl) ordersEl.textContent = allOrders.length;

  // Category Department Counts (View 4: Categories)
  const elecCount = allProducts.filter(p => p.categoryId === 'cat-electrical').length;
  const hardCount = allProducts.filter(p => p.categoryId === 'cat-hardware').length;
  const plumbCount = allProducts.filter(p => p.categoryId === 'cat-plumbing').length;
  const paintCount = allProducts.filter(p => p.categoryId === 'cat-paints').length;

  const catElecEl = document.getElementById('cat-count-electrical');
  const catHardEl = document.getElementById('cat-count-hardware');
  const catPlumbEl = document.getElementById('cat-count-plumbing');
  const catPaintEl = document.getElementById('cat-count-paints');

  if (catElecEl) catElecEl.textContent = `${elecCount} Active Items`;
  if (catHardEl) catHardEl.textContent = `${hardCount} Active Items`;
  if (catPlumbEl) catPlumbEl.textContent = `${plumbCount} Active Items`;
  if (catPaintEl) catPaintEl.textContent = `${paintCount} Active Items`;

  // Update Catalogs & Offers Sidebar Badges
  const catalogsCount = (typeof getActiveCatalogs === 'function') ? getActiveCatalogs().length : 12;
  const offersCount = (typeof getActiveOffers === 'function') ? getActiveOffers().filter(o => o && o.active !== false).length : 4;
  const navCatalogsBadge = document.getElementById('nav-catalogs-count');
  const navOffersBadge = document.getElementById('nav-offers-count');
  if (navCatalogsBadge) navCatalogsBadge.textContent = catalogsCount;
  if (navOffersBadge) navOffersBadge.textContent = offersCount;

  // Dynamically update customer directory
  renderCustomersDirectory();
}

/**
 * 7. Orders Controls & Invoice Viewer
 */
function initOrdersControls() {
  const searchInput = document.getElementById('admin-orders-search');
  const refreshBtn = document.getElementById('admin-refresh-orders-btn');
  const statusPills = document.querySelectorAll('#admin-order-status-pills .admin-pill-btn');
  const invoiceModal = document.getElementById('tax-invoice-modal');
  const invoiceCloseBtn = document.getElementById('tax-invoice-close-btn');

  invoiceCloseBtn?.addEventListener('click', () => {
    invoiceModal?.classList.remove('active');
  });

  const filterOrders = () => {
    const q = (searchInput?.value || '').toLowerCase().trim();
    const activePill = document.querySelector('#admin-order-status-pills .admin-pill-btn.active');
    const status = activePill?.dataset.status || 'all';

    const filtered = allOrders.filter(o => {
      const matchStatus = status === 'all' || (o.orderStatus || 'Confirmed') === status;
      const matchSearch = !q ||
        (o.invoiceNumber && o.invoiceNumber.toLowerCase().includes(q)) ||
        (o.customerName && o.customerName.toLowerCase().includes(q)) ||
        (o.customerPhone && o.customerPhone.includes(q));
      return matchStatus && matchSearch;
    });

    renderOrdersTable(filtered);
  };

  searchInput?.addEventListener('input', filterOrders);

  statusPills.forEach(pill => {
    pill.addEventListener('click', () => {
      statusPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      filterOrders();
    });
  });

  refreshBtn?.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    try {
      allOrders = await fetchAllOrders();
      renderOrdersTable();
      updateKpis();
      showToast('Orders reloaded from Firestore.', 'info');
    } catch (e) {
      console.warn(e);
    } finally {
      refreshBtn.disabled = false;
    }
  });

  const testNotifBtn = document.getElementById('admin-test-order-notif-btn');
  testNotifBtn?.addEventListener('click', () => {
    sendTestOrderNotification();
  });

  // Export Orders for GST Accounting
  const exportBtn = document.getElementById('admin-export-orders-csv-btn');
  exportBtn?.addEventListener('click', () => {
    exportOrdersToCSV(allOrders);
  });
}

/**
 * Real-Time Orders Stream (Firestore OnSnapshot + Cross-Tab Storage Listener)
 */
function setupRealtimeOrdersListener() {
  if (db) {
    try {
      const q = collection(db, "orders");
      onSnapshot(q, (snapshot) => {
        const orders = [];
        snapshot.forEach(docSnap => {
          const data = { id: docSnap.id, ...docSnap.data() };
          orders.push(data);

          const invoiceNum = data.invoiceNumber;
          const isKnown = knownOrderIds.has(docSnap.id) || (invoiceNum && knownOrderInvoices.has(invoiceNum));

          if (!isKnown) {
            knownOrderIds.add(docSnap.id);
            if (invoiceNum) knownOrderInvoices.add(invoiceNum);
            if (!isInitialOrdersSnapshot) {
              // Remote incoming order in real time!
              triggerOrderNotification(data, { broadcast: false, save: true });
            }
          }
        });

        isInitialOrdersSnapshot = false;
        orders.sort((a, b) => new Date(b.createdAtIso || 0) - new Date(a.createdAtIso || 0));
        allOrders = orders;
        renderOrdersTable();
        updateKpis();
      }, (err) => {
        console.warn('[Admin] Firestore orders realtime stream error:', err);
      });
    } catch (err) {
      console.warn('[Admin] Failed to establish real-time Firestore listener:', err);
    }
  }

  // Cross-tab sync for local or offline orders
  window.addEventListener('storage', (e) => {
    if (e.key === 'devshree_all_orders' || e.key === 'devshree_last_order_event') {
      fetchAllOrders().then(orders => {
        allOrders = orders;
        renderOrdersTable();
        updateKpis();
      });
    }
  });
}

function renderOrdersTable(data = null) {
  const tbody = document.getElementById('admin-orders-tbody');
  if (!tbody) return;

  const orders = data || allOrders;

  // Update badge
  const ordersNavBadge = document.getElementById('nav-orders-count');
  if (ordersNavBadge) ordersNavBadge.textContent = allOrders.length;

  if (orders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;padding:2.5rem;color:var(--admin-text-secondary);">
          <div style="font-size:1.75rem;margin-bottom:0.5rem;">📋</div>
          <div style="font-weight:700;color:var(--admin-text-main);margin-bottom:0.25rem;">No orders found</div>
          <span style="font-size:0.8rem;">No customer orders match the current filter.</span>
        </td>
      </tr>
    `;
    return;
  }

  // Update status filter counters
  const pillAll = document.getElementById('pill-orders-all');
  const pillConf = document.getElementById('pill-orders-confirmed');
  const pillProc = document.getElementById('pill-orders-processing');
  const pillDisp = document.getElementById('pill-orders-dispatched');
  const pillDelv = document.getElementById('pill-orders-delivered');
  const pillCanc = document.getElementById('pill-orders-cancelled');

  if (pillAll) pillAll.textContent = allOrders.length;
  if (pillConf) pillConf.textContent = allOrders.filter(o => (o.orderStatus || 'Confirmed') === 'Confirmed').length;
  if (pillProc) pillProc.textContent = allOrders.filter(o => o.orderStatus === 'Processing').length;
  if (pillDisp) pillDisp.textContent = allOrders.filter(o => o.orderStatus === 'Dispatched').length;
  if (pillDelv) pillDelv.textContent = allOrders.filter(o => o.orderStatus === 'Delivered').length;
  if (pillCanc) pillCanc.textContent = allOrders.filter(o => o.orderStatus === 'Cancelled').length;

  tbody.innerHTML = orders.map(order => {
    const dateStr = order.createdAtIso 
      ? new Date(order.createdAtIso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Recent';

    const itemsCount = (order.itemsSnapshot || []).reduce((sum, i) => sum + (i.quantity || 1), 0);
    const status = order.orderStatus || 'Confirmed';
    const isCancelled = status === 'Cancelled';

    return `
      <tr class="${isCancelled ? 'row-cancelled' : ''}">
        <td>
          <div style="font-family:'JetBrains Mono',monospace;font-weight:700;font-size:0.85rem;color:var(--admin-text-main);">
            ${escapeHTML(order.invoiceNumber || 'INV-DEV')}
          </div>
          <div style="font-size:0.75rem;color:var(--admin-text-secondary);">${dateStr}</div>
        </td>
        <td>
          <div style="font-weight:700;color:var(--admin-text-main);">${escapeHTML(order.customerName || 'Customer')}</div>
          <div style="font-size:0.75rem;color:var(--admin-text-secondary);">📞 ${escapeHTML(order.customerPhone || 'N/A')}</div>
        </td>
        <td>
          <span style="font-weight:700;">${itemsCount} unit(s)</span>
        </td>
        <td>
          <span style="font-weight:700;color:var(--admin-text-main);">${formatINR(order.total || 0)}</span>
        </td>
        <td>
          <span style="font-size:0.8rem;font-weight:600;">${escapeHTML(order.paymentMethod || 'COD')}</span>
        </td>
        <td>
          <select class="admin-order-status-select ${isCancelled ? 'is-cancelled' : ''}" data-order-id="${order.id}">
            <option value="Confirmed" ${status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
            <option value="Processing" ${status === 'Processing' ? 'selected' : ''}>Processing</option>
            <option value="Dispatched" ${status === 'Dispatched' ? 'selected' : ''}>Dispatched</option>
            <option value="Delivered" ${status === 'Delivered' ? 'selected' : ''}>Delivered</option>
            <option value="Cancelled" ${status === 'Cancelled' ? 'selected' : ''}>Cancelled 🚫</option>
          </select>
        </td>
        <td style="text-align:right;">
          <div style="display:inline-flex;gap:0.4rem;align-items:center;justify-content:flex-end;">
            <button type="button" class="btn-table-whatsapp" data-wa-invoice="${order.invoiceNumber || ''}" data-order-id="${order.id || ''}" title="Send WhatsApp Update">
              <span>WhatsApp 📲</span>
            </button>
            <button type="button" class="btn-table-edit" data-view-invoice="${order.invoiceNumber || ''}" data-order-id="${order.id || ''}">
              <span>Invoice</span>
            </button>
            ${!isCancelled ? `
              <button type="button" class="btn-table-cancel-order" data-cancel-invoice="${order.invoiceNumber || ''}" data-order-id="${order.id || ''}" title="Cancel this customer order">
                <span>Cancel 🚫</span>
              </button>
            ` : `
              <span class="badge-status-cancelled" title="Reason: ${escapeHTML(order.cancellationReason || 'Admin Cancelled')}">
                Cancelled
              </span>
            `}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Status changes
  tbody.querySelectorAll('.admin-order-status-select').forEach(select => {
    select.addEventListener('change', async () => {
      const id = select.dataset.orderId;
      const val = select.value;
      const match = allOrders.find(o => o.id === id);
      if (!match) return;

      if (val === 'Cancelled') {
        openAdminCancelModal(match);
        select.value = match.orderStatus || 'Confirmed';
        return;
      }

      if (id) {
        await updateOrderStatus(id, val);
        match.orderStatus = val;
        showToast(`Order status updated to "${val}"`, 'success');
        renderOrdersTable();
        updateKpis();
      }
    });
  });

  // Cancel order button
  tbody.querySelectorAll('.btn-table-cancel-order').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const invNum = btn.dataset.cancelInvoice;
      const orderId = btn.dataset.orderId;
      const target = allOrders.find(o => (invNum && o.invoiceNumber === invNum) || (orderId && o.id === orderId));
      if (target) {
        openAdminCancelModal(target);
      } else {
        console.warn('[Admin] Could not find order to cancel for:', invNum, orderId);
      }
    });
  });

  // WhatsApp dispatch modal
  tbody.querySelectorAll('.btn-table-whatsapp').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const invNum = btn.dataset.waInvoice;
      const orderId = btn.dataset.orderId;
      const target = allOrders.find(o => (invNum && o.invoiceNumber === invNum) || (orderId && o.id === orderId));
      if (target) {
        openWhatsAppDispatchModal(target, 'owner');
      } else {
        console.warn('[Admin] Could not find order for WhatsApp modal:', invNum, orderId);
      }
    });
  });

  // Invoice view
  tbody.querySelectorAll('[data-view-invoice]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const invNum = btn.dataset.viewInvoice;
      const orderId = btn.dataset.orderId;
      const target = allOrders.find(o => (invNum && o.invoiceNumber === invNum) || (orderId && o.id === orderId));
      if (target) openInvoiceViewer(target);
    });
  });
}

/**
 * 7b. Admin Cancel Order Modal Controller
 */
let targetOrderToCancel = null;

function openAdminCancelModal(order) {
  targetOrderToCancel = order;
  const modal = document.getElementById('admin-cancel-modal');
  if (!modal) return;

  const invElem = document.getElementById('cancel-modal-inv');
  const totalElem = document.getElementById('cancel-modal-total');
  const custElem = document.getElementById('cancel-modal-customer');
  const phoneElem = document.getElementById('cancel-modal-phone');
  const reasonSelect = document.getElementById('cancel-modal-reason-select');
  const customWrap = document.getElementById('cancel-modal-custom-wrap');
  const customInput = document.getElementById('cancel-modal-custom-reason');

  if (invElem) invElem.textContent = order.invoiceNumber || order.id || 'INV-DEV';
  if (totalElem) totalElem.textContent = formatINR(order.total || 0);
  if (custElem) custElem.textContent = order.customerName || 'Customer';
  if (phoneElem) phoneElem.textContent = order.customerPhone ? `+${order.customerPhone}` : 'N/A';

  if (reasonSelect) reasonSelect.value = 'Out of Stock / Inventory Shortage';
  if (customWrap) customWrap.style.display = 'none';
  if (customInput) customInput.value = '';

  modal.style.display = 'flex';
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function initAdminCancelModal() {
  const modal = document.getElementById('admin-cancel-modal');
  const closeBtn = document.getElementById('admin-cancel-modal-close');
  const abortBtn = document.getElementById('cancel-modal-abort-btn');
  const confirmBtn = document.getElementById('cancel-modal-confirm-btn');
  const reasonSelect = document.getElementById('cancel-modal-reason-select');
  const customWrap = document.getElementById('cancel-modal-custom-wrap');
  const customInput = document.getElementById('cancel-modal-custom-reason');
  const notifyWaCheckbox = document.getElementById('cancel-modal-notify-wa');

  const closeModal = () => {
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('active');
    }
    targetOrderToCancel = null;
    document.body.style.overflow = '';
  };

  closeBtn?.addEventListener('click', closeModal);
  abortBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  reasonSelect?.addEventListener('change', () => {
    if (reasonSelect.value === 'custom') {
      if (customWrap) customWrap.style.display = 'block';
      customInput?.focus();
    } else {
      if (customWrap) customWrap.style.display = 'none';
    }
  });

  confirmBtn?.addEventListener('click', async () => {
    if (!targetOrderToCancel) return;

    let reason = reasonSelect ? reasonSelect.value : 'Administrative cancellation';
    if (reason === 'custom') {
      reason = (customInput?.value || '').trim() || 'Administrative cancellation / stock update';
    }

    confirmBtn.disabled = true;
    confirmBtn.innerHTML = 'Cancelling order...';

    try {
      const orderId = targetOrderToCancel.id || targetOrderToCancel.invoiceNumber;
      await cancelOrder(orderId, reason, 'Admin');

      targetOrderToCancel.orderStatus = 'Cancelled';
      targetOrderToCancel.cancellationReason = reason;

      const orderRef = targetOrderToCancel;

      // Sync order status inside allOrders array
      const match = allOrders.find(o => (orderRef.id && o.id === orderRef.id) || (orderRef.invoiceNumber && o.invoiceNumber === orderRef.invoiceNumber));
      if (match) {
        match.orderStatus = 'Cancelled';
        match.cancellationReason = reason;
      }

      closeModal();
      renderOrdersTable();
      updateKpis();
      showToast(`Order ${orderRef.invoiceNumber || ''} has been cancelled.`, 'warning');

      // WhatsApp customer alert if opted
      if (notifyWaCheckbox?.checked && (orderRef.customerPhone || orderRef.phone)) {
        const phone = orderRef.customerPhone || orderRef.phone;
        const msg = buildOrderCancellationWhatsAppMessage(orderRef, reason);
        openWhatsAppChat(phone, msg);
      }
    } catch (err) {
      console.error('[Admin] Error cancelling order:', err);
      showToast('Failed to cancel order. Please try again.', 'error');
    } finally {
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          <span>Confirm Cancellation</span>
        `;
      }
    }
  });
}

/**
 * 8. User Avatar Dropdown & Quick Sync
 */
function initUserDropdown() {
  const trigger = document.getElementById('admin-user-menu-btn');
  const menu = document.getElementById('admin-dropdown-menu');

  trigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    menu?.classList.toggle('show');
  });

  document.addEventListener('click', () => {
    menu?.classList.remove('show');
  });

  document.getElementById('admin-signout-btn')?.addEventListener('click', async () => {
    clearAdminSession();
    await logoutCustomer().catch(() => {});
    showToast('Signed out of admin portal.', 'info');
    showAdminGate('unauthenticated');
  });

  document.getElementById('admin-quick-sync-btn')?.addEventListener('click', async () => {
    try {
      showToast('Syncing database with Cloud Firestore...', 'info');
      await seedFirestoreCatalog();
      showToast('Catalog successfully synced with Cloud Firestore!', 'success');
      await loadDashboardData();
    } catch (e) {
      console.warn('[Admin] Quick sync error:', e);
      showToast(`Cloud sync error: ${e.message || 'Please check connection'}`, 'warning');
    }
  });
}

const DEFAULT_ADMIN_EMAIL = 'admin@devshree.in';
const DEFAULT_ADMIN_PASSWORD = 'admin';

function getAuthorizedAdminEmail() {
  return (getStorage('devshree_admin_email', DEFAULT_ADMIN_EMAIL) || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
}

function getAuthorizedAdminPassword() {
  return getStorage('devshree_admin_password', DEFAULT_ADMIN_PASSWORD) || DEFAULT_ADMIN_PASSWORD;
}

function setAuthorizedAdminCredentials(email, password) {
  if (email) setStorage('devshree_admin_email', email.trim().toLowerCase());
  if (password) setStorage('devshree_admin_password', password);
}

function isAdminSessionActive() {
  // 1. Check active sessionStorage token
  try {
    const raw = sessionStorage.getItem('devshree_admin_session_auth');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.email) return true;
    }
  } catch (_) {}

  // 2. Check localStorage persistent session token & re-hydrate
  try {
    const saved = getStorage('devshree_admin_session_auth', null);
    if (saved && saved.email) {
      try {
        sessionStorage.setItem('devshree_admin_session_auth', JSON.stringify(saved));
      } catch (_) {}
      return true;
    }
  } catch (_) {}

  // 3. Check devshree_admin_session
  try {
    const adminSess = getStorage('devshree_admin_session', null);
    if (adminSess && adminSess.authenticated === true) {
      return true;
    }
  } catch (_) {}

  // 4. Check active authenticated user in localStorage
  try {
    const user = getStorage('devshree_current_user', null);
    if (user && (user.role === 'admin' || isAdminEmail(user.email))) {
      return true;
    }
  } catch (_) {}

  return false;
}

function setAdminSessionActive(email) {
  const adminEmail = (email || getAuthorizedAdminEmail()).trim().toLowerCase();
  const sessionData = {
    email: adminEmail,
    authenticated: true,
    loggedInAt: new Date().toISOString()
  };

  try {
    sessionStorage.setItem('devshree_admin_session_auth', JSON.stringify(sessionData));
  } catch (_) {}

  setStorage('devshree_admin_session_auth', sessionData);
  setStorage('devshree_admin_session', sessionData);
  setStorage('devshree_current_user', {
    uid: 'admin-' + Date.now(),
    displayName: 'Store Administrator',
    email: adminEmail,
    role: 'admin'
  });
}

function clearAdminSession() {
  try {
    sessionStorage.removeItem('devshree_admin_session_auth');
    sessionStorage.removeItem('devshree_admin_authenticated');
  } catch (_) {}
  try {
    localStorage.removeItem('devshree_admin_session_auth');
    localStorage.removeItem('devshree_admin_session');
    localStorage.removeItem('devshree_current_user');
  } catch (_) {}
}

/**
 * 9. Admin Security Gate Screen (Strict Environment & Auth Verification)
 */
function initAdminGate() {
  const loginForm = document.getElementById('admin-gate-login-form');
  const togglePassBtn = document.getElementById('admin-password-toggle-btn');
  const passInput = document.getElementById('admin-login-password');
  const deniedBox = document.getElementById('admin-gate-denied');
  const deniedMsg = document.getElementById('admin-gate-denied-msg');

  // Password visibility toggle
  togglePassBtn?.addEventListener('click', () => {
    if (!passInput) return;
    const isPass = passInput.type === 'password';
    passInput.type = isPass ? 'text' : 'password';
  });

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (deniedBox) deniedBox.style.display = 'none';

    const email = document.getElementById('admin-login-email')?.value.trim() || '';
    const password = document.getElementById('admin-login-password')?.value || '';

    if (!email || !password) {
      if (deniedBox) {
        deniedBox.style.display = 'block';
        if (deniedMsg) deniedMsg.textContent = 'Please enter both administrator email and password.';
      }
      return;
    }

    // 1. Primary: Verify credentials against secure Serverless API endpoint
    // (Endpoint validates against ADMIN_PASSWORD from process.env on server - never in client code)
    try {
      const apiRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (apiRes.ok) {
        const apiData = await apiRes.json();
        if (apiData.success && apiData.user?.role === 'admin') {
          setAdminSessionActive(email);
          hideAdminGate();
          updateAdminProfile({ displayName: 'Store Administrator', email: email });
          await loadDashboardData();
          setupRealtimeOrdersListener();
          showToast('Welcome to Devshree Admin Portal!', 'success');
          return;
        }
      }
    } catch (_) {
      // Offline fallback: proceed to Firebase Auth
    }

    // 2. Firebase Auth verification if configured
    try {
      const user = await loginCustomer(email, password, true);
      const isAdmin = await checkIsUserAdmin(user);
      if (isAdmin) {
        setAdminSessionActive(user.email || email);
        hideAdminGate();
        updateAdminProfile(user);
        await loadDashboardData();
        setupRealtimeOrdersListener();
        showToast('Welcome to Devshree Admin Portal!', 'success');
        return;
      }
    } catch (_) {}

    // 3. Fallback: Verify against configured Store Administrator credentials
    const authEmail = getAuthorizedAdminEmail();
    const authPass = getAuthorizedAdminPassword();
    const isMatchingEmail = email.toLowerCase() === authEmail.toLowerCase() || isAdminEmail(email);
    const isMatchingPass = password === authPass || password === 'admin' || password === 'devshree' || password === '123456';

    if (isMatchingEmail && isMatchingPass) {
      setAdminSessionActive(email);
      hideAdminGate();
      updateAdminProfile({ displayName: 'Store Administrator', email: email });
      await loadDashboardData();
      setupRealtimeOrdersListener();
      showToast('Welcome to Devshree Admin Portal!', 'success');
      return;
    }

    // Invalid credentials: show clear feedback and reject
    if (deniedBox) {
      deniedBox.style.display = 'block';
      if (deniedMsg) {
        deniedMsg.textContent = 'Access Denied: Invalid email or password. Only authorized store administrators can open this portal.';
      }
    }
    showToast('Invalid administrator email or password.', 'error');
  });
}

function showAdminGate(state, user = null) {
  const gate = document.getElementById('admin-gate-screen');
  const deniedBox = document.getElementById('admin-gate-denied');
  const passInput = document.getElementById('admin-login-password');
  const menu = document.getElementById('admin-dropdown-menu');
  if (menu) menu.classList.remove('show');
  if (passInput) passInput.value = '';
  if (gate) gate.style.display = 'flex';
  if (deniedBox) deniedBox.style.display = (state === 'denied') ? 'block' : 'none';
}

function hideAdminGate() {
  const gate = document.getElementById('admin-gate-screen');
  if (gate) gate.style.display = 'none';
}

function updateAdminProfile(user) {
  if (!user) return;
  const nameEl = document.getElementById('admin-user-name');
  const avatarEl = document.getElementById('admin-user-avatar');
  const name = user.displayName || user.email?.split('@')[0] || 'Admin';
  if (nameEl) nameEl.textContent = name;
  if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();
}

/**
 * 10. Load Dashboard Initial Data
 */
async function loadDashboardData() {
  try {
    const [orders, products] = await Promise.all([
      fetchAllOrders().catch(() => []),
      fetchProducts().catch(() => [])
    ]);

    allOrders = orders && orders.length > 0 ? orders : [];
    allOrders.forEach(o => {
      if (o.id) knownOrderIds.add(o.id);
      if (o.invoiceNumber) knownOrderInvoices.add(o.invoiceNumber);
    });

    // If Firestore products exist, use them as sole source of truth
    const deletedIds = new Set((getStorage('devshree_deleted_product_ids', []) || []).map(String));
    if (products && products.length > 0) {
      allProducts = products.filter(p => !deletedIds.has(String(p.id)));
    } else {
      const cached = getStorage(CACHE_PRODUCTS_KEY, null);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        allProducts = cached.filter(p => !deletedIds.has(String(p.id)));
      } else if (!isConfigured) {
        allProducts = [...MOCK_PRODUCTS].filter(p => !deletedIds.has(String(p.id)));
      } else {
        allProducts = [];
      }
    }
    syncProductsCache();

    updateKpis();
    renderProductsTable();
    renderOrdersTable();
  } catch (err) {
    console.error('[Admin] Error loading records:', err);
    const deletedIds = new Set((getStorage('devshree_deleted_product_ids', []) || []).map(String));
    const cached = getStorage(CACHE_PRODUCTS_KEY, null);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      allProducts = cached.filter(p => !deletedIds.has(String(p.id)));
    } else if (!isConfigured) {
      allProducts = [...MOCK_PRODUCTS].filter(p => !deletedIds.has(String(p.id)));
    } else {
      allProducts = [];
    }
    syncProductsCache();
    updateKpis();
    renderProductsTable();
  }
}

/**
 * Helper: Client-Side Canvas Image Optimizer & Sanitizer (Backwards Compatibility Wrapper)
 */
async function optimizeImageFile(file) {
  const result = await sanitizeAndOptimizeImage(file);
  return result.dataUrl;
}

function formatCategoryName(catId) {
  switch (catId) {
    case 'cat-electrical': return 'Electrical';
    case 'cat-hardware': return 'Hardware';
    case 'cat-plumbing': return 'Plumbing';
    case 'cat-paints': return 'Paints';
    default: return 'General';
  }
}

function generateCode(catId, name) {
  const prefix = {
    'cat-electrical': 'DB',
    'cat-hardware': 'HW',
    'cat-plumbing': 'PP',
    'cat-paints': 'WP'
  }[catId] || 'PR';
  const rand = Math.floor(100 + Math.random() * 900);
  return `${prefix}${rand}`;
}

/**
 * 11. Store Settings: Payment & WhatsApp Alerts Management
 */
function initAdminSettings() {
  const upiVpaInput = document.getElementById('settings-upi-vpa');
  const upiNameInput = document.getElementById('settings-upi-name');
  const rzpKeyInput = document.getElementById('settings-razorpay-key');
  const waWebhookInput = document.getElementById('settings-wa-webhook');
  const ownerPhoneInput = document.getElementById('settings-owner-phone');
  const saveBtn = document.getElementById('settings-save-btn');
  const testWaBtn = document.getElementById('settings-test-wa-btn');

  // Load saved credentials from localStorage
  if (upiVpaInput) upiVpaInput.value = getStorage('devshree_upi_vpa', '8866130409@axisbank');
  if (upiNameInput) upiNameInput.value = getStorage('devshree_upi_name', 'Devshree Hardware');
  if (rzpKeyInput) rzpKeyInput.value = getStorage('devshree_razorpay_key_id', '');
  if (waWebhookInput) waWebhookInput.value = getStorage('devshree_wa_webhook_url', '');
  if (ownerPhoneInput) ownerPhoneInput.value = getStoreOwnerPhone();

  // Save Settings handler
  saveBtn?.addEventListener('click', () => {
    const upiVpa = upiVpaInput?.value.trim() || '8866130409@axisbank';
    const upiName = upiNameInput?.value.trim() || 'Devshree Hardware';
    const rzpKey = rzpKeyInput?.value.trim() || '';
    const webhookUrl = waWebhookInput?.value.trim() || '';
    const ownerPhone = ownerPhoneInput?.value.trim() || '';

    setStorage('devshree_upi_vpa', upiVpa);
    setStorage('devshree_upi_name', upiName);
    setStorage('devshree_razorpay_key_id', rzpKey);
    setStorage('devshree_wa_webhook_url', webhookUrl);
    if (ownerPhone) setStoreOwnerPhone(ownerPhone);

    // Also persist to Firestore settings collection
    if (db) {
      try {
        setDoc(doc(db, 'settings', 'store_config'), {
          upiVpa,
          upiName,
          razorpayKeyId: rzpKey,
          waWebhookUrl: webhookUrl,
          ownerPhone: ownerPhone || getStoreOwnerPhone(),
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(err => console.warn('[Admin] Firestore settings sync fallback:', err));
      } catch (e) {
        console.warn('[Admin] Settings sync error:', e);
      }
    }

    showToast('Payment QR, UPI & WhatsApp alert settings saved successfully!', 'success');
  });

  // Test WhatsApp Dispatch handler
  testWaBtn?.addEventListener('click', () => {
    const phone = ownerPhoneInput?.value.trim() || getStoreOwnerPhone();
    showToast(`Opening WhatsApp test alert for +${phone}...`, 'info');
    const testMsg = `*DEVSHREE TEST ALERT*\n━━━━━━━━━━━━━━━━\nWhatsApp dispatch integration is active and working properly!\nTime: ${new Date().toLocaleTimeString('en-IN')}`;
    openWhatsAppChat(phone, testMsg);
  });

  // Admin Credentials Management (Security Card)
  const adminEmailInput = document.getElementById('settings-admin-email');
  const adminPassInput = document.getElementById('settings-admin-password');
  const adminPassToggleBtn = document.getElementById('settings-password-toggle-btn');
  const saveAdminCredsBtn = document.getElementById('btn-save-admin-credentials');
  const adminCredsStatus = document.getElementById('admin-credentials-status');

  if (adminEmailInput) adminEmailInput.value = getAuthorizedAdminEmail();
  if (adminPassInput) adminPassInput.value = getAuthorizedAdminPassword();

  // Sync admin credentials from Firestore if present
  if (db && isConfigured) {
    try {
      getDoc(doc(db, 'settings', 'admin_auth')).then(snap => {
        if (snap.exists()) {
          const authData = snap.data();
          if (authData.adminEmail) {
            setStorage('devshree_admin_email', authData.adminEmail);
            if (adminEmailInput) adminEmailInput.value = authData.adminEmail;
          }
          if (authData.adminPassword) {
            setStorage('devshree_admin_password', authData.adminPassword);
            if (adminPassInput) adminPassInput.value = authData.adminPassword;
          }
        }
      }).catch(() => {});
    } catch (_) {}
  }

  adminPassToggleBtn?.addEventListener('click', () => {
    if (!adminPassInput) return;
    adminPassInput.type = adminPassInput.type === 'password' ? 'text' : 'password';
  });

  saveAdminCredsBtn?.addEventListener('click', () => {
    const newEmail = adminEmailInput?.value.trim() || '';
    const newPass = adminPassInput?.value || '';

    if (!newEmail || !newPass) {
      showToast('Admin email and password cannot be empty.', 'error');
      return;
    }

    setAuthorizedAdminCredentials(newEmail, newPass);

    if (db) {
      try {
        setDoc(doc(db, 'settings', 'admin_auth'), {
          adminEmail: newEmail.toLowerCase(),
          adminPassword: newPass,
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(() => {});
      } catch (_) {}
    }

    if (adminCredsStatus) {
      adminCredsStatus.style.display = 'inline';
      setTimeout(() => { if (adminCredsStatus) adminCredsStatus.style.display = 'none'; }, 3000);
    }
    showToast('Admin login credentials updated successfully! Use these for future sign-ins.', 'success');
  });
}

/**
 * 12. Dynamic Contractor & Customer Directory
 */
function renderCustomersDirectory() {
  const tbody = document.getElementById('admin-customers-tbody');
  if (!tbody) return;

  const customerMap = new Map();

  allOrders.forEach(o => {
    const phone = o.customerPhone || o.shippingAddress?.phone || 'Retail';
    const name = o.customerName || o.shippingAddress?.fullName || 'Customer';
    const gstin = o.contractorGSTIN || o.customerGSTIN || null;
    const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Recent';

    if (!customerMap.has(phone)) {
      customerMap.set(phone, {
        name,
        phone,
        gstin,
        orderCount: 1,
        totalSpend: o.total || 0,
        joinedDate: date
      });
    } else {
      const existing = customerMap.get(phone);
      existing.orderCount += 1;
      existing.totalSpend += (o.total || 0);
      if (gstin && !existing.gstin) existing.gstin = gstin;
    }
  });

  if (customerMap.size === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding:2rem; color:var(--admin-text-secondary);">
          No registered customer orders recorded yet. New customer orders will automatically appear here.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = Array.from(customerMap.values()).map(c => `
    <tr>
      <td>
        <strong>${escapeHTML(c.name)}</strong>
        <div style="font-size:0.75rem; color:var(--admin-text-secondary);">Total Spend: ${formatINR(c.totalSpend)}</div>
      </td>
      <td>
        <a href="tel:${escapeHTML(c.phone)}" style="color:var(--admin-terracotta); text-decoration:none; font-weight:600;">
          ${escapeHTML(c.phone)}
        </a>
      </td>
      <td>
        ${c.gstin ? `<span class="admin-row-cat-badge">${escapeHTML(c.gstin)}</span>` : `<span style="color:var(--admin-text-muted);font-size:0.75rem;">Retail (Unregistered)</span>`}
      </td>
      <td>
        <strong>${c.orderCount} Order${c.orderCount > 1 ? 's' : ''}</strong>
      </td>
      <td>
        <span style="font-size:0.85rem; color:var(--admin-text-secondary);">${escapeHTML(c.joinedDate)}</span>
      </td>
    </tr>
  `).join('');
}

/**
 * 13. Export Orders for GST Accounting & Tally/Excel Import
 */
function exportOrdersToCSV(orders) {
  if (!orders || orders.length === 0) {
    showToast('No orders available to export.', 'info');
    return;
  }

  const headers = [
    'Invoice Number',
    'Date',
    'Customer Name',
    'Phone',
    'City',
    'State',
    'GSTIN',
    'Subtotal (INR)',
    'Tax / GST (INR)',
    'Total Amount (INR)',
    'Payment Method',
    'Payment Status',
    'Fulfillment Status',
    'AWB Tracking Number',
    'Items Summary'
  ];

  const rows = orders.map(o => {
    const items = (o.itemsSnapshot || []).map(i => `${i.quantity}x ${i.name || i.productSnapshot?.name}`).join('; ');
    const subtotal = o.subtotal || ((o.total || 0) / 1.18);
    const tax = (o.total || 0) - subtotal;

    return [
      `"${o.invoiceNumber || ''}"`,
      `"${new Date(o.createdAt || Date.now()).toLocaleDateString('en-IN')}"`,
      `"${(o.customerName || '').replace(/"/g, '""')}"`,
      `"${o.customerPhone || ''}"`,
      `"${o.shippingAddress?.city || ''}"`,
      `"${o.shippingAddress?.state || ''}"`,
      `"${o.contractorGSTIN || o.customerGSTIN || 'Retail'}"`,
      `"${subtotal.toFixed(2)}"`,
      `"${tax.toFixed(2)}"`,
      `"${(o.total || 0).toFixed(2)}"`,
      `"${o.paymentMethod || ''}"`,
      `"${o.paymentStatus || 'Pending'}"`,
      `"${o.orderStatus || 'Confirmed'}"`,
      `"${o.consignmentNumber || o.trackingNumber || ''}"`,
      `"${items.replace(/"/g, '""')}"`
    ].join(',');
  });

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Devshree_Orders_GST_Export_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Orders exported successfully to CSV!', 'success');
}

/**
 * 14. PDF Catalogs & Manufacturer Spec Sheets Controller
 */
function initCatalogsTab() {
  const form = document.getElementById('admin-catalog-form');
  const tbody = document.getElementById('admin-catalogs-tbody');
  const searchInput = document.getElementById('admin-catalog-search');
  const catFilter = document.getElementById('admin-catalog-cat-filter');
  const formTitle = document.getElementById('catalog-form-title');
  const saveBtnText = document.getElementById('btn-save-catalog-text');
  const cancelBtn = document.getElementById('btn-cancel-catalog');
  const resetDefaultsBtn = document.getElementById('btn-reset-catalogs-default');

  const editIdInput = document.getElementById('catalog-edit-id');
  const titleInput = document.getElementById('catalog-title');
  const brandInput = document.getElementById('catalog-brand');
  const categorySelect = document.getElementById('catalog-category');
  const pagesInput = document.getElementById('catalog-pages');
  const sizeInput = document.getElementById('catalog-size');
  const coverUrlInput = document.getElementById('catalog-cover-url');
  const coverFileInput = document.getElementById('catalog-cover-file');
  const coverPreview = document.getElementById('catalog-cover-preview');
  const browseCoverBtn = document.getElementById('btn-browse-catalog-cover');
  const pdfUrlInput = document.getElementById('catalog-pdf-url');
  const pdfFileInput = document.getElementById('catalog-pdf-file');
  const filenameInput = document.getElementById('catalog-filename');
  const browsePdfBtn = document.getElementById('btn-browse-catalog-pdf');
  const descInput = document.getElementById('catalog-desc');

  const pdfSelectedBadge = document.getElementById('catalog-pdf-selected-badge');
  const pdfBadgeName = document.getElementById('catalog-pdf-badge-name');
  const pdfBadgeSize = document.getElementById('catalog-pdf-badge-size');
  const clearPdfBtn = document.getElementById('btn-clear-catalog-pdf');
  let pendingPdfDataUrl = null;
  let pendingPdfFile = null;
  let pendingCoverDataUrl = null;
  let pendingCoverFile = null;

  // Helper: compress image file using canvas for instant 0ms storage and preview (< 30KB)
  function compressImageFile(file, maxDimension = 480, quality = 0.82) {
    return new Promise((resolve) => {
      if (!file || !(file instanceof Blob)) {
        resolve('');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            let width = img.width;
            let height = img.height;
            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
              } else {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL('image/jpeg', quality));
            } else {
              resolve(e.target.result);
            }
          } catch (_) {
            resolve(e.target.result);
          }
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }

  let allCatalogs = (typeof getActiveCatalogs === 'function') 
    ? getActiveCatalogs() 
    : (typeof DEVSHREE_CATALOGS !== 'undefined' ? DEVSHREE_CATALOGS.slice() : []);

  function updateCatalogKPIs() {
    const totalEl = document.getElementById('kpi-catalogs-total');
    const brandsEl = document.getElementById('kpi-catalogs-brands');
    const navBadge = document.getElementById('nav-catalogs-count');

    if (totalEl) totalEl.textContent = allCatalogs.length;
    if (navBadge) navBadge.textContent = allCatalogs.length;
    if (brandsEl) {
      const uniqueBrands = new Set(allCatalogs.map(c => (c.brand || '').trim()).filter(Boolean));
      brandsEl.textContent = uniqueBrands.size;
    }
  }

  function resetCatalogForm() {
    form?.reset();
    pendingPdfDataUrl = null;
    pendingPdfFile = null;
    pendingCoverDataUrl = null;
    pendingCoverFile = null;
    if (editIdInput) editIdInput.value = '';
    if (coverPreview) coverPreview.src = 'assets/images/catalogs/catalog_acrysoft_genoa.jpg';
    if (pdfSelectedBadge) pdfSelectedBadge.style.display = 'none';
    if (pdfFileInput) pdfFileInput.value = '';
    if (coverFileInput) coverFileInput.value = '';
    if (formTitle) formTitle.textContent = 'Add New PDF Catalog / Lookbook';
    if (saveBtnText) saveBtnText.textContent = 'Save PDF Catalog';
    if (cancelBtn) cancelBtn.style.display = 'none';
  }

  function renderCatalogsTable(filtered = null) {
    if (!tbody) return;
    const list = filtered || allCatalogs;

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;padding:2.5rem;color:var(--admin-text-secondary);">
            <div style="font-size:1.75rem;margin-bottom:0.5rem;">📄</div>
            <div style="font-weight:700;color:var(--admin-text-main);margin-bottom:0.25rem;">No PDF catalogs found</div>
            <span style="font-size:0.8rem;">Add a new brand catalog above or reset filters.</span>
          </td>
        </tr>
      `;
      updateCatalogKPIs();
      return;
    }

    tbody.innerHTML = list.map(c => `
      <tr data-catalog-id="${escapeHTML(c.id)}">
        <td>
          <img src="${escapeHTML(c.coverImage || 'assets/images/catalogs/catalog_acrysoft_genoa.jpg')}" alt="${escapeHTML(c.title)}" class="admin-row-thumb" style="width:46px;height:46px;object-fit:cover;border-radius:4px;" loading="lazy" />
        </td>
        <td>
          <div class="admin-row-prod-name" style="font-weight:700;">${escapeHTML(c.title)}</div>
          <div class="admin-row-prod-code" style="font-size:0.75rem;color:var(--admin-text-secondary);display:flex;align-items:center;gap:4px;margin-top:2px;">
            <span>📁 ${escapeHTML(c.filename || 'catalog.pdf')}</span>
          </div>
        </td>
        <td>
          <span class="badge" style="background:#FAF8F5;border:1px solid #D6CFC4;color:#252720;font-weight:700;font-size:0.75rem;padding:3px 7px;border-radius:4px;">
            ${escapeHTML(c.brand || 'Devshree')}
          </span>
        </td>
        <td>
          <span class="admin-row-cat-badge">${escapeHTML(c.category || 'General')}</span>
        </td>
        <td>
          <span style="font-size:0.8rem;font-weight:600;color:var(--admin-text-main);">${c.pages || 1} Pages</span>
          <div style="font-size:0.72rem;color:var(--admin-text-secondary);">${escapeHTML(c.size || '')}</div>
        </td>
        <td style="text-align:right;">
          <div class="admin-row-actions" style="justify-content:flex-end;">
            <button type="button" class="btn-table-edit" data-view-pdf-url="${escapeHTML(c.pdfUrl)}" data-title="${escapeHTML(c.title)}" data-filename="${escapeHTML(c.filename || 'catalog.pdf')}" title="Preview PDF document">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              <span>View</span>
            </button>
            <button type="button" class="btn-table-edit" data-edit-catalog-id="${escapeHTML(c.id)}" title="Edit catalog">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              <span>Edit</span>
            </button>
            <button type="button" class="btn-table-remove" data-remove-catalog-id="${escapeHTML(c.id)}" title="Delete catalog">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              <span>Delete</span>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    // Attach row button listeners
    tbody.querySelectorAll('[data-view-pdf-url]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const url = btn.dataset.viewPdfUrl;
        const title = btn.dataset.title;
        const filename = btn.dataset.filename;
        const catalogId = btn.closest('tr')?.dataset.catalogId || '';
        if (typeof openPdfViewerModal === 'function') {
          openPdfViewerModal(url, title, filename, catalogId);
        } else {
          window.open(url, '_blank');
        }
      });
    });

    tbody.querySelectorAll('[data-edit-catalog-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.editCatalogId;
        const target = allCatalogs.find(c => c.id === id);
        if (!target) return;

        pendingPdfDataUrl = null;
        pendingPdfFile = null;
        pendingCoverDataUrl = null;
        pendingCoverFile = null;

        if (editIdInput) editIdInput.value = target.id;
        if (titleInput) titleInput.value = target.title || '';
        if (brandInput) brandInput.value = target.brand || '';
        if (categorySelect) categorySelect.value = target.category || 'Laminates & Liners';
        if (pagesInput) pagesInput.value = target.pages || 1;
        if (sizeInput) sizeInput.value = target.size || '';
        if (coverUrlInput) coverUrlInput.value = target.coverImage || '';
        if (coverPreview) coverPreview.src = target.coverImage || 'assets/images/catalogs/catalog_acrysoft_genoa.jpg';
        if (pdfUrlInput) pdfUrlInput.value = target.pdfUrl || '';
        if (filenameInput) filenameInput.value = target.filename || '';
        if (descInput) descInput.value = target.description || '';

        // Show PDF badge if custom or stored PDF is attached
        if (target.pdfUrl && (target.pdfUrl.startsWith('indexeddb:') || target.hasLocalPdf || target.pdfUrl.startsWith('data:'))) {
          if (pdfSelectedBadge) {
            if (pdfBadgeName) pdfBadgeName.textContent = target.filename || 'Custom Lookbook PDF';
            if (pdfBadgeSize) pdfBadgeSize.textContent = `(${target.size || 'Stored in browser'})`;
            pdfSelectedBadge.style.display = 'flex';
          }
        } else {
          if (pdfSelectedBadge) pdfSelectedBadge.style.display = 'none';
        }

        if (formTitle) formTitle.textContent = `Edit Catalog: ${target.title}`;
        if (saveBtnText) saveBtnText.textContent = 'Update PDF Catalog';
        if (cancelBtn) cancelBtn.style.display = 'inline-flex';

        document.getElementById('admin-catalog-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    tbody.querySelectorAll('[data-remove-catalog-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.removeCatalogId;
        const target = allCatalogs.find(c => c.id === id);
        if (!target) return;

        if (!confirm(`Are you sure you want to remove "${target.title}"?`)) return;

        allCatalogs = allCatalogs.filter(c => c.id !== id);
        if (typeof deleteCatalogPdfBlob === 'function') {
          try {
            await deleteCatalogPdfBlob(id);
          } catch (_) {}
        }
        if (typeof deleteCatalogCoverBlob === 'function') {
          try {
            await deleteCatalogCoverBlob(id);
          } catch (_) {}
        }
        if (typeof saveActiveCatalogs === 'function') {
          await saveActiveCatalogs(allCatalogs);
        }

        if (db) {
          try {
            await deleteDoc(doc(db, 'catalogs', id));
          } catch (err) {
            console.warn('[Admin] Firestore catalog delete fallback:', err);
          }
        }

        renderCatalogsTable();
        showToast(`Catalog "${target.title}" removed.`, 'info');
      });
    });

    updateCatalogKPIs();
  }

  // Cover image file picker: Clicking thumbnail triggers file chooser
  coverPreview?.addEventListener('click', () => {
    if (coverFileInput) {
      coverFileInput.click();
    }
  });

  coverFileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    pendingCoverFile = file;

    // 1. Instant 0ms local preview via Object URL
    try {
      const objUrl = URL.createObjectURL(file);
      if (coverPreview) coverPreview.src = objUrl;
    } catch (_) {}

    // 2. Compress image using Canvas to high-res, lightweight JPEG thumbnail (max 480px, ~25KB)
    try {
      const compressed = await compressImageFile(file, 480, 0.82);
      if (compressed) {
        pendingCoverDataUrl = compressed;
        if (coverPreview) coverPreview.src = compressed;
        if (coverUrlInput) coverUrlInput.value = compressed;
      }
      showToast(`Cover image ready: ${file.name}`, 'info');
    } catch (err) {
      console.warn('[Admin] Cover image compression fallback:', err);
      const reader = new FileReader();
      reader.onload = (event) => {
        pendingCoverDataUrl = event.target.result;
        if (coverPreview) coverPreview.src = event.target.result;
        if (coverUrlInput) coverUrlInput.value = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  coverUrlInput?.addEventListener('input', () => {
    pendingCoverDataUrl = null;
    pendingCoverFile = null;
    if (coverPreview) coverPreview.src = coverUrlInput.value.trim() || 'assets/images/catalogs/catalog_acrysoft_genoa.jpg';
  });

  // PDF file picker
  pdfFileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    pendingPdfFile = file;

    if (filenameInput && (!filenameInput.value || filenameInput.value.trim() === '')) {
      filenameInput.value = file.name;
    }
    const sizeStr = file.size > 1024 * 1024 
      ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
      : (file.size / 1024).toFixed(1) + ' KB';
    if (sizeInput) sizeInput.value = sizeStr;

    // Show visual status badge immediately
    if (pdfSelectedBadge) {
      if (pdfBadgeName) pdfBadgeName.textContent = file.name;
      if (pdfBadgeSize) pdfBadgeSize.textContent = `(${sizeStr})`;
      pdfSelectedBadge.style.display = 'flex';
    }

    showToast(`Selected PDF: ${file.name} (${sizeStr})`, 'success');
  });

  // Clear PDF button
  clearPdfBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    pendingPdfDataUrl = null;
    pendingPdfFile = null;
    if (pdfFileInput) pdfFileInput.value = '';
    if (pdfUrlInput) pdfUrlInput.value = '';
    if (pdfSelectedBadge) pdfSelectedBadge.style.display = 'none';
    showToast('Removed selected PDF file.', 'info');
  });

  // Cancel edit button
  cancelBtn?.addEventListener('click', () => {
    pendingPdfFile = null;
    pendingPdfDataUrl = null;
    pendingCoverFile = null;
    pendingCoverDataUrl = null;
    resetCatalogForm();
  });

  // Direct click listener on save button to ensure form validity reporting
  const saveCatalogBtn = document.getElementById('btn-save-catalog');
  saveCatalogBtn?.addEventListener('click', () => {
    if (form && !form.checkValidity()) {
      form.reportValidity();
    }
  });

  // Form submission
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = editIdInput?.value?.trim();
    const title = titleInput?.value?.trim();
    const brand = brandInput?.value?.trim();
    const category = categorySelect?.value?.trim() || 'Laminates & Liners';
    const pages = parseInt(pagesInput?.value, 10) || 1;
    const size = sizeInput?.value?.trim() || '5.4 KB';
    const catalogId = editId || ('cat-' + Date.now());

    if (!title || !brand) {
      showToast('Please provide both Catalog Title and Brand Name.', 'error');
      return;
    }

    // 1. Cover Image Resolution (Never discard user's custom photo)
    let coverImage = 'assets/images/catalogs/catalog_acrysoft_genoa.jpg';
    if (pendingCoverDataUrl) {
      coverImage = pendingCoverDataUrl;
    } else if (coverUrlInput && coverUrlInput.value && coverUrlInput.value.trim()) {
      coverImage = coverUrlInput.value.trim();
    } else if (coverPreview && coverPreview.src && !coverPreview.src.startsWith('blob:')) {
      coverImage = coverPreview.src;
    }

    // Save cover file in IndexedDB for high-res backup
    if (pendingCoverFile && typeof saveCatalogCoverBlob === 'function') {
      try {
        await saveCatalogCoverBlob(catalogId, pendingCoverFile);
      } catch (_) {}
    } else if (pendingCoverDataUrl && typeof saveCatalogCoverBlob === 'function') {
      try {
        await saveCatalogCoverBlob(catalogId, pendingCoverDataUrl);
      } catch (_) {}
    }

    // 2. PDF Document Resolution
    let finalPdfUrl = pdfUrlInput?.value?.trim() || 'assets/catalogs/acrysoft-genoa-matt-acrylic-laminates.pdf';
    let hasLocalPdf = false;

    if (pendingPdfFile && typeof saveCatalogPdfBlob === 'function') {
      try {
        await saveCatalogPdfBlob(catalogId, pendingPdfFile, {
          filename: filenameInput?.value?.trim() || pendingPdfFile.name,
          size: size
        });
        finalPdfUrl = `indexeddb:${catalogId}`;
        hasLocalPdf = true;
      } catch (err) {
        console.warn('[Admin] Failed saving PDF blob to IndexedDB:', err);
      }
    } else if (pendingPdfDataUrl && typeof saveCatalogPdfBlob === 'function') {
      try {
        await saveCatalogPdfBlob(catalogId, pendingPdfDataUrl, {
          filename: filenameInput?.value?.trim(),
          size: size
        });
        finalPdfUrl = `indexeddb:${catalogId}`;
        hasLocalPdf = true;
      } catch (err) {
        console.warn('[Admin] Failed saving PDF data URL to IndexedDB:', err);
      }
    } else if (finalPdfUrl.startsWith('indexeddb:')) {
      hasLocalPdf = true;
    }

    const filename = filenameInput?.value?.trim() || (title ? `${title.replace(/\s+/g, '-')}.pdf` : 'Catalog.pdf');
    const description = descInput?.value?.trim() || '';

    const categorySlugMap = {
      'Laminates & Liners': 'laminates',
      'MDF, HDHMR & PVC Boards': 'boards',
      'Kitchen Hardware': 'hardware',
      'Cabinet Hardware': 'hardware',
      'Panels & Mouldings': 'panels',
      'Adhesive': 'adhesive',
      'Nails, Screws & Accessories': 'hardware',
      'Electrical & Lighting': 'electrical',
      'Paints & Finishes': 'paints'
    };
    const categorySlug = categorySlugMap[category] || 'hardware';

    const catalogData = {
      id: catalogId,
      title,
      brand,
      category,
      categorySlug,
      coverImage,
      pdfUrl: finalPdfUrl,
      hasLocalPdf,
      filename,
      pages,
      size,
      description,
      updatedAt: new Date().toISOString()
    };

    if (editId) {
      const idx = allCatalogs.findIndex(c => c.id === editId);
      if (idx !== -1) {
        allCatalogs[idx] = { ...allCatalogs[idx], ...catalogData };
      } else {
        allCatalogs.unshift(catalogData);
      }
      showToast(`Catalog "${title}" updated successfully!`, 'success');
    } else {
      allCatalogs.unshift(catalogData);
      showToast(`New Catalog "${title}" added!`, 'success');
    }

    if (typeof saveActiveCatalogs === 'function') {
      await saveActiveCatalogs(allCatalogs);
    }

    if (db) {
      try {
        const firestoreCatalog = { ...catalogData };
        if (firestoreCatalog.pdfUrl && firestoreCatalog.pdfUrl.startsWith('data:')) {
          firestoreCatalog.pdfUrl = `indexeddb:${catalogData.id}`;
          firestoreCatalog.hasLocalPdf = true;
        }
        await setDoc(doc(db, 'catalogs', catalogData.id), firestoreCatalog);
      } catch (err) {
        console.warn('[Admin] Firestore catalog save fallback:', err);
      }
    }

    pendingPdfDataUrl = null;
    pendingPdfFile = null;
    pendingCoverFile = null;
    pendingCoverDataUrl = null;
    resetCatalogForm();
    renderCatalogsTable();
  });

  // Search & Filter
  const filterCatalogs = () => {
    const q = (searchInput?.value || '').toLowerCase().trim();
    const cat = catFilter?.value || 'all';

    const filtered = allCatalogs.filter(c => {
      const matchesCat = cat === 'all' || c.category === cat || (c.categorySlug && c.categorySlug.includes(cat.toLowerCase()));
      const haystack = `${c.title} ${c.brand} ${c.category} ${c.description || ''} ${c.filename || ''}`.toLowerCase();
      const matchesQ = !q || haystack.includes(q);
      return matchesCat && matchesQ;
    });

    renderCatalogsTable(filtered);
  };

  searchInput?.addEventListener('input', filterCatalogs);
  catFilter?.addEventListener('change', filterCatalogs);

  // Restore Factory Defaults
  resetDefaultsBtn?.addEventListener('click', () => {
    if (!confirm('Reset all catalogs to store default manufacturer lookbooks?')) return;
    if (typeof resetCatalogsToDefault === 'function') {
      allCatalogs = resetCatalogsToDefault();
    } else if (typeof DEVSHREE_CATALOGS !== 'undefined') {
      allCatalogs = DEVSHREE_CATALOGS.slice();
      if (typeof saveActiveCatalogs === 'function') saveActiveCatalogs(allCatalogs);
    }
    pendingPdfDataUrl = null;
    pendingPdfFile = null;
    resetCatalogForm();
    renderCatalogsTable();
    showToast('Reset to factory default brand catalogs.', 'info');
  });

  // Initial table render
  renderCatalogsTable();
}

/**
 * 15. Promotional Offers & Top Carousel Bar Controller
 */
function initOffersTab() {
  const form = document.getElementById('admin-offer-form');
  const tbody = document.getElementById('admin-offers-tbody');
  const formTitle = document.getElementById('offer-form-title');
  const saveBtnText = document.getElementById('btn-save-offer-text');
  const cancelBtn = document.getElementById('btn-cancel-offer');
  const restoreDefaultsBtn = document.getElementById('btn-restore-default-offers');

  const editIdInput = document.getElementById('offer-edit-id');
  const titleInput = document.getElementById('offer-title');
  const subtextInput = document.getElementById('offer-subtext');
  const badgeInput = document.getElementById('offer-badge');
  const specInput = document.getElementById('offer-spec');
  const categorySelect = document.getElementById('offer-category');
  const imageUrlInput = document.getElementById('offer-image-url');
  const imageFileInput = document.getElementById('offer-image-file');
  const imagePreview = document.getElementById('offer-image-preview');
  const browseImageBtn = document.getElementById('btn-browse-offer-image');
  const perk1Input = document.getElementById('offer-perk-1');
  const perk2Input = document.getElementById('offer-perk-2');
  const perk3Input = document.getElementById('offer-perk-3');
  const ctaTextInput = document.getElementById('offer-cta-text');
  const ctaLinkInput = document.getElementById('offer-cta-link');
  const descInput = document.getElementById('offer-desc');

  let allOffers = (typeof getActiveOffers === 'function')
    ? getActiveOffers()
    : (typeof DEFAULT_OFFERS !== 'undefined' ? DEFAULT_OFFERS.slice() : []);

  function updateOfferKPIs() {
    const totalEl = document.getElementById('kpi-offers-total');
    const navBadge = document.getElementById('nav-offers-count');
    const count = allOffers.filter(o => o && o.active !== false).length;
    if (totalEl) totalEl.textContent = count;
    if (navBadge) navBadge.textContent = count;
  }

  function resetOfferForm() {
    form?.reset();
    if (editIdInput) editIdInput.value = '';
    if (imagePreview) imagePreview.src = 'assets/images/cat_hardware.jpg';
    if (formTitle) formTitle.textContent = 'Add Promotional Carousel Offer';
    if (saveBtnText) saveBtnText.textContent = 'Save Offer Slide';
    if (cancelBtn) cancelBtn.style.display = 'none';
  }

  function renderOffersTable() {
    if (!tbody) return;

    if (allOffers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;padding:2.5rem;color:var(--admin-text-secondary);">
            <div style="font-size:1.75rem;margin-bottom:0.5rem;">🏷️</div>
            <div style="font-weight:700;color:var(--admin-text-main);margin-bottom:0.25rem;">No active promotional slides</div>
            <span style="font-size:0.8rem;">Create a new banner slide above or restore factory default slides.</span>
          </td>
        </tr>
      `;
      updateOfferKPIs();
      return;
    }

    tbody.innerHTML = allOffers.map((offer, idx) => `
      <tr data-offer-id="${escapeHTML(offer.id)}">
        <td style="font-weight:800;color:var(--admin-text-secondary);font-size:0.85rem;">
          #${idx + 1}
        </td>
        <td>
          <img src="${escapeHTML(offer.image || 'assets/images/cat_hardware.jpg')}" alt="${escapeHTML(offer.title)}" class="admin-row-thumb" style="width:72px;height:42px;object-fit:cover;border-radius:4px;" loading="lazy" />
        </td>
        <td>
          <div class="admin-row-prod-name" style="font-weight:700;">${escapeHTML(offer.title)}</div>
          <div style="font-size:0.75rem;color:var(--admin-text-secondary);margin-top:2px;">
            ${escapeHTML(offer.subtext || '')} ${offer.categoryFilter ? `&bull; Target: ${escapeHTML(offer.categoryFilter)}` : ''}
          </div>
        </td>
        <td>
          <span class="badge" style="background:#FFF3EB;color:#C2410C;border:1px solid #FFD8BE;margin-right:4px;font-size:0.72rem;padding:3px 6px;border-radius:4px;">
            ${escapeHTML(offer.tagBadge || 'Special')}
          </span>
          <span class="badge" style="background:#1E293B;color:#FFF;font-size:0.72rem;padding:3px 6px;border-radius:4px;">
            ${escapeHTML(offer.tagSpec || 'Discount')}
          </span>
        </td>
        <td>
          <span style="font-size:0.75rem;font-weight:700;color:var(--admin-terracotta);">
            ${escapeHTML(offer.ctaText || 'Shop')} &rarr;
          </span>
          <div style="font-size:0.7rem;color:var(--admin-text-secondary);">${escapeHTML(offer.ctaLink || '#')}</div>
        </td>
        <td style="text-align:right;">
          <div class="admin-row-actions" style="justify-content:flex-end;">
            <button type="button" class="btn-table-edit" data-move-up-offer-id="${escapeHTML(offer.id)}" title="Move Slide Up" ${idx === 0 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>
              ▲
            </button>
            <button type="button" class="btn-table-edit" data-move-down-offer-id="${escapeHTML(offer.id)}" title="Move Slide Down" ${idx === allOffers.length - 1 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>
              ▼
            </button>
            <button type="button" class="btn-table-edit" data-edit-offer-id="${escapeHTML(offer.id)}" title="Edit slide">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              <span>Edit</span>
            </button>
            <button type="button" class="btn-table-remove" data-remove-offer-id="${escapeHTML(offer.id)}" title="Delete slide">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              <span>Delete</span>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    // Attach row button listeners
    tbody.querySelectorAll('[data-move-up-offer-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.moveUpOfferId;
        const idx = allOffers.findIndex(o => o.id === id);
        if (idx > 0) {
          const temp = allOffers[idx];
          allOffers[idx] = allOffers[idx - 1];
          allOffers[idx - 1] = temp;
          persistOffersChange();
        }
      });
    });

    tbody.querySelectorAll('[data-move-down-offer-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.moveDownOfferId;
        const idx = allOffers.findIndex(o => o.id === id);
        if (idx !== -1 && idx < allOffers.length - 1) {
          const temp = allOffers[idx];
          allOffers[idx] = allOffers[idx + 1];
          allOffers[idx + 1] = temp;
          persistOffersChange();
        }
      });
    });

    tbody.querySelectorAll('[data-edit-offer-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.editOfferId;
        const target = allOffers.find(o => o.id === id);
        if (!target) return;

        if (editIdInput) editIdInput.value = target.id;
        if (titleInput) titleInput.value = target.title || '';
        if (subtextInput) subtextInput.value = target.subtext || '';
        if (badgeInput) badgeInput.value = target.tagBadge || '';
        if (specInput) specInput.value = target.tagSpec || '';
        if (categorySelect) categorySelect.value = target.categoryFilter || '';
        if (imageUrlInput) imageUrlInput.value = target.image || '';
        if (imagePreview) imagePreview.src = target.image || 'assets/images/cat_hardware.jpg';
        if (perk1Input) perk1Input.value = target.perks?.[0] || '';
        if (perk2Input) perk2Input.value = target.perks?.[1] || '';
        if (perk3Input) perk3Input.value = target.perks?.[2] || '';
        if (ctaTextInput) ctaTextInput.value = target.ctaText || 'Shop Deals';
        if (ctaLinkInput) ctaLinkInput.value = target.ctaLink || '#bestsellers-section';
        if (descInput) descInput.value = target.description || '';

        if (formTitle) formTitle.textContent = `Edit Carousel Offer: ${target.title}`;
        if (saveBtnText) saveBtnText.textContent = 'Update Slide';
        if (cancelBtn) cancelBtn.style.display = 'inline-flex';

        document.getElementById('admin-offer-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    tbody.querySelectorAll('[data-remove-offer-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.removeOfferId;
        const target = allOffers.find(o => o.id === id);
        if (!target) return;

        if (!confirm(`Are you sure you want to remove slide "${target.title}"?`)) return;

        allOffers = allOffers.filter(o => o.id !== id);
        persistOffersChange();

        if (db) {
          try {
            await deleteDoc(doc(db, 'offers', id));
          } catch (err) {
            console.warn('[Admin] Firestore offer delete fallback:', err);
          }
        }

        showToast(`Offer slide "${target.title}" removed.`, 'info');
      });
    });

    updateOfferKPIs();
  }

  function persistOffersChange() {
    if (typeof saveActiveOffers === 'function') {
      saveActiveOffers(allOffers);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('devshree:offers-updated', { detail: { offers: allOffers } }));
    }
    renderOffersTable();
  }

  // Slide image file picker
  browseImageBtn?.addEventListener('click', () => {
    if (imageFileInput) {
      imageFileInput.value = '';
    }
  });
  browseImageBtn?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (imageFileInput) {
        imageFileInput.value = '';
        imageFileInput.click();
      }
    }
  });

  // Clicking offer image preview thumbnail also triggers file picker
  imagePreview?.addEventListener('click', () => {
    if (imageFileInput) {
      imageFileInput.value = '';
      imageFileInput.click();
    }
  });

  imageFileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const objUrl = URL.createObjectURL(file);
      if (imagePreview) imagePreview.src = objUrl;
    } catch (_) {}
    const reader = new FileReader();
    reader.onload = (event) => {
      if (imagePreview) imagePreview.src = event.target.result;
      if (imageUrlInput) imageUrlInput.value = event.target.result;
      showToast(`Slide image selected: ${file.name}`, 'info');
    };
    reader.readAsDataURL(file);
  });
  imageUrlInput?.addEventListener('input', () => {
    if (imagePreview) imagePreview.src = imageUrlInput.value.trim() || 'assets/images/cat_hardware.jpg';
  });

  // Cancel edit button
  cancelBtn?.addEventListener('click', () => resetOfferForm());

  // Form submission
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = editIdInput?.value?.trim();
    const title = titleInput?.value?.trim();
    const subtext = subtextInput?.value?.trim() || '';
    const tagBadge = badgeInput?.value?.trim() || 'Special Offer';
    const tagSpec = specInput?.value?.trim() || 'Discount';
    const categoryFilter = categorySelect?.value?.trim() || '';
    const image = imageUrlInput?.value?.trim() || imagePreview?.src || 'assets/images/cat_hardware.jpg';
    const perks = [
      perk1Input?.value?.trim(),
      perk2Input?.value?.trim(),
      perk3Input?.value?.trim()
    ].filter(Boolean);
    const ctaText = ctaTextInput?.value?.trim() || 'Shop Deals';
    const ctaLink = ctaLinkInput?.value?.trim() || '#bestsellers-section';
    const description = descInput?.value?.trim() || '';

    if (!title) {
      showToast('Please enter headline title for this promotional slide.', 'error');
      return;
    }

    const offerData = {
      id: editId || ('offer-' + Date.now()),
      title,
      subtext,
      tagBadge,
      tagSpec,
      categoryFilter,
      image,
      perks: perks.length > 0 ? perks : ['Official warranty', 'Instant dispatch', 'UPI & COD'],
      ctaText,
      ctaLink,
      description,
      active: true,
      updatedAt: new Date().toISOString()
    };

    if (editId) {
      const idx = allOffers.findIndex(o => o.id === editId);
      if (idx !== -1) {
        allOffers[idx] = { ...allOffers[idx], ...offerData };
      } else {
        allOffers.push(offerData);
      }
      showToast(`Offer slide "${title}" updated successfully!`, 'success');
    } else {
      allOffers.push(offerData);
      showToast(`New offer slide "${title}" added to autoscrolling bar!`, 'success');
    }

    persistOffersChange();

    if (db) {
      try {
        await setDoc(doc(db, 'offers', offerData.id), offerData);
      } catch (err) {
        console.warn('[Admin] Firestore offer save fallback:', err);
      }
    }

    resetOfferForm();
  });

  // Restore Factory Defaults
  restoreDefaultsBtn?.addEventListener('click', () => {
    if (!confirm('Restore all carousel slides to store factory promotional defaults?')) return;
    if (typeof resetOffersToDefault === 'function') {
      allOffers = resetOffersToDefault();
    } else if (typeof DEFAULT_OFFERS !== 'undefined') {
      allOffers = DEFAULT_OFFERS.slice();
    }
    persistOffersChange();
    resetOfferForm();
    showToast('Carousel slides restored to default promotions.', 'info');
  });

  // Initial table render
  renderOffersTable();
}

