/**
 * DEVSHREE — ORDERS & INVOICE SERVICE
 * Creates, persists, and retrieves user-specific orders and GST invoices
 * using Cloud Firestore and local fallbacks.
 */

import { 
  db, 
  isConfigured, 
  collection, 
  addDoc, 
  doc,
  getDoc,
  updateDoc,
  query, 
  where, 
  getDocs, 
  serverTimestamp 
} from './firebase-config.js';
import { getCurrentUser } from './auth.js';
import { formatINR, getStorage, setStorage, showToast, escapeHTML } from './utils.js';
import { STORE_INFO } from './mock-data.js';
import { triggerOrderNotification, isCurrentContextAdmin } from './order-notifications.js';
import { 
  openWhatsAppChat, 
  getStoreOwnerPhone, 
  buildCustomerCancellationRequestWhatsAppMessage 
} from './whatsapp-service.js';

/**
 * Generate and persist an invoice for the authenticated user
 * @param {Object} orderData
 * @returns {Promise<Object>}
 */
export async function createOrderAndInvoice(orderData) {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('User must be authenticated to generate an invoice.');
  }

  const invoiceNumber = `INV-DEV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const gstRate = 0.18; // 18% standard GST for hardware & electrical supplies
  const gstAmount = Math.round(orderData.subtotal * gstRate);

  const invoicePayload = {
    userId: user.uid,
    invoiceNumber: invoiceNumber,
    customerName: orderData.customerName || user.displayName || 'Customer',
    customerEmail: user.email,
    customerPhone: orderData.customerPhone || user.phone || '',
    shippingAddress: orderData.shippingAddress || '104 S.P. Ring Road, Ahmedabad, Gujarat',
    itemsSnapshot: orderData.items || [],
    subtotal: orderData.subtotal,
    shippingCost: orderData.shipping,
    gstAmount: gstAmount,
    total: orderData.total,
    paymentMethod: orderData.paymentMethod || 'Cash on Delivery (COD)',
    paymentStatus: orderData.paymentStatus || 'Pending',
    orderStatus: 'Confirmed',
    createdAtIso: new Date().toISOString()
  };

  if (isConfigured && db) {
    try {
      const docRef = await addDoc(collection(db, "orders"), {
        ...invoicePayload,
        createdAt: serverTimestamp()
      });
      invoicePayload.id = docRef.id;
      console.log("[Devshree] Invoice saved to Firestore with ID:", docRef.id);
    } catch (err) {
      console.error("[Devshree] Firestore invoice save error:", err);
      // Fallback to local storage if Firestore error occurs
      saveLocalInvoice(user.uid, invoicePayload);
    }
  } else {
    // Save to user-specific localStorage bucket
    saveLocalInvoice(user.uid, invoicePayload);
  }

  // Also sync to master all-orders cache for admin visibility
  saveMasterOrder(invoicePayload);

  // Trigger real-time order notification (Sound chime, Desktop notification, in-app banner, cross-tab broadcast)
  try {
    triggerOrderNotification(invoicePayload);
  } catch (notifErr) {
    console.warn('[Orders] Notification trigger error:', notifErr);
  }

  // Only display invoice creation toast if in Admin context (customer checkout has dedicated step 3 screen)
  if (isCurrentContextAdmin()) {
    showToast(`Invoice ${invoiceNumber} generated & saved successfully!`, 'success');
  }
  return invoicePayload;
}

function saveMasterOrder(invoice) {
  try {
    const masterList = getStorage('devshree_all_orders', []);
    const exists = masterList.some(o => o.invoiceNumber === invoice.invoiceNumber);
    if (!exists) {
      masterList.unshift(invoice);
      setStorage('devshree_all_orders', masterList);
    }
  } catch (e) {
    console.warn('[Orders] Failed to save to devshree_all_orders:', e);
  }
}

function saveLocalInvoice(userId, invoice) {
  const key = `devshree_invoices_${userId}`;
  const list = getStorage(key, []);
  list.unshift(invoice);
  setStorage(key, list);
}

/**
 * Fetch all stored invoices for the current user
 * @returns {Promise<Array>}
 */
export async function fetchUserInvoices() {
  const user = getCurrentUser();
  if (!user) return [];

  let list = [];
  if (isConfigured && db) {
    try {
      const q = query(
        collection(db, "orders"),
        where("userId", "==", user.uid)
      );
      const snapshot = await Promise.race([
        getDocs(q),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 2500))
      ]);
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
    } catch (err) {
      console.warn("[Devshree] Error reading Firestore invoices, checking local storage:", err);
    }
  }

  if (list.length === 0) {
    const userLocal = getStorage(`devshree_invoices_${user.uid}`, []);
    if (userLocal && userLocal.length > 0) {
      list = userLocal;
    } else {
      const allOrders = getStorage('devshree_all_orders', []);
      const matched = allOrders.filter(o => 
        o.userId === user.uid || 
        (user.email && (o.customerEmail === user.email || o.email === user.email || o.shippingAddress?.email === user.email)) ||
        (user.isAdmin && allOrders.length > 0)
      );
      if (matched.length > 0) {
        list = matched;
      }
    }
  }

  list.sort((a, b) => new Date(b.createdAtIso || 0) - new Date(a.createdAtIso || 0));
  return list;
}

/**
 * Render and Open "My Invoices & Orders" Modal
 */
export async function openUserInvoicesModal() {
  const user = getCurrentUser();
  if (!user) {
    showToast('Please sign in to view your invoices.', 'info');
    return;
  }

  const modal = document.getElementById('invoices-list-modal');
  const container = document.getElementById('invoices-list-container');
  if (!modal || !container) return;

  container.innerHTML = `
    <div style="text-align:center;padding:2rem;color:var(--color-text-secondary);">
      <p>Loading your invoices from database...</p>
    </div>
  `;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  const invoices = await fetchUserInvoices();

  if (invoices.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:3rem 1rem;color:var(--color-text-secondary);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 1rem;color:#CBD5E1;">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
        </svg>
        <h4 style="font-size:1.15rem;color:var(--color-navy);margin-bottom:0.5rem;">No Invoices Found Yet</h4>
        <p style="font-size:0.9rem;margin-bottom:1.25rem;">You haven't placed any orders under <strong>${escapeHTML(user.email)}</strong>.</p>
        <a href="#bestsellers-section" class="btn btn-primary btn-sm" id="invoices-browse-btn">Shop Supplies</a>
      </div>
    `;
    container.querySelector('#invoices-browse-btn')?.addEventListener('click', () => {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    });
    return;
  }

  container.innerHTML = invoices.map(inv => {
    const status = (inv.orderStatus || 'Confirmed').toLowerCase();
    let statusClass = 'status-confirmed';
    if (status.includes('cancel')) statusClass = 'status-cancelled';
    else if (status.includes('process')) statusClass = 'status-processing';
    else if (status.includes('dispatch') || status.includes('shipped') || status.includes('transit')) statusClass = 'status-dispatched';
    else if (status.includes('out')) statusClass = 'status-out';
    else if (status.includes('deliver')) statusClass = 'status-delivered';

    const items = inv.itemsSnapshot || [];
    const totalItems = items.reduce((sum, i) => sum + (i.quantity || 1), 0);

    return `
      <div class="order-invoice-card" data-invoice-num="${escapeHTML(inv.invoiceNumber)}">
        <div class="order-invoice-card-header">
          <div class="order-invoice-id-block">
            <div class="order-invoice-tag">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              <span class="order-invoice-number">${escapeHTML(inv.invoiceNumber)}</span>
              <button type="button" class="btn-copy-invoice" data-copy="${escapeHTML(inv.invoiceNumber)}" title="Copy Invoice Number">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
            <div class="order-invoice-date">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <span>${new Date(inv.createdAtIso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
          <div class="order-status-pill ${statusClass}">
            <span class="status-pulse-dot"></span>
            <span>${escapeHTML(inv.orderStatus || 'Confirmed')}</span>
          </div>
        </div>

        <div class="order-invoice-card-items">
          ${items.map(item => `
            <div class="order-item-chip">
              <span class="order-item-qty">${item.quantity || 1}x</span>
              <span class="order-item-name">${escapeHTML(item.name || item.productSnapshot?.name || 'Supply Item')}</span>
              <span class="order-item-price">${formatINR((item.price || 0) * (item.quantity || 1))}</span>
            </div>
          `).join('')}
        </div>

        <div class="order-invoice-card-footer">
          <div class="order-total-block">
            <span class="order-total-label">Total Amount (${totalItems} ${totalItems === 1 ? 'item' : 'items'} &bull; incl. 18% GST)</span>
            <strong class="order-total-value">${formatINR(inv.total)}</strong>
          </div>
          <div class="order-card-actions">
            <button type="button" class="btn btn-primary btn-sm btn-order-track" data-track-invoice-id="${inv.invoiceNumber}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="1" y="3" width="15" height="13"></rect>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                <circle cx="18.5" cy="18.5" r="2.5"></circle>
              </svg>
              Track Live Shipment
            </button>
            <button type="button" class="btn btn-outline btn-sm btn-order-invoice" data-view-invoice-id="${inv.invoiceNumber}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              View Official GST Bill
            </button>
            ${!status.includes('cancel') && !status.includes('deliver') ? `
              <button type="button" class="btn btn-outline btn-sm btn-order-cancel" data-cancel-invoice-id="${inv.invoiceNumber}" style="color:#DC2626;border-color:#FCA5A5;font-weight:600;" title="Cancel this order">
                Cancel Order 🚫
              </button>
            ` : ''}
            <button type="button" class="btn btn-outline btn-sm btn-order-wa" data-wa-invoice-id="${inv.invoiceNumber}" style="color:#166534;border-color:#86EFAC;font-weight:600;" title="Help on WhatsApp">
              💬 WhatsApp
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Bind Copy Buttons
  container.querySelectorAll('.btn-copy-invoice').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const code = btn.dataset.copy;
      if (code) {
        navigator.clipboard?.writeText(code).then(() => {
          showToast(`Copied ${code} to clipboard`, 'success');
        }).catch(() => {
          showToast(code, 'info');
        });
      }
    });
  });

  // Bind View Invoice Click
  container.querySelectorAll('[data-view-invoice-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const invNum = btn.dataset.viewInvoiceId;
      const targetInv = invoices.find(i => i.invoiceNumber === invNum);
      if (targetInv) {
        openInvoiceViewer(targetInv);
      }
    });
  });

  // Bind Track Order Click
  container.querySelectorAll('[data-track-invoice-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const invNum = btn.dataset.trackInvoiceId;
      modal.classList.remove('active');
      document.body.style.overflow = '';
      openOrderTrackingModal(invNum);
    });
  });

  // Bind Customer Cancel Order Click
  container.querySelectorAll('[data-cancel-invoice-id]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const invNum = btn.dataset.cancelInvoiceId;
      const targetInv = invoices.find(i => i.invoiceNumber === invNum);
      if (!confirm(`Are you sure you want to cancel order ${invNum}?\n\nIf you have already paid via UPI or Card, a full refund will be processed immediately.`)) {
        return;
      }
      try {
        btn.disabled = true;
        btn.textContent = 'Cancelling...';
        await cancelOrder(invNum, 'Customer requested cancellation via portal', 'Customer');
        showToast(`Order ${invNum} has been cancelled successfully.`, 'success');

        // Refresh user invoices view
        await openUserInvoicesModal();

        // Prompt to notify WhatsApp trade desk
        const ownerPhone = getStoreOwnerPhone();
        const msg = buildCustomerCancellationRequestWhatsAppMessage(targetInv || { invoiceNumber: invNum });
        openWhatsAppChat(ownerPhone, msg);
      } catch (err) {
        console.error('[Orders] Error cancelling customer order:', err);
        showToast('Unable to cancel order. Please contact support.', 'error');
        btn.disabled = false;
        btn.textContent = 'Cancel Order 🚫';
      }
    });
  });

  // Bind Customer WhatsApp Help Click
  container.querySelectorAll('[data-wa-invoice-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const invNum = btn.dataset.waInvoiceId;
      const ownerPhone = getStoreOwnerPhone();
      const msg = `Hello Devshree Hardware, I need support regarding my order: ${invNum}.`;
      openWhatsAppChat(ownerPhone, msg);
    });
  });
}

/**
 * Render authentic Flipkart-style Tax Invoice modal viewer with Devshree Logo
 * @param {Object} invoice
 */
export function openInvoiceViewer(invoice) {
  let modal = document.getElementById('tax-invoice-modal');
  let body = document.getElementById('tax-invoice-content');

  if (!modal) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.id = 'tax-invoice-modal';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.innerHTML = `
      <div class="modal-content tax-invoice-modal-box">
        <button type="button" class="modal-close-btn" id="tax-invoice-close-btn" aria-label="Close dialog">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div class="tax-invoice-body" id="tax-invoice-content"></div>
      </div>
    `;
    document.body.appendChild(wrap);
    modal = wrap;
    body = modal.querySelector('#tax-invoice-content');

    modal.querySelector('#tax-invoice-close-btn')?.addEventListener('click', () => {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  }

  if (!modal || !body) return;

  function formatBillDate(d) {
    if (!d) return new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
      const day = String(dt.getDate()).padStart(2, '0');
      const month = String(dt.getMonth() + 1).padStart(2, '0');
      const year = dt.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (_) {
      return '18-04-2026';
    }
  }

  const orderDateStr = formatBillDate(invoice.createdAtIso || invoice.createdAt || invoice.orderDate);
  const orderId = invoice.orderId || (invoice.invoiceNumber ? invoice.invoiceNumber.replace(/^INV-DEV-/, 'OD304') : ('OD' + Math.floor(100000000000 + Math.random() * 900000000000)));
  const invoiceNo = invoice.invoiceNumber || ('DEL' + Math.floor(10000000000000 + Math.random() * 90000000000000));

  let addressLine1 = '';
  let addressLine2 = '';
  let cityStatePin = '';

  if (typeof invoice.shippingAddress === 'string') {
    addressLine1 = invoice.shippingAddress;
    cityStatePin = 'Rajkot 360006 Gujarat';
  } else if (invoice.shippingAddress && typeof invoice.shippingAddress === 'object') {
    addressLine1 = [invoice.shippingAddress.flat, invoice.shippingAddress.street, invoice.shippingAddress.address].filter(Boolean).join(', ') || 'Jamnagar Road';
    addressLine2 = invoice.shippingAddress.landmark || '';
    const city = invoice.shippingAddress.city || 'Rajkot';
    const state = invoice.shippingAddress.state || 'Gujarat';
    const pin = invoice.shippingAddress.pincode || '360006';
    cityStatePin = `${city} ${pin} ${state}`;
  } else {
    addressLine1 = '104 S.P. Ring Road';
    cityStatePin = 'Rajkot 360006 Gujarat';
  }

  const customerName = invoice.customerName || 'Customer';
  const customerPhone = invoice.customerPhone || invoice.phone || '09990918218';

  const rawItems = invoice.itemsSnapshot || invoice.items || [];
  const items = rawItems.length > 0 ? rawItems : [
    {
      name: 'Hardware Supplies (Industrial Grade)',
      category: 'Hardware',
      sku: 'ACCCRHTQYUCWT4PY',
      hsn: 'W02987',
      quantity: 1,
      price: invoice.total || 370
    }
  ];

  let totalQty = 0;
  let totalTaxable = 0;
  let totalTax = 0;
  let totalProductsAmount = 0;

  const itemsRowsHtml = items.map(item => {
    const qty = Number(item.quantity) || 1;
    totalQty += qty;

    const name = item.name || item.productSnapshot?.name || 'Supply Item';
    const rawPrice = Number(item.price || item.productSnapshot?.price) || 0;
    const itemTotal = rawPrice * qty;
    totalProductsAmount += itemTotal;

    const gstRate = Number(item.gstRate || item.productSnapshot?.gstRate) || 18;
    const baseUnitPrice = rawPrice / (1 + (gstRate / 100));
    const baseRowTotal = baseUnitPrice * qty;
    const taxRowTotal = itemTotal - baseRowTotal;

    totalTaxable += baseRowTotal;
    totalTax += taxRowTotal;

    const category = (item.category || item.categoryId || item.productSnapshot?.category || 'Hardware Supplies').replace(/^cat-/, '');
    const sku = item.sku || item.code || item.id || ('ACCC' + Math.floor(1000 + Math.random() * 9000));
    const hsn = item.hsn || (category.toLowerCase().includes('elec') ? '8539' : category.toLowerCase().includes('plumb') ? '8481' : category.toLowerCase().includes('paint') ? '3209' : 'W02987');

    return `
      <tr>
        <td class="flipkart-td-product">
          <div class="product-category">${escapeHTML(category)}</div>
          <div class="product-code"><span class="code-label">FSN:</span> ${escapeHTML(sku)}</div>
          <div class="product-code"><span class="code-label">WID:</span> ${escapeHTML(hsn)}</div>
        </td>
        <td class="flipkart-td-title">
          <div class="item-title-text">${escapeHTML(name)}</div>
          <div class="item-tax-spec">${gstRate.toFixed(2)}% Gujarat intra-state GST</div>
        </td>
        <td class="flipkart-td-qty">${qty}</td>
        <td class="flipkart-td-num">${baseUnitPrice.toFixed(2)}</td>
        <td class="flipkart-td-num">${taxRowTotal.toFixed(2)}</td>
        <td class="flipkart-td-num">${itemTotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  // Shipping
  const shippingTotal = Number(invoice.shippingCost != null ? invoice.shippingCost : (items.length > 0 && invoice.total ? (invoice.total - totalProductsAmount) : 0)) || 0;
  const shippingBase = shippingTotal > 0 ? (shippingTotal / 1.18) : 0;
  const shippingTax = shippingTotal - shippingBase;

  totalTaxable += shippingBase;
  totalTax += shippingTax;

  const grandTotal = Number(invoice.total) || (totalProductsAmount + shippingTotal);

  body.innerHTML = `
    <div class="flipkart-invoice-paper" id="printable-tax-invoice">
      <!-- Top Header Row: Logo & Contact on Left, Tax Invoice Badge on Right -->
      <div class="flipkart-invoice-header">
        <div class="flipkart-invoice-brand-col">
          <div class="flipkart-invoice-logo-row">
            <img src="assets/images/devshree-bill-logo.png" alt="Devshree - The Hardware Gallery" class="flipkart-invoice-logo" />
            <span class="flipkart-invoice-contact">
              Contact us: 1800 420 1111 || support@devshree.in
            </span>
          </div>
          <div class="flipkart-invoice-seller-line">
            <u>${STORE_INFO.name || 'Devshree - The Hardware Gallery'}</u>, <span class="warehouse-tag">Warehouse Address: ${STORE_INFO.address || 'Jamnagar Road, Opp. Reliance Petrol Pump, Rajkot, Gujarat, India - 360006'}</span>
          </div>
        </div>

        <div class="flipkart-invoice-badge">
          Tax Invoice # ${escapeHTML(invoiceNo)}
        </div>
      </div>

      <!-- Solid Dividing Rule -->
      <div class="flipkart-invoice-hr-thick"></div>

      <!-- 3-Column Metadata Grid -->
      <div class="flipkart-invoice-meta-grid">
        <!-- Col 1: Order & Invoice IDs -->
        <div class="flipkart-invoice-meta-col">
          <div class="meta-field-row"><strong>Order ID:</strong> ${escapeHTML(orderId)}</div>
          <div class="meta-field-row"><strong>Order Date:</strong> ${orderDateStr}</div>
          <div class="meta-field-row"><strong>Invoice No:</strong> ${escapeHTML(invoiceNo)}</div>
          <div class="meta-field-row"><strong>Invoice Date:</strong> ${orderDateStr}</div>
          <div class="meta-field-row"><strong>VAT/TIN:</strong> ${STORE_INFO.gstin || '07810387105'}</div>
        </div>

        <!-- Col 2: Billing Address -->
        <div class="flipkart-invoice-meta-col">
          <div class="meta-col-title">Billing Address</div>
          <div class="meta-address-name"><strong>${escapeHTML(customerName)}</strong></div>
          <div class="meta-address-line">${escapeHTML(addressLine1)}</div>
          ${addressLine2 ? `<div class="meta-address-line">${escapeHTML(addressLine2)}</div>` : ''}
          <div class="meta-address-line">${escapeHTML(cityStatePin)}</div>
          <div class="meta-field-row" style="margin-top:4px;">Phone: ${escapeHTML(customerPhone)}</div>
        </div>

        <!-- Col 3: Shipping Address -->
        <div class="flipkart-invoice-meta-col">
          <div class="meta-col-title">Shipping Address</div>
          <div class="meta-address-name"><em>${escapeHTML(customerName)}</em></div>
          <div class="meta-address-line">${escapeHTML(addressLine1)}</div>
          ${addressLine2 ? `<div class="meta-address-line">${escapeHTML(addressLine2)}</div>` : ''}
          <div class="meta-address-line">${escapeHTML(cityStatePin)}</div>
          <div class="meta-field-row" style="margin-top:4px;">Phone: ${escapeHTML(customerPhone)}</div>
          <div class="warranty-note">*Keep this invoice for warranty purposes.*</div>
        </div>
      </div>

      <!-- Solid Dividing Rule Before Items Table -->
      <div class="flipkart-invoice-hr-thick"></div>

      <!-- Items Table -->
      <table class="flipkart-invoice-table">
        <thead>
          <tr>
            <th style="width: 20%; text-align: left;">Product</th>
            <th style="width: 40%; text-align: left;">Title</th>
            <th style="width: 8%; text-align: center;">Qty</th>
            <th style="width: 10%; text-align: right;">Price (₹)</th>
            <th style="width: 10%; text-align: right;">Tax (₹)</th>
            <th style="width: 12%; text-align: right;">Total (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRowsHtml}
          <!-- Shipping Charges Row -->
          <tr class="flipkart-shipping-row">
            <td colspan="3" style="text-align: right; font-weight: 500; padding-right: 1.5rem;">Shipping Charges</td>
            <td class="flipkart-td-num">${shippingBase.toFixed(2)}</td>
            <td class="flipkart-td-num">${shippingTax.toFixed(2)}</td>
            <td class="flipkart-td-num">${shippingTotal.toFixed(2)}</td>
          </tr>
          <!-- Subtotal Summary Line -->
          <tr class="flipkart-total-row">
            <td colspan="2" style="text-align: right; font-weight: 700; font-size: 0.95rem; padding-right: 1.5rem;">Total</td>
            <td style="text-align: center; font-weight: 700; font-size: 0.95rem;">${totalQty}</td>
            <td class="flipkart-td-num" style="font-weight: 700; font-size: 0.95rem;">${totalTaxable.toFixed(2)}</td>
            <td class="flipkart-td-num" style="font-weight: 700; font-size: 0.95rem;">${totalTax.toFixed(2)}</td>
            <td class="flipkart-td-num" style="font-weight: 700; font-size: 0.95rem;">${grandTotal.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <!-- Grand Total Block -->
      <div class="flipkart-grand-total-row">
        <span class="gt-label">Grand Total</span>
        <span class="gt-symbol">₹</span>
        <span class="gt-amount">${grandTotal.toFixed(2)}</span>
      </div>

      <!-- Footer Disclaimer -->
      <div class="flipkart-invoice-hr-thin"></div>
      <div class="flipkart-invoice-footer-note">
        This is a computer generated invoice. No signature required.
      </div>
    </div>

    <!-- Modal Actions Bar -->
    <div class="flipkart-invoice-actions no-print">
      <button type="button" class="btn btn-primary btn-sm" id="print-invoice-btn">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 6 2 18 2 18 9"></polyline>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
          <rect x="6" y="14" width="12" height="8"></rect>
        </svg>
        Print / Save PDF
      </button>
      <button type="button" class="btn btn-outline btn-sm" id="copy-invoice-link-btn" data-inv="${escapeHTML(invoiceNo)}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        Copy Invoice #
      </button>
      <button type="button" class="btn btn-secondary btn-sm" id="close-invoice-viewer-btn">
        Close
      </button>
    </div>
  `;

  document.getElementById('print-invoice-btn')?.addEventListener('click', () => {
    window.print();
  });

  document.getElementById('copy-invoice-link-btn')?.addEventListener('click', () => {
    const inv = invoiceNo;
    if (inv) {
      navigator.clipboard?.writeText(inv).then(() => {
        showToast(`Copied ${inv} to clipboard`, 'success');
      }).catch(() => {
        showToast(inv, 'info');
      });
    }
  });

  document.getElementById('close-invoice-viewer-btn')?.addEventListener('click', () => {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  });

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

/**
 * Lookup an order by Firestore doc ID or Invoice Number (e.g. INV-DEV-...)
 * @param {string} identifier
 * @returns {Promise<Object|null>}
 */
export async function fetchOrderById(identifier) {
  if (!identifier) return null;
  const cleanId = identifier.trim();

  if (isConfigured && db) {
    try {
      // 1. Try finding by invoiceNumber
      const q = query(collection(db, "orders"), where("invoiceNumber", "==", cleanId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        return { id: d.id, ...d.data() };
      }

      // 2. Try direct doc ID
      try {
        const docRef = doc(db, "orders", cleanId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() };
        }
      } catch (_) {}
    } catch (err) {
      console.warn("[Devshree] Error searching Firestore order:", err);
    }
  }

  // Fallback: search across all local storage buckets
  const user = getCurrentUser();
  if (user) {
    const list = getStorage(`devshree_invoices_${user.uid}`, []);
    const match = list.find(i => i.invoiceNumber === cleanId || i.id === cleanId);
    if (match) return match;
  }
  return null;
}

/**
 * Fetch all orders across all customers (for Admin Dashboard)
 * @returns {Promise<Array>}
 */
export async function fetchAllOrders() {
  if (isConfigured && db) {
    try {
      const snap = await getDocs(collection(db, "orders"));
      const orders = [];
      snap.forEach(d => orders.push({ id: d.id, ...d.data() }));
      orders.sort((a, b) => new Date(b.createdAtIso || 0) - new Date(a.createdAtIso || 0));
      if (orders.length > 0) return orders;
    } catch (err) {
      console.warn("[Devshree] Error reading all orders from Firestore:", err);
    }
  }

  // Master local order list fallback
  const masterOrders = getStorage('devshree_all_orders', []);
  if (masterOrders.length > 0) return masterOrders;

  const user = getCurrentUser();
  if (user) {
    return getStorage(`devshree_invoices_${user.uid}`, []);
  }
  return [];
}

/**
 * Update an order's fulfillment status
/**
 * Update order status across Firestore and Local Storage
 * @param {string} orderId
 * @param {string} newStatus
 * @param {Object} [extraData]
 * @returns {Promise<boolean>}
 */
export async function updateOrderStatus(orderId, newStatus, extraData = {}) {
  // 1. Sync to master local orders
  const masterOrders = getStorage('devshree_all_orders', []);
  const idx = masterOrders.findIndex(o => (orderId && o.id === orderId) || (orderId && o.invoiceNumber === orderId));
  let targetUserId = null;
  if (idx !== -1) {
    masterOrders[idx].orderStatus = newStatus;
    Object.assign(masterOrders[idx], extraData);
    setStorage('devshree_all_orders', masterOrders);
    targetUserId = masterOrders[idx].userId;
  }

  // 2. Sync to user-specific order history (both current user and order creator)
  const user = getCurrentUser();
  const uidsToSync = new Set();
  if (user?.uid) uidsToSync.add(user.uid);
  if (targetUserId) uidsToSync.add(targetUserId);

  for (const uid of uidsToSync) {
    const key = `devshree_invoices_${uid}`;
    const userInvoices = getStorage(key, []);
    const uIdx = userInvoices.findIndex(o => (orderId && o.id === orderId) || (orderId && o.invoiceNumber === orderId));
    if (uIdx !== -1) {
      userInvoices[uIdx].orderStatus = newStatus;
      Object.assign(userInvoices[uIdx], extraData);
      setStorage(key, userInvoices);
    }
  }

  // 3. Sync to Cloud Firestore if connected
  if (isConfigured && db && orderId) {
    try {
      const docRef = doc(db, "orders", orderId);
      await updateDoc(docRef, { orderStatus: newStatus, ...extraData, updatedAt: serverTimestamp() });
      return true;
    } catch (err) {
      // If doc not found directly by doc ID, query by invoiceNumber
      try {
        const q = query(collection(db, "orders"), where("invoiceNumber", "==", orderId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const matchedDoc = snap.docs[0];
          await updateDoc(matchedDoc.ref, { orderStatus: newStatus, ...extraData, updatedAt: serverTimestamp() });
          return true;
        }
      } catch (qErr) {
        console.warn("[Devshree] Error updating order status in Firestore by invoiceNumber:", qErr);
      }
    }
  }
  return true;
}

/**
 * Cancel an order (Admin or Customer cancellation)
 * @param {string} orderId
 * @param {string} [reason]
 * @param {string} [cancelledBy]
 * @returns {Promise<boolean>}
 */
export async function cancelOrder(orderId, reason = 'Cancelled by customer', cancelledBy = 'Customer') {
  const extra = {
    cancelledAt: new Date().toISOString(),
    cancellationReason: reason,
    cancelledBy: cancelledBy
  };
  return await updateOrderStatus(orderId, 'Cancelled', extra);
}

/**
 * Open and render the Live Order Tracking Modal
 * @param {string} [initialOrderId] Optional ID to immediately lookup
 */
export async function openOrderTrackingModal(initialOrderId = '') {
  const modal = document.getElementById('track-order-modal');
  const body = document.getElementById('track-order-body');
  if (!modal || !body) return;

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  if (initialOrderId) {
    await renderTrackingResults(initialOrderId);
  } else {
    renderTrackingSearchPrompt();
  }
}

/**
 * Render Search Box for Order Tracking
 */
function renderTrackingSearchPrompt() {
  const body = document.getElementById('track-order-body');
  if (!body) return;

  body.innerHTML = `
    <div class="tracking-search-box">
      <div class="tracking-icon-circle">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="1" y="3" width="15" height="13"></rect>
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
          <circle cx="5.5" cy="18.5" r="2.5"></circle>
          <circle cx="18.5" cy="18.5" r="2.5"></circle>
        </svg>
      </div>
      <h3 style="font-size:1.35rem;color:var(--color-navy);font-weight:800;margin-bottom:0.35rem;">Track Your Consignment</h3>
      <p style="color:var(--color-text-secondary);font-size:0.9rem;margin-bottom:1.5rem;max-width:440px;margin-left:auto;margin-right:auto;">
        Enter your Invoice Number (e.g. <strong>INV-DEV-2026-XXXX</strong>) to view real-time logistics status and estimated arrival.
      </p>

      <form id="track-order-form" style="max-width:420px;margin:0 auto;display:flex;gap:0.5rem;">
        <input type="text" id="track-order-input" class="form-control" placeholder="Enter INV-DEV-... or Order ID" required style="font-family:var(--font-mono);font-size:0.9rem;" />
        <button type="submit" class="btn btn-primary" style="white-space:nowrap;padding:0 1.25rem;">
          Track
        </button>
      </form>
    </div>
  `;

  document.getElementById('track-order-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('track-order-input')?.value.trim();
    if (id) {
      await renderTrackingResults(id);
    }
  });
}

/**
 * Render Live Tracking Progress Stepper for a matched order
 */
async function renderTrackingResults(orderId) {
  const body = document.getElementById('track-order-body');
  if (!body) return;

  body.innerHTML = `
    <div style="text-align:center;padding:3rem 1rem;color:var(--color-text-secondary);">
      <p>Locating shipment details from database...</p>
    </div>
  `;

  const order = await fetchOrderById(orderId);

  if (!order) {
    body.innerHTML = `
      <div style="text-align:center;padding:3rem 1.5rem;">
        <div style="width:54px;height:54px;border-radius:50%;background:#FEE2E2;color:#DC2626;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <h4 style="font-size:1.15rem;color:var(--color-navy);margin-bottom:0.5rem;">Shipment Not Found</h4>
        <p style="font-size:0.9rem;color:var(--color-text-secondary);margin-bottom:1.5rem;max-width:400px;margin-left:auto;margin-right:auto;">
          We couldn't locate any order matching "<strong>${escapeHTML(orderId)}</strong>". Please verify your invoice number and try again.
        </p>
        <button type="button" class="btn btn-outline btn-sm" id="track-retry-btn">Try Another Number</button>
      </div>
    `;
    document.getElementById('track-retry-btn')?.addEventListener('click', renderTrackingSearchPrompt);
    return;
  }

  // Determine active step index: Confirmed (1), Processing (2), Dispatched (3), Out for Delivery (4), Delivered (5)
  const status = (order.orderStatus || 'Confirmed').toLowerCase();
  const isCancelled = status.includes('cancel');
  let activeStep = 1;
  let statusClass = 'confirmed';
  let progressPercent = 20;

  if (isCancelled) {
    activeStep = 0;
    statusClass = 'cancelled';
    progressPercent = 0;
  } else if (status.includes('process')) {
    activeStep = 2;
    statusClass = 'processing';
    progressPercent = 45;
  } else if (status.includes('dispatch') || status.includes('transit') || status.includes('shipped')) {
    activeStep = 3;
    statusClass = 'dispatched';
    progressPercent = 70;
  } else if (status.includes('out')) {
    activeStep = 4;
    statusClass = 'out';
    progressPercent = 90;
  } else if (status.includes('deliver')) {
    activeStep = 5;
    statusClass = 'delivered';
    progressPercent = 100;
  }

  const orderDate = new Date(order.createdAtIso || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const steps = [
    { num: 1, label: 'Order Confirmed', sub: 'GST Tax Invoice Generated & Verified', icon: '📝', time: `${orderDate} &bull; Recorded` },
    { num: 2, label: 'Warehouse Processing', sub: 'Packed & Barcode Scanned at Rajkot Hub', icon: '📦', time: activeStep >= 2 ? 'Completed' : 'Pending' },
    { num: 3, label: 'Handed to Logistics', sub: `${escapeHTML(order.courierPartner || 'Delhivery Express Surface')} &bull; In Transit`, icon: '🚚', time: activeStep >= 3 ? 'In Surface Transit' : 'Pending dispatch' },
    { num: 4, label: 'Out for Delivery', sub: 'Dispatched from Nearest Distribution Centre', icon: '🛵', time: activeStep >= 4 ? 'Courier on way' : 'Upcoming' },
    { num: 5, label: 'Consignment Delivered', sub: 'Safely Handed over at Site', icon: '✅', time: activeStep >= 5 ? 'Delivered' : 'Awaiting Arrival' }
  ];

  const totalQty = (order.itemsSnapshot || []).reduce((sum, i) => sum + (i.quantity || 1), 0);

  body.innerHTML = `
    <div class="tracking-redesign-pane">
      <!-- Top Tracking Hero Banner -->
      <div class="tracking-hero-banner">
        <div class="tracking-hero-info">
          <div class="tracking-hero-badge">
            <span class="tracking-pulse-dot"></span>
            <span>LIVE CONSIGNMENT TRACKING</span>
          </div>
          <h3 class="tracking-hero-inv">${escapeHTML(order.invoiceNumber || order.id)}</h3>
          <div class="tracking-hero-meta">
            <span class="courier-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="1" y="3" width="15" height="13"></rect>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                <circle cx="18.5" cy="18.5" r="2.5"></circle>
              </svg>
              ${escapeHTML(order.courierPartner || 'Delhivery Express Surface')}
            </span>
            <span class="awb-pill">AWB: <strong>${escapeHTML(order.trackingNumber || 'DLV-DEV-849201')}</strong></span>
            <button type="button" class="btn-copy-awb" data-copy-awb="${escapeHTML(order.trackingNumber || 'DLV-DEV-849201')}" title="Copy AWB Tracking Number">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
        </div>

        <div class="tracking-hero-status-box">
          <span class="tracking-status-pill status-${statusClass}">${escapeHTML(order.orderStatus || 'Confirmed')}</span>
          <div class="tracking-eta-box">
            <span class="eta-label">Estimated Arrival:</span>
            <strong class="eta-value">${isCancelled ? 'Order Cancelled' : escapeHTML(order.estimatedDeliveryDate || 'Within 2-3 Business Days')}</strong>
          </div>
        </div>
      </div>

      ${isCancelled ? `
        <div style="background:#FEF2F2;border:1.5px solid #FCA5A5;border-radius:10px;padding:1rem 1.25rem;margin:1.25rem 0;color:#991B1B;display:flex;align-items:center;gap:0.85rem;">
          <div style="font-size:1.8rem;line-height:1;">🚫</div>
          <div>
            <div style="font-weight:800;font-size:1rem;color:#7F1D1D;">Order Cancelled</div>
            <div style="font-size:0.85rem;color:#991B1B;margin-top:2px;">Reason: ${escapeHTML(order.cancellationReason || 'Cancelled by store administrator')}</div>
          </div>
        </div>
      ` : ''}

      <!-- Overall Visual Progress Bar -->
      <div class="tracking-progress-section">
        <div class="progress-labels-row">
          <span>Journey Progress</span>
          <strong>${progressPercent}% Completed</strong>
        </div>
        <div class="tracking-progress-bar-wrap">
          <div class="tracking-progress-bar-fill" style="width: ${progressPercent}%;"></div>
        </div>
      </div>

      <!-- 5-Step Visual Stepper -->
      <div class="tracking-stepper-flow">
        ${steps.map((st, i) => {
          const isDone = st.num <= activeStep;
          const isCurrent = st.num === activeStep;
          return `
            <div class="tracking-step-card ${isDone ? 'completed' : ''} ${isCurrent ? 'active-step' : ''}">
              <div class="step-indicator-col">
                <div class="step-circle">
                  ${isDone && !isCurrent ? `
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ` : `
                    <span class="step-icon-symbol">${st.icon}</span>
                  `}
                </div>
                ${i < steps.length - 1 ? `<div class="step-connector-line ${st.num < activeStep ? 'completed-line' : ''}"></div>` : ''}
              </div>
              <div class="step-content-col">
                <div class="step-title-row">
                  <h5 class="step-title">${st.label}</h5>
                  ${isCurrent ? `<span class="step-live-pill">CURRENT STAGE</span>` : ''}
                </div>
                <p class="step-desc">${st.sub}</p>
                <span class="step-timestamp">${st.time}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Consignee & Order Overview Grid -->
      <div class="tracking-details-grid">
        <div class="tracking-info-card">
          <div class="tracking-card-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span>Delivery Destination &amp; Consignee</span>
          </div>
          <div class="tracking-card-body">
            <h4 class="recipient-name">${escapeHTML(order.customerName || 'Customer')}</h4>
            <p class="recipient-address">${escapeHTML(order.shippingAddress || '')}</p>
            ${order.customerPhone ? `
              <div class="recipient-contact">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
                <span>${escapeHTML(order.customerPhone)}</span>
              </div>
            ` : ''}
          </div>
        </div>

        <div class="tracking-info-card">
          <div class="tracking-card-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
            </svg>
            <span>Package Summary (${totalQty} ${totalQty === 1 ? 'Unit' : 'Units'})</span>
          </div>
          <div class="tracking-card-body">
            <div class="tracking-items-scroll">
              ${(order.itemsSnapshot || []).map(item => `
                <div class="tracking-item-row">
                  <span class="tracking-item-qty">${item.quantity || 1}x</span>
                  <span class="tracking-item-name">${escapeHTML(item.name || item.productSnapshot?.name || 'Hardware Supply')}</span>
                  <span class="tracking-item-val">${formatINR((item.price || item.productSnapshot?.price || 0) * (item.quantity || 1))}</span>
                </div>
              `).join('')}
            </div>
            <div class="tracking-total-divider">
              <span>Total Bill (incl. GST):</span>
              <strong>${formatINR(order.total || 0)}</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Action Bar -->
      <div class="tracking-bottom-actions">
        <button type="button" class="btn btn-outline" id="tracking-search-again-btn">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Track Another Order
        </button>
        <button type="button" class="btn btn-primary" id="tracking-view-invoice-btn">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          View Official GST Tax Bill
        </button>
        ${!isCancelled && !status.includes('deliver') ? `
          <button type="button" class="btn btn-outline" id="tracking-cancel-order-btn" style="color:#DC2626;border-color:#FCA5A5;font-weight:600;">
            Cancel Order 🚫
          </button>
        ` : ''}
        <button type="button" class="btn btn-outline" id="tracking-wa-support-btn" style="color:#166534;border-color:#86EFAC;font-weight:600;">
          💬 WhatsApp Support
        </button>
      </div>
    </div>
  `;

  // Bind AWB copy button
  body.querySelectorAll('.btn-copy-awb').forEach(btn => {
    btn.addEventListener('click', () => {
      const awb = btn.dataset.copyAwb;
      if (awb) {
        navigator.clipboard?.writeText(awb).then(() => {
          showToast(`Copied AWB ${awb} to clipboard`, 'success');
        }).catch(() => {
          showToast(awb, 'info');
        });
      }
    });
  });

  document.getElementById('tracking-search-again-btn')?.addEventListener('click', renderTrackingSearchPrompt);
  document.getElementById('tracking-view-invoice-btn')?.addEventListener('click', () => {
    document.getElementById('track-order-modal')?.classList.remove('active');
    document.body.style.overflow = '';
    openInvoiceViewer(order);
  });

  // Bind Cancel Order button in Tracking View
  document.getElementById('tracking-cancel-order-btn')?.addEventListener('click', async () => {
    const invNum = order.invoiceNumber || order.id;
    if (!confirm(`Are you sure you want to cancel order ${invNum}?\n\nIf you have already paid via UPI or Card, a full refund will be processed immediately.`)) {
      return;
    }
    try {
      await cancelOrder(invNum, 'Customer requested cancellation via Tracking', 'Customer');
      order.orderStatus = 'Cancelled';
      order.cancellationReason = 'Customer requested cancellation via Tracking';
      showToast(`Order ${invNum} has been cancelled successfully.`, 'success');
      renderTrackingResults(order);

      const ownerPhone = getStoreOwnerPhone();
      const msg = buildCustomerCancellationRequestWhatsAppMessage(order);
      openWhatsAppChat(ownerPhone, msg);
    } catch (err) {
      console.error('[Tracking] Cancel error:', err);
      showToast('Unable to cancel order. Please try again.', 'error');
    }
  });

  // Bind WhatsApp Support button in Tracking View
  document.getElementById('tracking-wa-support-btn')?.addEventListener('click', () => {
    const invNum = order.invoiceNumber || order.id;
    const ownerPhone = getStoreOwnerPhone();
    const msg = `Hello Devshree Hardware, I have a tracking query regarding order: ${invNum}.`;
    openWhatsAppChat(ownerPhone, msg);
  });
}
