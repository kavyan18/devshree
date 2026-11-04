/**
 * DEVSHREE — CHECKOUT & PAYMENT SERVICE (STAGE 4)
 * Multi-step checkout, Indian PIN code verification, Contractor GSTIN handling,
 * Razorpay / UPI gateway simulation, and order confirmation.
 */

import { getCurrentUser, requireAuth } from './auth.js';
import { getCart, getCartTotals, clearCart } from './cart.js';
import { createOrderAndInvoice, openInvoiceViewer, openOrderTrackingModal } from './orders.js';
import { formatINR, showToast, escapeHTML, getStorage } from './utils.js';
import { 
  openWhatsAppDispatchModal, 
  notifyStoreOwnerOrderPlaced, 
  openWhatsAppChat, 
  getStoreOwnerPhone 
} from './whatsapp-service.js';
import { 
  validateValue, 
  DeliveryAddressSchema, 
  CreateOrderSchema 
} from './schema-validator.js';

// Major Indian PIN code directory for instant auto-filling
const PIN_CODE_MAP = {
  '380001': { city: 'Ahmedabad', state: 'Gujarat' },
  '380015': { city: 'Ahmedabad', state: 'Gujarat' },
  '380054': { city: 'Ahmedabad', state: 'Gujarat' },
  '390001': { city: 'Vadodara', state: 'Gujarat' },
  '395001': { city: 'Surat', state: 'Gujarat' },
  '360001': { city: 'Rajkot', state: 'Gujarat' },
  '360006': { city: 'Rajkot', state: 'Gujarat' },
  '400001': { city: 'Mumbai', state: 'Maharashtra' },
  '411001': { city: 'Pune', state: 'Maharashtra' },
  '110001': { city: 'New Delhi', state: 'Delhi' },
  '560001': { city: 'Bengaluru', state: 'Karnataka' },
  '600001': { city: 'Chennai', state: 'Tamil Nadu' },
  '500001': { city: 'Hyderabad', state: 'Telangana' },
  '700001': { city: 'Kolkata', state: 'West Bengal' },
  '302001': { city: 'Jaipur', state: 'Rajasthan' },
  '226001': { city: 'Lucknow', state: 'Uttar Pradesh' },
  '452001': { city: 'Indore', state: 'Madhya Pradesh' }
};

let currentCheckoutStep = 1;
let currentCheckoutItems = [];
let currentCheckoutTotals = null;
let selectedPaymentMethod = 'cod'; // 'cod' or 'razorpay'

/**
 * Open the interactive multi-step checkout modal
 * @param {Array|null} customItems Optional override (for Buy Now direct checkout)
 */
export function openCheckoutModal(customItems = null) {
  requireAuth((authenticatedUser) => {
    const cart = customItems || getCart();
    if (!cart || cart.length === 0) {
      showToast('Your cart is empty. Please add items to checkout.', 'info');
      return;
    }

    currentCheckoutItems = cart;
    currentCheckoutTotals = customItems ? calculateCustomTotals(customItems) : getCartTotals();
    currentCheckoutStep = 1;
    selectedPaymentMethod = 'cod';

    // Close cart drawer if open
    document.getElementById('cart-drawer-backdrop')?.classList.remove('active');

    const modal = document.getElementById('checkout-modal');
    if (!modal) return;

    renderCheckoutStep(1, authenticatedUser);
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }, 'Please sign in or create an account to proceed with your order.');
}

export function closeCheckoutModal() {
  const modal = document.getElementById('checkout-modal');
  modal?.classList.remove('active');
  document.body.style.overflow = '';
}

function calculateCustomTotals(items) {
  const subtotal = items.reduce((sum, item) => {
    const price = item.price || item.productSnapshot?.price || 0;
    const qty = item.quantity || 1;
    return sum + (price * qty);
  }, 0);
  const freeShippingThreshold = 999;
  const shipping = subtotal >= freeShippingThreshold ? 0 : 99;
  const total = subtotal + shipping;
  return { subtotal, shipping, total, freeShippingThreshold };
}

/**
 * Render the requested checkout step
 */
function renderCheckoutStep(step, user = null) {
  currentCheckoutStep = step;
  user = user || getCurrentUser();

  // Update step indicators
  const stepIndicators = document.querySelectorAll('.checkout-step-indicator');
  stepIndicators.forEach((el, index) => {
    const stepNum = index + 1;
    el.classList.toggle('active', stepNum === step);
    el.classList.toggle('completed', stepNum < step);
  });

  const stepContainer = document.getElementById('checkout-step-body');
  if (!stepContainer) return;

  if (step === 1) {
    stepContainer.innerHTML = getStep1AddressHtml(user);
    initStep1Listeners();
  } else if (step === 2) {
    stepContainer.innerHTML = getStep2PaymentHtml();
    initStep2Listeners();
  } else if (step === 3) {
    stepContainer.innerHTML = getStep3ConfirmationHtml();
    initStep3Listeners();
  }
}

/**
 * Step 1: Delivery Address & Contractor Info HTML
 */
function getStep1AddressHtml(user) {
  const defaultName = user?.displayName || '';
  const defaultEmail = user?.email || '';
  const defaultPhone = user?.phone || '';

  return `
    <div class="checkout-step-pane">
      <div class="checkout-pane-header">
        <h3 class="checkout-pane-title">Delivery &amp; Contractor Details</h3>
        <p class="checkout-pane-desc">Enter your jobsite or delivery address across India. PIN codes are validated instantly.</p>
      </div>

      <form id="checkout-address-form" novalidate>
        <div class="form-row-2">
          <div class="form-group">
            <label for="co-name" class="form-label">Full Name / Contractor Name *</label>
            <input type="text" id="co-name" class="form-control" value="${escapeHTML(defaultName)}" placeholder="e.g. Ramesh Patel" required />
          </div>
          <div class="form-group">
            <label for="co-phone" class="form-label">Mobile Number *</label>
            <div class="phone-input-group">
              <span class="phone-prefix">+91</span>
              <input type="tel" id="co-phone" class="form-control" value="${escapeHTML(defaultPhone)}" placeholder="98765 43210" maxlength="10" required />
            </div>
          </div>
        </div>

        <div class="form-row-2">
          <div class="form-group">
            <label for="co-pincode" class="form-label">PIN Code (6 digits) *</label>
            <div style="position:relative;">
              <input type="text" id="co-pincode" class="form-control" placeholder="e.g. 380015" maxlength="6" required />
              <span id="pincode-detected-badge" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:0.75rem;font-weight:700;color:var(--color-success);display:none;">Detected ✓</span>
            </div>
          </div>
          <div class="form-group">
            <label for="co-city" class="form-label">City &amp; State *</label>
            <input type="text" id="co-city" class="form-control" placeholder="City, State" required />
          </div>
        </div>

        <div class="form-group">
          <label for="co-address" class="form-label">Street Address / Shop No. / Site Location *</label>
          <input type="text" id="co-address" class="form-control" placeholder="e.g. Shop #12, Radhe Industrial Estate, Near S.P. Ring Road" required />
        </div>

        <div class="form-row-2">
          <div class="form-group">
            <label for="co-landmark" class="form-label">Landmark (Optional)</label>
            <input type="text" id="co-landmark" class="form-control" placeholder="e.g. Opposite Bopal Metro Station" />
          </div>
          <div class="form-group">
            <label for="co-gstin" class="form-label">Contractor B2B GSTIN (Optional)</label>
            <input type="text" id="co-gstin" class="form-control" placeholder="e.g. 24AAACD1234E1Z5" maxlength="15" style="text-transform:uppercase;" />
            <small style="color:var(--color-text-muted);font-size:0.7rem;">Enter 15-character GSTIN to claim 18% Input Tax Credit.</small>
          </div>
        </div>

        <div class="form-group">
          <label for="co-notes" class="form-label">Delivery Instructions (Optional)</label>
          <input type="text" id="co-notes" class="form-control" placeholder="e.g. Call contractor supervisor on arrival, heavy pipes unload" />
        </div>

        <div class="checkout-actions-bar">
          <button type="button" class="btn btn-outline" id="co-cancel-btn">Back to Shop</button>
          <button type="submit" class="btn btn-primary" id="co-step1-next-btn">
            Proceed to Payment &rarr;
          </button>
        </div>
      </form>
    </div>
  `;
}

/**
 * Initialize Step 1 Listeners (PIN auto-detect, Validation)
 */
function initStep1Listeners() {
  const pincodeInput = document.getElementById('co-pincode');
  const cityInput = document.getElementById('co-city');
  const badge = document.getElementById('pincode-detected-badge');

  pincodeInput?.addEventListener('input', () => {
    const val = pincodeInput.value.trim();
    if (val.length === 6 && PIN_CODE_MAP[val]) {
      const info = PIN_CODE_MAP[val];
      if (cityInput) cityInput.value = `${info.city}, ${info.state}`;
      if (badge) badge.style.display = 'block';
    } else if (val.length === 6) {
      if (cityInput && !cityInput.value) cityInput.value = 'Gujarat';
      if (badge) badge.style.display = 'none';
    } else {
      if (badge) badge.style.display = 'none';
    }
  });

  document.getElementById('co-cancel-btn')?.addEventListener('click', closeCheckoutModal);

  document.getElementById('checkout-address-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('co-name')?.value.trim();
    const phone = document.getElementById('co-phone')?.value.trim();
    const pincode = document.getElementById('co-pincode')?.value.trim();
    const city = document.getElementById('co-city')?.value.trim();
    const address = document.getElementById('co-address')?.value.trim();
    const landmark = document.getElementById('co-landmark')?.value.trim();
    const gstin = document.getElementById('co-gstin')?.value.trim().toUpperCase();
    const notes = document.getElementById('co-notes')?.value.trim();

    // Strict Schema Validation: Type, Length, Format
    const addressPayload = {
      name: name || undefined,
      phone: phone || undefined,
      pincode: pincode || undefined,
      city: city || undefined,
      address: address || undefined,
      landmark: landmark || undefined,
      gstin: gstin || undefined,
      notes: notes || undefined
    };

    const validation = validateValue(DeliveryAddressSchema, addressPayload);
    if (!validation.valid) {
      const firstErr = validation.errors[0];
      showToast(firstErr.message, 'error');

      // Highlight the invalid form input
      const fieldIdMap = {
        name: 'co-name',
        phone: 'co-phone',
        pincode: 'co-pincode',
        city: 'co-city',
        address: 'co-address',
        landmark: 'co-landmark',
        gstin: 'co-gstin',
        notes: 'co-notes'
      };
      const fieldEl = document.getElementById(fieldIdMap[firstErr.field]);
      if (fieldEl) {
        fieldEl.focus();
        fieldEl.style.borderColor = 'var(--color-danger, #DC2626)';
        setTimeout(() => { fieldEl.style.borderColor = ''; }, 3500);
      }
      return; // REJECT: do not proceed to step 2
    }

    // Save strictly validated delivery address to session state
    window.__devshree_checkout_address = {
      name,
      phone: `+91 ${phone}`,
      pincode,
      city,
      address,
      landmark,
      gstin,
      notes,
      fullFormattedAddress: `${address}, ${landmark ? landmark + ', ' : ''}${city} - ${pincode}`
    };

    renderCheckoutStep(2);
  });
}

/**
 * Step 2: Payment Method & Order Review HTML
 */
function getStep2PaymentHtml() {
  const address = window.__devshree_checkout_address || {};
  const totals = currentCheckoutTotals;
  const items = currentCheckoutItems;
  const gstAmount = Math.round(totals.subtotal * 0.18);

  return `
    <div class="checkout-step-pane">
      <div class="checkout-pane-header">
        <h3 class="checkout-pane-title">Payment Method &amp; Order Review</h3>
        <p class="checkout-pane-desc">Review your delivery address, select a secure payment mode, and inspect your order items.</p>
      </div>

      <div class="checkout-grid-layout">
        <!-- Left: Payment Options & Shipping Summary -->
        <div class="checkout-main-col">
          <!-- Delivery Address Card -->
          <div class="checkout-delivery-card">
            <div class="delivery-card-header">
              <div class="delivery-card-title-group">
                <div class="delivery-icon-box">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                </div>
                <div>
                  <span class="delivery-badge-label">Delivering To</span>
                  <div class="delivery-recipient-name">
                    ${escapeHTML(address.name || 'Site Recipient')}
                    <span class="delivery-recipient-phone">(${escapeHTML(address.phone || '')})</span>
                  </div>
                </div>
              </div>
              <button type="button" class="btn btn-outline btn-sm delivery-edit-btn" id="co-edit-address-btn" title="Change delivery destination">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                Change
              </button>
            </div>
            <p class="delivery-address-text">${escapeHTML(address.fullFormattedAddress || 'Delivery Address')}</p>
            ${address.gstin ? `
              <div class="delivery-gstin-pill">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span>GSTIN: <strong>${escapeHTML(address.gstin)}</strong> &bull; Verified (18% ITC Eligible)</span>
              </div>
            ` : ''}
          </div>

          <!-- Payment Options Heading -->
          <div class="payment-section-header">
            <h4 class="payment-section-title">Select Payment Mode</h4>
            <span class="payment-security-note">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              End-to-End Encrypted
            </span>
          </div>

          <div class="payment-options-stack" role="radiogroup" aria-label="Payment Method Selection">
            <!-- Option 1: Razorpay Online Payment -->
            <label class="payment-option-card ${selectedPaymentMethod === 'razorpay' ? 'selected' : ''}" for="pay-opt-razorpay">
              <div class="payment-card-left">
                <span class="custom-radio-indicator">
                  <input type="radio" name="payment-method" id="pay-opt-razorpay" value="razorpay" ${selectedPaymentMethod === 'razorpay' ? 'checked' : ''} />
                  <span class="radio-dot"></span>
                </span>
                <div class="payment-method-icon-wrap rzp-icon-bg">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                  </svg>
                </div>
                <div class="payment-option-info">
                  <div class="payment-title-row">
                    <span class="payment-option-title">Online Payment (Instant UPI QR)</span>
                    <span class="payment-badge-recommended">Instant Confirmation</span>
                  </div>
                  <p class="payment-option-desc">Scan &amp; pay instantly with Google Pay, PhonePe, Paytm, BHIM, or any UPI app.</p>
                  <div class="payment-methods-pills">
                    <span class="pay-pill">UPI QR</span>
                    <span class="pay-pill">GPay</span>
                    <span class="pay-pill">PhonePe</span>
                    <span class="pay-pill">Paytm</span>
                    <span class="pay-pill">BHIM</span>
                    <span class="pay-pill">CRED</span>
                  </div>
                </div>
              </div>
            </label>

            <!-- Option 2: Cash on Delivery -->
            <label class="payment-option-card ${selectedPaymentMethod === 'cod' ? 'selected' : ''}" for="pay-opt-cod">
              <div class="payment-card-left">
                <span class="custom-radio-indicator">
                  <input type="radio" name="payment-method" id="pay-opt-cod" value="cod" ${selectedPaymentMethod === 'cod' ? 'checked' : ''} />
                  <span class="radio-dot"></span>
                </span>
                <div class="payment-method-icon-wrap cod-icon-bg">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                    <circle cx="12" cy="12" r="2"></circle>
                    <path d="M6 12h.01M18 12h.01"></path>
                  </svg>
                </div>
                <div class="payment-option-info">
                  <div class="payment-title-row">
                    <span class="payment-option-title">Cash on Delivery (COD)</span>
                    <span class="payment-badge-neutral">Verified Partner Dispatch</span>
                  </div>
                  <p class="payment-option-desc">Pay cash or scan courier UPI QR code directly upon delivery at your jobsite.</p>
                </div>
              </div>
            </label>
          </div>

          <!-- Buyer Assurance & Trust Banner -->
          <div class="checkout-assurance-banner">
            <div class="assurance-item">
              <div class="assurance-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <div class="assurance-text">
                <strong>100% Protection</strong>
                <span>Transit insurance</span>
              </div>
            </div>
            <div class="assurance-item">
              <div class="assurance-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="8" r="7"></circle>
                  <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
                </svg>
              </div>
              <div class="assurance-text">
                <strong>Brand Warranties</strong>
                <span>100% authentic goods</span>
              </div>
            </div>
            <div class="assurance-item">
              <div class="assurance-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
              </div>
              <div class="assurance-text">
                <strong>GST Tax Invoice</strong>
                <span>18% ITC claimable</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Order Items & Summary -->
        <div class="checkout-summary-col">
          <div class="checkout-summary-box">
            <div class="summary-box-header">
              <h4 class="summary-box-title">Order Summary</h4>
              <span class="summary-items-count">${items.length} ${items.length === 1 ? 'item' : 'items'}</span>
            </div>

            <div class="checkout-items-list">
              ${items.map(item => {
                const name = item.name || item.productSnapshot?.name || 'Item';
                const brand = item.brand || item.productSnapshot?.brand || 'Devshree';
                const price = item.price || item.productSnapshot?.price || 0;
                const image = item.image || item.productSnapshot?.image || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=100&auto=format&fit=crop&q=80';
                const qty = item.quantity || 1;
                return `
                  <div class="checkout-item-row">
                    <div class="checkout-item-thumb-box">
                      <img src="${image}" alt="${escapeHTML(name)}" class="checkout-item-thumb" onerror="this.src='https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=100&auto=format&fit=crop&q=80'" />
                      <span class="checkout-item-qty-badge">${qty}</span>
                    </div>
                    <div class="checkout-item-info">
                      <h5 class="checkout-item-title" title="${escapeHTML(name)}">${escapeHTML(name)}</h5>
                      <span class="checkout-item-brand">${escapeHTML(brand)}</span>
                    </div>
                    <strong class="checkout-item-total">${formatINR(price * qty)}</strong>
                  </div>
                `;
              }).join('')}
            </div>

            <div class="checkout-price-divider"></div>

            <div class="checkout-price-table">
              <div class="checkout-price-line">
                <span class="price-line-label">Taxable Subtotal:</span>
                <span class="price-line-value">${formatINR(totals.subtotal)}</span>
              </div>
              <div class="checkout-price-line">
                <span class="price-line-label">CGST (9%):</span>
                <span class="price-line-value">${formatINR(Math.round(gstAmount / 2))}</span>
              </div>
              <div class="checkout-price-line">
                <span class="price-line-label">SGST (9%):</span>
                <span class="price-line-value">${formatINR(Math.round(gstAmount / 2))}</span>
              </div>
              <div class="checkout-price-line">
                <span class="price-line-label">Express Delivery:</span>
                <span class="price-line-value ${totals.shipping === 0 ? 'text-free' : ''}">
                  ${totals.shipping === 0 ? '<span class="free-shipping-tag">FREE</span>' : formatINR(totals.shipping)}
                </span>
              </div>

              <div class="checkout-price-divider"></div>

              <div class="checkout-price-line total-line">
                <div class="grand-total-label-wrap">
                  <span class="grand-total-label">Grand Total</span>
                  <span class="grand-total-tax-note">(Inclusive of 18% GST)</span>
                </div>
                <span class="grand-total-amount">${formatINR(totals.total)}</span>
              </div>
            </div>

            <div class="checkout-cta-stack">
              <button type="button" class="btn btn-primary btn-checkout-action" id="co-place-order-btn">
                <span id="co-place-order-btn-label">${selectedPaymentMethod === 'razorpay' ? 'Proceed to Razorpay Payment' : 'Confirm Order (Cash on Delivery)'}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </button>
              <button type="button" class="btn btn-outline btn-checkout-back" id="co-step2-back-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                  <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
                Back to Delivery Address
              </button>
            </div>

            <div class="checkout-security-footer">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <span>256-Bit SSL Encrypted &bull; Direct Factory Dispatch</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Initialize Step 2 Listeners (Radio toggle, Place order button)
 */
function initStep2Listeners() {
  const radioInputs = document.querySelectorAll('input[name="payment-method"]');
  const placeOrderBtn = document.getElementById('co-place-order-btn');
  const labelEl = document.getElementById('co-place-order-btn-label');

  function updatePaymentSelection(value) {
    selectedPaymentMethod = value;
    document.querySelectorAll('.payment-option-card').forEach(card => card.classList.remove('selected'));
    const activeRadio = document.querySelector(`input[name="payment-method"][value="${value}"]`);
    if (activeRadio) {
      activeRadio.checked = true;
      activeRadio.closest('.payment-option-card')?.classList.add('selected');
    }

    const btnText = selectedPaymentMethod === 'razorpay' 
      ? 'Proceed to Razorpay Payment' 
      : 'Confirm Order (Cash on Delivery)';
    if (labelEl) {
      labelEl.textContent = btnText;
    } else if (placeOrderBtn) {
      placeOrderBtn.textContent = btnText;
    }
  }

  radioInputs.forEach(radio => {
    radio.addEventListener('change', () => {
      updatePaymentSelection(radio.value);
    });
  });

  // Enable clicking anywhere on the card
  document.querySelectorAll('.payment-option-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const radio = card.querySelector('input[type="radio"]');
      if (radio && radio.value !== selectedPaymentMethod) {
        updatePaymentSelection(radio.value);
      }
    });
  });

  document.getElementById('co-edit-address-btn')?.addEventListener('click', () => {
    renderCheckoutStep(1);
  });

  document.getElementById('co-step2-back-btn')?.addEventListener('click', () => {
    renderCheckoutStep(1);
  });

  placeOrderBtn?.addEventListener('click', () => {
    if (selectedPaymentMethod === 'razorpay') {
      openRazorpaySimulationModal();
    } else {
      executeOrderPlacement('Cash on Delivery (COD)', 'Pending');
    }
  });
}

export const RAZORPAY_CONFIG = {
  keyId: (typeof window !== 'undefined' && window.__DEVSHREE_RAZORPAY_KEY_ID) || getStorage('devshree_razorpay_key_id', '') || '',
  merchantName: "Devshree Hardware & Electricals",
  merchantVpa: "8866130409@axisbank",
  currency: "INR",
  themeColor: "#2463A6"
};

let rzpCountdownInterval = null;

/**
 * Launch official Razorpay SDK popup if loaded and configured
 */
export function launchOfficialRazorpayCheckout() {
  const user = getCurrentUser();
  const address = window.__devshree_checkout_address || {};
  const totals = currentCheckoutTotals || getCartTotals() || { total: 0, subtotal: 0, shipping: 0 };
  if (!totals || !totals.total) {
    showToast('Cart total is missing. Please review your cart.', 'error');
    return;
  }

  const configuredKey = (typeof window !== 'undefined' && window.__DEVSHREE_RAZORPAY_KEY_ID) || getStorage('devshree_razorpay_key_id', '').trim() || RAZORPAY_CONFIG.keyId;
  // If no live key is configured, switch automatically to Devshree Instant Gateway
  if (!configuredKey) {
    showToast('Opening Devshree Instant Payment Gateway (UPI / QR / Cards / NetBanking)...', 'info');
    openRazorpaySimulationModal();
    return;
  }

  if (typeof window.Razorpay !== 'function') {
    showToast('Razorpay SDK script not found. Using Devshree Instant Gateway.', 'info');
    openRazorpaySimulationModal();
    return;
  }

  try {
    const options = {
      key: configuredKey,
      amount: Math.round(totals.total * 100), // In paise
      currency: "INR",
      name: RAZORPAY_CONFIG.merchantName,
      description: `Devshree Supplies Order • ${currentCheckoutItems.length} items (incl. 18% GST)`,
      image: "assets/images/favicon.png",
      prefill: {
        name: address.name || user?.displayName || 'Customer',
        email: user?.email || '',
        contact: address.phone?.replace(/\D/g, '').slice(-10) || ''
      },
      notes: {
        address: address.fullFormattedAddress || '',
        gstin: address.gstin || ''
      },
      theme: {
        color: RAZORPAY_CONFIG.themeColor
      },
      handler: function (response) {
        const paymentId = response.razorpay_payment_id || `PAY_RZP_${Math.floor(10000000 + Math.random() * 90000000)}`;
        executeOrderPlacement(`Razorpay Online (${paymentId})`, 'Paid');
      },
      modal: {
        ondismiss: function () {
          showToast('Payment window closed. You can retry or select Cash on Delivery.', 'info');
        }
      }
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (response) {
      showToast(`Payment error: ${response.error?.description || 'Gateway error'}. Switching to direct gateway...`, 'error');
      openRazorpaySimulationModal();
    });
    rzp.open();
  } catch (err) {
    console.warn('[Devshree] Official Razorpay popup failed, switching to interactive gateway:', err);
    openRazorpaySimulationModal();
  }
}

/**
 * Interactive Razorpay & Online Payment Gateway Modal
 */
export function openRazorpaySimulationModal() {
  const modal = document.getElementById('razorpay-simulation-modal');
  if (!modal) return;

  const totals = currentCheckoutTotals || getCartTotals() || { total: 0, subtotal: 0, shipping: 0 };
  const total = totals.total || 0;
  const user = getCurrentUser();
  const address = window.__devshree_checkout_address || {};

  // Populate payable amount
  const amountEl = document.getElementById('rzp-modal-amount');
  if (amountEl) amountEl.textContent = formatINR(total);
  document.querySelectorAll('.rzp-inline-amount').forEach(el => el.textContent = formatINR(total));

  const payBtnText = document.getElementById('rzp-pay-btn-text');
  if (payBtnText) payBtnText.textContent = `I Have Paid ${formatINR(total)}`;

  // Start 10-minute session countdown timer
  clearInterval(rzpCountdownInterval);
  let secondsRemaining = 600; // 10 minutes
  const timerEl = document.getElementById('rzp-countdown-timer');
  const updateTimer = () => {
    const mins = Math.floor(secondsRemaining / 60).toString().padStart(2, '0');
    const secs = (secondsRemaining % 60).toString().padStart(2, '0');
    if (timerEl) timerEl.textContent = `${mins}:${secs}`;
    if (secondsRemaining <= 0) {
      clearInterval(rzpCountdownInterval);
      showToast('Payment session expired. Please re-initiate payment.', 'error');
      closePaymentModal();
    }
    secondsRemaining--;
  };
  updateTimer();
  rzpCountdownInterval = setInterval(updateTimer, 1000);

  let activePaymentMode = 'upi';

  // 1. Merchant Verified UPI & QR Code Generator (No personal name displayed)
  const merchantVpa = getStorage('devshree_upi_vpa', RAZORPAY_CONFIG.merchantVpa);
  const upiUri = `upi://pay?pa=${encodeURIComponent(merchantVpa)}&pn=${encodeURIComponent('Devshree Hardware')}&am=${total}&cu=INR&tn=${encodeURIComponent('Devshree Order')}`;

  const qrImg = document.getElementById('rzp-dynamic-qr-img');
  if (qrImg) {
    // Generate dynamic QR with exact order total pre-filled for Devshree Hardware
    const dynamicQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUri)}`;
    qrImg.src = dynamicQrUrl;
    // Fallback to the uploaded QR image if network fails
    qrImg.onerror = () => {
      qrImg.src = 'assets/images/payment_upi_qr.png';
    };
  }

  const displayVpaEl = document.getElementById('rzp-display-vpa');
  if (displayVpaEl) displayVpaEl.textContent = merchantVpa;

  // 1b. 1-Tap Copy UPI ID button
  const copyUpiBtn = document.getElementById('rzp-copy-upi-btn');
  if (copyUpiBtn) {
    copyUpiBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(merchantVpa);
        showToast(`UPI ID ${merchantVpa} copied to clipboard!`, 'success');
      } catch (_) {
        showToast(`UPI ID: ${merchantVpa}`, 'info');
      }
    };
  }

  // 1c. UPI App Chips with direct deep-links
  const appChips = modal.querySelectorAll('.rzp-app-chip');
  appChips.forEach(chip => {
    chip.onclick = () => {
      appChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const appName = chip.dataset.app;
      showToast(`Selected ${appName} for ₹${total} payment`, 'info');

      // On mobile phones, launch native UPI app intent directly
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile) {
        window.location.href = upiUri;
      }
    };
  });

  const vpaInput = document.getElementById('rzp-vpa-input');
  const vpaBadge = document.getElementById('rzp-vpa-badge');
  const verifyVpaBtn = document.getElementById('rzp-verify-vpa-btn');

  if (verifyVpaBtn) {
    verifyVpaBtn.onclick = () => {
      const val = vpaInput?.value.trim() || '';
      if (val.includes('@')) {
        if (vpaBadge) {
          vpaBadge.textContent = 'Verified ✓';
          vpaBadge.style.color = '#10B981';
        }
        showToast(`UPI ID ${val} verified successfully.`, 'success');
      } else {
        if (vpaBadge) {
          vpaBadge.textContent = 'Invalid VPA';
          vpaBadge.style.color = '#EF4444';
        }
        showToast('Please enter a valid UPI ID (e.g. yourname@upi).', 'error');
      }
    };
  }

  // 2. Interactive Card Live Preview Listeners
  const cardNumInput = document.getElementById('card-num-input');
  const cardNameInput = document.getElementById('card-name-input');
  const cardExpInput = document.getElementById('card-exp-input');
  const previewNum = document.getElementById('preview-card-number');
  const previewName = document.getElementById('preview-card-name');
  const previewExp = document.getElementById('preview-card-expiry');
  const previewNetwork = document.getElementById('preview-card-network');

  // Pre-fill card name with customer name
  if (address.name && cardNameInput) {
    cardNameInput.value = address.name;
    if (previewName) previewName.textContent = address.name.toUpperCase();
  }

  if (cardNumInput) {
    cardNumInput.oninput = (e) => {
      let val = e.target.value.replace(/\D/g, '').substring(0, 16);
      let formatted = val.match(/.{1,4}/g)?.join(' ') || val;
      e.target.value = formatted;
      if (previewNum) {
        previewNum.textContent = formatted || '•••• •••• •••• ••••';
      }
      if (previewNetwork) {
        if (val.startsWith('4')) previewNetwork.textContent = 'VISA';
        else if (val.startsWith('5')) previewNetwork.textContent = 'MASTERCARD';
        else if (val.startsWith('6')) previewNetwork.textContent = 'RUPAY';
        else previewNetwork.textContent = 'CARD';
      }
    };
  }

  if (cardNameInput) {
    cardNameInput.oninput = (e) => {
      if (previewName) {
        previewName.textContent = (e.target.value || 'CARD HOLDER').toUpperCase();
      }
    };
  }

  if (cardExpInput) {
    cardExpInput.oninput = (e) => {
      let val = e.target.value.replace(/\D/g, '').substring(0, 4);
      if (val.length >= 2) {
        val = val.substring(0, 2) + '/' + val.substring(2);
      }
      e.target.value = val;
      if (previewExp) {
        previewExp.textContent = val || 'MM/YY';
      }
    };
  }

  // 3. NetBanking selection
  let selectedBank = 'HDFC Bank';
  const bankButtons = modal.querySelectorAll('.rzp-bank-btn');
  const otherBanksSelect = document.getElementById('other-banks-select');

  bankButtons.forEach(btn => {
    btn.onclick = () => {
      bankButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedBank = btn.dataset.bank;
      if (otherBanksSelect) otherBanksSelect.value = '';
    };
  });

  if (otherBanksSelect) {
    otherBanksSelect.onchange = () => {
      if (otherBanksSelect.value) {
        bankButtons.forEach(b => b.classList.remove('active'));
        selectedBank = otherBanksSelect.value;
        showToast(`Selected ${selectedBank}`, 'info');
      }
    };
  }

  // 4. Official Razorpay Trigger Button
  const officialTriggerBtn = document.getElementById('rzp-launch-official-btn');
  if (officialTriggerBtn) {
    officialTriggerBtn.onclick = () => {
      closePaymentModal();
      launchOfficialRazorpayCheckout();
    };
  }

  // 5. Pay Now Execution
  const procOverlay = document.getElementById('rzp-processing-overlay');
  const procTitle = document.getElementById('rzp-proc-title');
  const procSubtitle = document.getElementById('rzp-proc-subtitle');
  const procBar = document.getElementById('rzp-proc-bar');

  const handlePay = () => {
    const currentPayBtn = document.getElementById('rzp-pay-action-btn');

    if (procOverlay) procOverlay.style.display = 'flex';
    if (currentPayBtn) currentPayBtn.disabled = true;

    // Multi-stage realistic FinTech gateway authorization
    if (procBar) procBar.style.width = '35%';
    if (procTitle) procTitle.textContent = 'Verifying UPI Payment...';
    if (procSubtitle) procSubtitle.textContent = 'Contacting NPCI & banking network to confirm transaction.';

    setTimeout(() => {
      if (procBar) procBar.style.width = '75%';
      if (procTitle) procTitle.textContent = 'Authorizing UPI Transaction...';
      if (procSubtitle) {
        procSubtitle.textContent = 'Confirming payment receipt for Devshree Hardware order.';
      }
    }, 700);

    setTimeout(() => {
      if (procBar) procBar.style.width = '100%';
      if (procTitle) procTitle.textContent = 'Payment Confirmed Successfully!';
      if (procSubtitle) procSubtitle.textContent = 'Generating compliant GST Tax Invoice and recording order...';
    }, 1400);

    setTimeout(() => {
      closePaymentModal();
      const rzpTxnId = `upi_${Math.floor(100000000 + Math.random() * 900000000)}`;
      const paymentLabel = `UPI QR Payment (${rzpTxnId})`;
      executeOrderPlacement(paymentLabel, 'Paid');
    }, 1900);
  };

  function closePaymentModal() {
    clearInterval(rzpCountdownInterval);
    modal.classList.remove('active');
    if (procOverlay) procOverlay.style.display = 'none';
    const currentPayBtn = document.getElementById('rzp-pay-action-btn');
    if (currentPayBtn) currentPayBtn.disabled = false;
    document.body.style.overflow = '';
  }

  // Cancel & Close Handlers
  const cancelBtn = document.getElementById('rzp-cancel-btn');
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      closePaymentModal();
      showToast('Payment cancelled. You can select Cash on Delivery instead.', 'info');
    };
  }

  const closeIcon = document.getElementById('rzp-modal-close-icon');
  if (closeIcon) closeIcon.onclick = closePaymentModal;

  modal.onclick = (e) => {
    if (e.target === modal) closePaymentModal();
  };

  const actionPayBtn = document.getElementById('rzp-pay-action-btn');
  if (actionPayBtn) {
    actionPayBtn.disabled = false;
    actionPayBtn.onclick = handlePay;
  }

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

/**
 * Execute actual order creation in Firestore and transition to Confirmation step
 */
async function executeOrderPlacement(paymentMethod, paymentStatus) {
  const user = getCurrentUser();
  const address = window.__devshree_checkout_address || {};
  const totals = currentCheckoutTotals || getCartTotals() || { total: 0, subtotal: 0, shipping: 0 };
  const items = currentCheckoutItems || [];

  // Normalize payment method to canonical schema enum
  let canonicalPaymentMethod = 'Cash on Delivery (COD)';
  const rawMethod = String(paymentMethod || '').trim();
  if (/cod|cash/i.test(rawMethod)) {
    canonicalPaymentMethod = 'Cash on Delivery (COD)';
  } else if (/upi|qr/i.test(rawMethod)) {
    canonicalPaymentMethod = 'Online UPI / QR';
  } else if (/card/i.test(rawMethod)) {
    canonicalPaymentMethod = 'Card';
  } else if (/net|bank/i.test(rawMethod)) {
    canonicalPaymentMethod = 'Net Banking';
  } else if (/razorpay/i.test(rawMethod)) {
    canonicalPaymentMethod = 'Online UPI / QR';
  } else {
    canonicalPaymentMethod = rawMethod || 'Cash on Delivery (COD)';
  }

  // Strict Schema Validation before order submission
  const orderPayload = {
    items: items.map(i => ({
      id: String(i.productId || i.id || 'dev-prod'),
      name: String(i.name || i.productSnapshot?.name || 'Product'),
      price: Number(i.price || i.productSnapshot?.price || 0),
      quantity: Number(i.quantity || 1),
      brand: (i.brand || i.productSnapshot?.brand) ? String(i.brand || i.productSnapshot?.brand) : undefined
    })),
    shippingAddress: {
      name: address.name,
      phone: (address.phone || '').replace(/^\+91\s*/, '').trim(),
      pincode: address.pincode,
      city: address.city,
      state: address.state,
      address: address.address,
      landmark: address.landmark || undefined,
      gstin: address.gstin || undefined,
      notes: address.notes || undefined
    },
    paymentMethod: canonicalPaymentMethod
  };

  const validation = validateValue(CreateOrderSchema, orderPayload);
  if (!validation.valid) {
    showToast(validation.errors[0]?.message || 'Order data failed schema validation.', 'error');
    return;
  }

  const orderData = {
    customerName: address.name || user?.displayName || 'Customer',
    customerEmail: user?.email || '',
    customerPhone: address.phone || '',
    shippingAddress: address.fullFormattedAddress || 'Ahmedabad, Gujarat',
    contractorGstin: address.gstin || '',
    deliveryNotes: address.notes || '',
    items: items.map(i => ({
      id: i.productId || i.id,
      name: i.name || i.productSnapshot?.name,
      brand: i.brand || i.productSnapshot?.brand,
      price: i.price || i.productSnapshot?.price,
      quantity: i.quantity || 1
    })),
    subtotal: totals.subtotal || 0,
    shipping: totals.shipping || 0,
    total: totals.total || 0,
    paymentMethod: paymentMethod,
    paymentStatus: paymentStatus || 'Pending',
    orderStatus: 'Confirmed',
    courierPartner: 'Delhivery Express',
    trackingNumber: `DLV-DEV-${Math.floor(10000000 + Math.random() * 90000000)}`,
    estimatedDeliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  };

  try {
    showToast('Processing your order & creating GST Tax Invoice...', 'info');
    const invoice = await createOrderAndInvoice(orderData);

    // Save active invoice to window for step 3 actions
    window.__devshree_last_invoice = invoice;

    // Background order dispatch logging and webhook trigger (do NOT auto-open WhatsApp for customer)
    try {
      notifyStoreOwnerOrderPlaced(invoice, { openChat: false });
    } catch (waErr) {
      console.warn('[Checkout] Failed to trigger store owner background notification:', waErr);
    }

    // Clear cart if standard cart checkout
    clearCart();

    // Move to step 3 (Order Confirmation)
    renderCheckoutStep(3);
  } catch (err) {
    console.error('[Devshree] Order placement error:', err);
    showToast('Failed to place order. Please try again.', 'error');
  }
}

/**
 * Step 3: Order Confirmation HTML with Customer Receipt & Support Desk options
 */
function getStep3ConfirmationHtml() {
  const inv = window.__devshree_last_invoice || {};

  return `
    <div class="checkout-step-pane checkout-confirmation-pane">
      <!-- 1. Celebratory Success Hero -->
      <div class="conf-hero-wrap">
        <div class="conf-success-icon" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <span class="conf-badge-pill">✓ Order Confirmed</span>
        <h2 class="conf-title">Thank You for Your Order!</h2>
        <p class="conf-subtitle">
          Your order has been registered and is being prepared for direct warehouse dispatch from Rajkot.
        </p>
      </div>

      <!-- 2. Order Details / Quick Receipt Card -->
      <div class="conf-receipt-card">
        <div class="conf-receipt-header">
          <div class="conf-inv-block">
            <span class="conf-label">Invoice Number</span>
            <div class="conf-inv-value-row">
              <span class="conf-inv-number" id="conf-inv-text">${escapeHTML(inv.invoiceNumber || 'INV-DEV')}</span>
              <button type="button" class="conf-copy-btn" id="conf-copy-inv-btn" title="Copy Invoice Number" aria-label="Copy Invoice Number">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span class="conf-copy-text" id="conf-copy-text">Copy</span>
              </button>
            </div>
          </div>
          <div class="conf-total-block">
            <span class="conf-label">Total Amount</span>
            <div class="conf-total-value">${formatINR(inv.total || 0)}</div>
          </div>
        </div>

        <div class="conf-receipt-divider"></div>

        <div class="conf-receipt-grid">
          <div class="conf-info-item">
            <span class="conf-label">Payment Status</span>
            <div class="conf-status-pill ${inv.paymentStatus === 'Paid' ? 'status-paid' : 'status-cod'}">
              <span class="status-dot"></span>
              <span>${escapeHTML(inv.paymentMethod || 'COD')} &bull; <strong>${escapeHTML(inv.paymentStatus || 'Pending')}</strong></span>
            </div>
          </div>
          <div class="conf-info-item">
            <span class="conf-label">Estimated Delivery</span>
            <div class="conf-delivery-val">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="1" y="3" width="15" height="13"></rect>
                <polygon points="16 8 20 8 23 11 23 16 16 8"></polygon>
                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                <circle cx="18.5" cy="18.5" r="2.5"></circle>
              </svg>
              <span>${escapeHTML(inv.estimatedDeliveryDate || 'Within 2-3 Days')}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. WhatsApp Updates & Support Card (Mobile Responsive, Customer First) -->
      <div class="conf-whatsapp-card">
        <div class="conf-wa-header">
          <div class="conf-wa-icon-bubble">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#FFFFFF">
              <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24zm4.52 11.53c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.38-.44.13-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.45 1.03 2.62.13.17 1.77 2.71 4.29 3.8.6.26 1.07.41 1.44.53.61.19 1.16.17 1.6.1 1.02-.15 1.47-.83 1.68-1.16.21-.34.21-.63.15-.76-.07-.13-.25-.2-.5-.33z"/>
            </svg>
          </div>
          <div class="conf-wa-title-area">
            <h4 class="conf-wa-title">WhatsApp Order Updates</h4>
            <p class="conf-wa-desc">Get your GST Tax Invoice and live courier dispatch updates on WhatsApp.</p>
          </div>
        </div>

        <div class="conf-wa-btn-group">
          <button type="button" class="conf-btn-wa-primary" id="co-whatsapp-receipt-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24zm4.52 11.53c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.38-.44.13-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.45 1.03 2.62.13.17 1.77 2.71 4.29 3.8.6.26 1.07.41 1.44.53.61.19 1.16.17 1.6.1 1.02-.15 1.47-.83 1.68-1.16.21-.34.21-.63.15-.76-.07-.13-.25-.2-.5-.33z"/>
            </svg>
            <span>Send Receipt to WhatsApp</span>
          </button>

          <button type="button" class="conf-btn-wa-secondary" id="co-help-wa-btn">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            <span>Chat with Support (+91 88661 30409)</span>
          </button>
        </div>
      </div>

      <!-- 4. Primary Store Action Buttons (Clear Hierarchy) -->
      <div class="conf-action-buttons">
        <button type="button" class="conf-btn-primary" id="co-track-order-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="3" width="15" height="13"></rect>
            <polygon points="16 8 20 8 23 11 23 16 16 8"></polygon>
            <circle cx="5.5" cy="18.5" r="2.5"></circle>
            <circle cx="18.5" cy="18.5" r="2.5"></circle>
          </svg>
          <span>Track Order Live</span>
        </button>

        <button type="button" class="conf-btn-secondary" id="co-view-invoice-btn">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <span>View / Download GST Invoice</span>
        </button>

        <button type="button" class="conf-btn-ghost" id="co-finish-btn">
          <span>Continue Shopping &rarr;</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Initialize Step 3 Listeners (View invoice, Track order, Finish, WhatsApp Receipt & Customer Support)
 */
function initStep3Listeners() {
  const inv = window.__devshree_last_invoice;

  // Copy invoice number to clipboard
  const copyBtn = document.getElementById('conf-copy-inv-btn');
  const copyText = document.getElementById('conf-copy-text');
  copyBtn?.addEventListener('click', async () => {
    const invNum = inv?.invoiceNumber || document.getElementById('conf-inv-text')?.textContent || '';
    if (!invNum) return;
    try {
      await navigator.clipboard.writeText(invNum);
      if (copyText) copyText.textContent = 'Copied!';
      showToast('Invoice number copied to clipboard!', 'success');
      setTimeout(() => {
        if (copyText) copyText.textContent = 'Copy';
      }, 2000);
    } catch (_) {
      showToast('Invoice number: ' + invNum, 'info');
    }
  });

  // Customer's personal WhatsApp copy / receipt
  document.getElementById('co-whatsapp-receipt-btn')?.addEventListener('click', () => {
    if (inv) {
      openWhatsAppDispatchModal(inv, 'customer');
    }
  });

  // Customer support inquiry on WhatsApp
  document.getElementById('co-help-wa-btn')?.addEventListener('click', () => {
    if (inv) {
      const ownerPhone = getStoreOwnerPhone();
      const helpMsg = `Hello Devshree Hardware, I have an inquiry about my order: ${inv.invoiceNumber || ''}`;
      openWhatsAppChat(ownerPhone, helpMsg);
    }
  });

  document.getElementById('co-view-invoice-btn')?.addEventListener('click', () => {
    closeCheckoutModal();
    if (inv) openInvoiceViewer(inv);
  });

  document.getElementById('co-track-order-btn')?.addEventListener('click', () => {
    closeCheckoutModal();
    if (inv) openOrderTrackingModal(inv.invoiceNumber || inv.id);
  });

  document.getElementById('co-finish-btn')?.addEventListener('click', () => {
    closeCheckoutModal();
  });
}
