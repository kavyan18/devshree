/**
 * DEVSHREE — WHATSAPP & SMS DISPATCH SERVICE
 * Provides automated WhatsApp order receipts, store owner trade dispatch alerts,
 * tracking links via WhatsApp, 160-char SMS generation, and an interactive
 * WhatsApp Dispatcher Modal for both Customer & Admin.
 */

import { formatINR, escapeHTML, getStorage, setStorage, showToast } from './utils.js';
import { STORE_INFO } from './mock-data.js';

const STORE_OWNER_PHONE_KEY = 'devshree_store_owner_phone';
const DEFAULT_STORE_OWNER_PHONE = '918866130409'; // Devshree Rajkot Hub Phone (Shop Owner)

/**
 * Clean & Normalize Indian Mobile Phone Number
 * e.g. "+91 98250 12345" -> "919825012345"
 * e.g. "9825012345" -> "919825012345"
 */
export function cleanIndianPhone(rawPhone) {
  if (!rawPhone) return '';
  const digits = String(rawPhone).replace(/\D/g, '');
  if (digits.length === 10) {
    return '91' + digits;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return '91' + digits.substring(1);
  }
  return digits;
}

/**
 * Get / Set Store Owner Phone Number
 */
export function getStoreOwnerPhone() {
  return getStorage(STORE_OWNER_PHONE_KEY, DEFAULT_STORE_OWNER_PHONE);
}

export function setStoreOwnerPhone(phone) {
  const cleaned = cleanIndianPhone(phone) || DEFAULT_STORE_OWNER_PHONE;
  setStorage(STORE_OWNER_PHONE_KEY, cleaned);
  return cleaned;
}

/**
 * 1. Build Customer Order Receipt WhatsApp Message
 */
export function buildCustomerOrderWhatsAppMessage(order) {
  const invNum = order.invoiceNumber || 'INV-DEV';
  const custName = order.customerName || 'Valued Customer';
  const totalStr = formatINR(order.total || 0);
  const items = order.itemsSnapshot || [];
  const trackingLink = `https://devshree.in/track?id=${encodeURIComponent(invNum)}`;

  const itemsList = items.map(item => {
    const qty = item.quantity || 1;
    const name = item.name || item.productSnapshot?.name || 'Supply item';
    const price = item.price || item.productSnapshot?.price || 0;
    return `• *${qty}x* ${name} — ₹${(price * qty).toLocaleString('en-IN')}`;
  }).join('\n');

  return `🛒 *DEVSHREE HARDWARE & SUPPLIES*
━━━━━━━━━━━━━━━━━━━━━━━━
✅ *ORDER CONFIRMED & REGISTERED*

Hello *${custName}*, thank you for choosing Devshree! Your order has been placed successfully and registered for express warehouse dispatch.

📋 *Order Details:*
• *Invoice Number:* ${invNum}
• *Date:* ${new Date(order.createdAtIso || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
• *Payment Mode:* ${order.paymentMethod || 'Cash on Delivery (COD)'}
• *Status:* ${order.orderStatus || 'Confirmed'} (18% GST Tax Invoice Included)

📦 *Items Ordered:*
${itemsList || '• Hardware & Trade Supplies'}

━━━━━━━━━━━━━━━━━━━━━━━━
💰 *Bill Breakdown:*
• Subtotal: ${formatINR(order.subtotal || 0)}
• GST (18% Tax): ${formatINR(order.gstAmount || Math.round((order.subtotal || 0) * 0.18))}
• Shipping: ${order.shippingCost === 0 || !order.shippingCost ? 'FREE Dispatch' : formatINR(order.shippingCost)}
👉 *Total Amount:* *${totalStr}*

📍 *Delivery Location:*
${order.shippingAddress || 'Customer Site Delivery, Gujarat'}

🚚 *Consignment Tracking:*
Courier: *${order.courierPartner || 'Delhivery Express'}*
AWB No: *${order.trackingNumber || 'DLV-DEV-849201'}*
Live Tracking: ${trackingLink}

📞 *Need Assistance?*
Contact Devshree Support at *+91 88661 30409* or reply to this WhatsApp chat.
Have a productive build! 🛠️`;
}

/**
 * 2. Build Store Owner / Dispatcher New Order Alert
 */
export function buildStoreOwnerOrderWhatsAppMessage(order) {
  const invNum = order.invoiceNumber || 'INV-DEV';
  const custName = order.customerName || 'Customer';
  const phone = order.customerPhone || 'N/A';
  const totalStr = formatINR(order.total || 0);
  const items = order.itemsSnapshot || [];
  const itemsCount = items.reduce((sum, i) => sum + (i.quantity || 1), 0);

  const itemsPreview = items.map(i => `• ${i.quantity || 1}x ${i.name || 'Item'} (₹${i.price || 0})`).join('\n');

  return `🚨 *NEW ORDER RECEIVED — DEVSHREE STORE*
━━━━━━━━━━━━━━━━━━━━━━━━
⚡ *Action:* Prepare Dispatch Packing

📄 *Invoice:* *${invNum}*
👤 *Customer:* *${custName}*
📞 *Phone:* ${phone}
📍 *Address:* ${order.shippingAddress || 'Not specified'}

📦 *Items Ordered (${itemsCount} units):*
${itemsPreview}

💵 *Total Payable:* *${totalStr}*
💳 *Payment Method:* ${order.paymentMethod || 'COD'}
🚚 *Logistics Partner:* ${order.courierPartner || 'Delhivery Express'}

🔗 *Admin Link:* https://devshree.in/admin.html
━━━━━━━━━━━━━━━━━━━━━━━━
_Tap customer phone to call or WhatsApp directly for verification._`;
}

/**
 * 3. Build Logistics & Dispatch Update WhatsApp Message
 */
export function buildShippingWhatsAppMessage(order) {
  const invNum = order.invoiceNumber || 'INV-DEV';
  const custName = order.customerName || 'Customer';
  const trackingLink = `https://devshree.in/track?id=${encodeURIComponent(invNum)}`;

  return `🚚 *SHIPMENT DISPATCHED — DEVSHREE*
━━━━━━━━━━━━━━━━━━━━━━━━
Dear *${custName}*,

Your order (*${invNum}*) has been inspected, packed, and handed over to our logistics partner.

📦 *Logistics Partner:* ${order.courierPartner || 'Delhivery Express'}
📑 *AWB Tracking No:* *${order.trackingNumber || 'DLV-DEV-849201'}*
📅 *Estimated Arrival:* *${order.estimatedDeliveryDate || 'Within 2-3 Business Days'}*

📍 *Track Consignment Real-Time:*
${trackingLink}

Official GST tax invoice is attached inside your package. Thank you! 🛠️`;
}

/**
 * 4. Build Delivery Completed WhatsApp Message
 */
export function buildDeliveryWhatsAppMessage(order) {
  const invNum = order.invoiceNumber || 'INV-DEV';
  const custName = order.customerName || 'Customer';

  return `✅ *DELIVERED — DEVSHREE HARDWARE*
━━━━━━━━━━━━━━━━━━━━━━━━
Dear *${custName}*,

Your consignment for Invoice *${invNum}* has been successfully delivered to your site.

We hope the materials exceed your expectations! If you need warranty support or GST tax credits, your official tax invoice remains saved in your Devshree account:
🔗 https://devshree.in

Thank you for building with Devshree! ⭐⭐⭐⭐⭐`;
}

/**
 * 4b. Build Order Cancellation WhatsApp Message
 */
export function buildOrderCancellationWhatsAppMessage(order, reason = '') {
  const invNum = order.invoiceNumber || 'INV-DEV';
  const custName = order.customerName || 'Customer';
  const reasonText = reason || order.cancellationReason || 'Inventory update / Administrative cancellation';

  return `🚫 *ORDER CANCELLED — DEVSHREE HARDWARE*
━━━━━━━━━━━━━━━━━━━━━━━━
Dear *${custName}*,

We regret to inform you that order (*${invNum}*) has been cancelled by our store administrator.

📋 *Cancellation Summary:*
• *Invoice Number:* ${invNum}
• *Date:* ${new Date(order.createdAtIso || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
• *Reason:* ${reasonText}
• *Payment Mode:* ${order.paymentMethod || 'COD'}
• *Settlement:* ${(order.paymentMethod || '').includes('Cash') ? 'No payment collected (Cash on Delivery).' : 'Any prepaid charges will be reversed to your account within 3-5 business days.'}

If you have any questions or would like to re-order an alternative item, please reply directly to this WhatsApp message or call us at 📞 +91 88661 30409.

We sincerely apologize for any inconvenience caused. 🛠️`;
}

/**
 * 4b. Build Customer Order Cancellation Request WhatsApp Message
 */
export function buildCustomerCancellationRequestWhatsAppMessage(order, reason = '') {
  const invNum = order.invoiceNumber || order.id || 'INV-DEV';
  const custName = order.customerName || 'Customer';
  const reasonText = reason || 'Customer requested order cancellation';

  return `🚫 *ORDER CANCELLATION NOTIFICATION — DEVSHREE HARDWARE*
━━━━━━━━━━━━━━━━━━━━━━━━
Hello Devshree Team,

I have cancelled my order on your portal and am requesting confirmation & refund:

📋 *Order Details:*
• *Invoice Number:* ${invNum}
• *Customer Name:* ${custName}
• *Date:* ${new Date(order.createdAtIso || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
• *Payment Mode:* ${order.paymentMethod || 'Cash on Delivery (COD)'}
• *Amount:* ${formatINR(order.total || 0)}
• *Reason:* ${reasonText}

Please confirm order cancellation and reverse payment if prepaid. Thank you! 🛠️`;
}

/**
 * 5. Build Compact 160-Character SMS Text
 */
export function buildOrderSmsText(order) {
  const invNum = order.invoiceNumber || 'INV-DEV';
  const total = order.total || 0;
  const method = (order.paymentMethod || 'COD').includes('Cash') ? 'COD' : 'Paid';

  return `DEVSHREE: Order ${invNum} Confirmed! Rs.${total} (${method}). Dispatch within 24h. Track: https://devshree.in/track?id=${invNum} Help: 8866130409`;
}

/**
 * 6. Direct Universal WhatsApp Chat Launcher
 * Uses official Meta wa.me Click-to-Chat deep links with popup-blocker resilience
 */
export function openWhatsAppChat(phone, message) {
  const cleanPhone = cleanIndianPhone(phone);
  const encodedText = encodeURIComponent(message || '');
  // wa.me is the universal format across iOS, Android, and Desktop
  const url = cleanPhone 
    ? `https://wa.me/${cleanPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;

  // 1. Attempt standard window.open
  let newWin = null;
  try {
    newWin = window.open(url, '_blank', 'noopener,noreferrer');
  } catch (err) {
    console.warn('[WhatsApp] Direct window.open failed:', err);
  }

  // 2. If blocked by browser popup blocker or returned null (e.g. inside async callbacks)
  if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
    try {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => a.remove(), 250);
    } catch (_) {
      // 3. Fallback: navigate directly
      window.location.assign(url);
    }
  }
}

/**
 * 6c. Get Store Owner Direct WhatsApp Deep-Link URL
 * @param {Object} order
 * @returns {string}
 */
export function getStoreOwnerWhatsAppUrl(order) {
  const ownerPhone = getStoreOwnerPhone(); // 918866130409
  const message = buildStoreOwnerOrderWhatsAppMessage(order);
  const cleanPhone = cleanIndianPhone(ownerPhone);
  const encodedText = encodeURIComponent(message || '');
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}

/**
 * 6d. Automated / Direct Store Owner WhatsApp Notification Dispatch
 * Gives the shop owner (+91 88661 30409) notification on WhatsApp when an order is placed
 * - Triggers automated Webhook if configured
 * - Opens WhatsApp with pre-filled order dispatch alert if requested
 * @param {Object} order
 * @param {Object} [options]
 * @param {boolean} [options.openChat=false]
 * @returns {Promise<Object>}
 */
export async function notifyStoreOwnerOrderPlaced(order, options = { openChat: false }) {
  if (!order) return null;
  const ownerPhone = getStoreOwnerPhone(); // default 918866130409
  const message = buildStoreOwnerOrderWhatsAppMessage(order);
  const webhookUrl = getStorage('devshree_wa_webhook_url', '');
  const waUrl = getStoreOwnerWhatsAppUrl(order);

  console.log(`[WhatsApp Service] Preparing WhatsApp notification for Shop Owner (+${ownerPhone}) for order ${order.invoiceNumber}...`);

  // Record dispatch in local log
  try {
    const dispatchRecord = {
      invoiceNumber: order.invoiceNumber,
      ownerPhone: ownerPhone,
      timestamp: Date.now(),
      status: 'prepared'
    };
    setStorage('devshree_last_owner_wa_notification', dispatchRecord);
  } catch (_) {}

  // 1. If Webhook URL is configured in Admin Settings, automatically POST order payload
  if (webhookUrl) {
    try {
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'new_order_placed',
          recipient: 'store_owner',
          phone: ownerPhone,
          message: message,
          invoiceNumber: order.invoiceNumber,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          total: order.total,
          itemsCount: (order.itemsSnapshot || []).length,
          orderSnapshot: order,
          timestamp: Date.now()
        })
      }).then(() => {
        console.log('[WhatsApp Service] Webhook notification dispatched to:', webhookUrl);
      }).catch(err => {
        console.warn('[WhatsApp Service] Webhook dispatch error:', err);
      });
    } catch (whErr) {
      console.warn('[WhatsApp Service] Webhook trigger error:', whErr);
    }
  }

  // 2. Open WhatsApp chat to store owner if requested
  if (options.openChat) {
    try {
      openWhatsAppChat(ownerPhone, message);
    } catch (openErr) {
      console.warn('[WhatsApp Service] Failed to open WhatsApp chat window:', openErr);
    }
  }

  return {
    phone: ownerPhone,
    message: message,
    waUrl: waUrl,
    webhookSent: !!webhookUrl
  };
}

/**
 * 6b. Direct Mobile Device SMS App Launcher
 * Opens the native SMS / Messages app on smartphones & PCs with the pre-filled text
 */
export function openDeviceSmsApp(phone, message) {
  const cleanPhone = cleanIndianPhone(phone);
  const encodedText = encodeURIComponent(message);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const separator = isIOS ? ';' : '?';
  const url = `sms:${cleanPhone}${separator}body=${encodedText}`;
  window.open(url, '_blank');
}

/**
 * 7. Legacy SMS Fallback (Safe stub - WhatsApp is exclusively used)
 */
export async function sendOrderSmsViaGateway(phone, message) {
  const cleanPhone = cleanIndianPhone(phone);
  console.log(`[Devshree Notification] WhatsApp is preferred. Target: +${cleanPhone}`);
  return true;
}

/**
 * 8. Open Interactive WhatsApp & SMS Dispatcher Modal
 * @param {Object} order
 * @param {'customer'|'owner'} defaultRecipient
 */
export function openWhatsAppDispatchModal(order, defaultRecipient = 'customer') {
  if (!order) return;

  let modal = document.getElementById('whatsapp-dispatch-modal');
  if (!modal) {
    modal = createWhatsAppDispatchModalDOM();
  }

  const customerPhone = cleanIndianPhone(order.customerPhone) || '';
  const ownerPhone = getStoreOwnerPhone();

  let activeRecipient = defaultRecipient; // 'customer' or 'owner'
  let activeTemplate = (order && order.orderStatus === 'Cancelled') ? 'cancelled' : 'confirm';

  const phoneInput = modal.querySelector('#wa-recipient-phone');
  const recipientPills = modal.querySelectorAll('.wa-recipient-pill');
  const templatePills = modal.querySelectorAll('.wa-template-pill');
  const messageBox = modal.querySelector('#wa-message-textarea');
  const charCount = modal.querySelector('#wa-char-count');
  const sendWaBtn = modal.querySelector('#wa-send-btn');
  const copyBtn = modal.querySelector('#wa-copy-btn');
  const closeBtn = modal.querySelector('#wa-modal-close-btn');

  // Update Preview Message
  const updateMessageContent = () => {
    let msg = '';
    if (activeRecipient === 'owner') {
      phoneInput.value = ownerPhone;
      msg = buildStoreOwnerOrderWhatsAppMessage(order);
    } else {
      phoneInput.value = customerPhone || '91';
      if (activeTemplate === 'confirm') {
        msg = buildCustomerOrderWhatsAppMessage(order);
      } else if (activeTemplate === 'dispatch') {
        msg = buildShippingWhatsAppMessage(order);
      } else if (activeTemplate === 'delivered') {
        msg = buildDeliveryWhatsAppMessage(order);
      } else if (activeTemplate === 'cancelled') {
        msg = buildOrderCancellationWhatsAppMessage(order);
      }
    }

    messageBox.value = msg;
    charCount.textContent = `${msg.length} characters`;
  };

  // Recipient selection
  recipientPills.forEach(pill => {
    pill.classList.toggle('active', pill.dataset.recipient === activeRecipient);
    pill.onclick = () => {
      recipientPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeRecipient = pill.dataset.recipient;
      updateMessageContent();
    };
  });

  // Template selection
  templatePills.forEach(pill => {
    pill.classList.toggle('active', pill.dataset.template === activeTemplate);
    pill.onclick = () => {
      templatePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeTemplate = pill.dataset.template;
      updateMessageContent();
    };
  });

  // Initial Content
  updateMessageContent();

  messageBox.oninput = () => {
    charCount.textContent = `${messageBox.value.length} characters`;
  };

  // Send via WhatsApp
  sendWaBtn.onclick = () => {
    const targetPhone = phoneInput.value.trim();
    if (!targetPhone) {
      showToast('Please enter a valid phone number.', 'error');
      return;
    }
    openWhatsAppChat(targetPhone, messageBox.value);
    showToast('Opening WhatsApp with your order message...', 'info');
    modal.classList.remove('active');
    document.body.style.overflow = '';
  };

  // Copy to Clipboard
  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(messageBox.value);
      showToast('Message copied to clipboard!', 'success');
    } catch (_) {
      messageBox.select();
      document.execCommand('copy');
      showToast('Message copied to clipboard!', 'success');
    }
  };

  // Close handlers
  const closeModal = () => {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  };

  closeBtn.onclick = closeModal;
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

/**
 * 9. Create WhatsApp Dispatcher Modal in DOM if not present
 */
function createWhatsAppDispatchModalDOM() {
  const modalWrap = document.createElement('div');
  modalWrap.id = 'whatsapp-dispatch-modal';
  modalWrap.className = 'modal-backdrop wa-dispatch-backdrop';
  modalWrap.setAttribute('role', 'dialog');
  modalWrap.setAttribute('aria-modal', 'true');

  modalWrap.innerHTML = `
    <div class="modal-content wa-dispatch-box">
      <button type="button" class="modal-close-btn" id="wa-modal-close-btn" aria-label="Close dialog">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <div class="wa-dispatch-header">
        <div class="wa-icon-bubble">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24zm4.52 11.53c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.38-.44.13-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.45 1.03 2.62.13.17 1.77 2.71 4.29 3.8.6.26 1.07.41 1.44.53.61.19 1.16.17 1.6.1 1.02-.15 1.47-.83 1.68-1.16.21-.34.21-.63.15-.76-.07-.13-.25-.2-.5-.33z"/>
          </svg>
        </div>
        <div>
          <h3 class="wa-dispatch-title">WhatsApp Order Dispatcher</h3>
          <p class="wa-dispatch-sub">Send official order receipts, tracking notifications, and trade dispatch updates via WhatsApp.</p>
        </div>
      </div>

      <div class="wa-dispatch-body">
        <!-- Recipient Selector -->
        <div class="wa-form-row">
          <label class="wa-label">Select Recipient:</label>
          <div class="wa-pills-row">
            <button type="button" class="wa-recipient-pill active" data-recipient="customer">
              👤 Customer Phone
            </button>
            <button type="button" class="wa-recipient-pill" data-recipient="owner">
              🏢 Store Owner / Dispatch Hub
            </button>
          </div>
        </div>

        <!-- Phone Input -->
        <div class="wa-form-row">
          <label class="wa-label" for="wa-recipient-phone">Destination Mobile Number (with country code):</label>
          <div class="wa-phone-input-wrap">
            <span class="wa-phone-prefix">+</span>
            <input type="tel" id="wa-recipient-phone" class="form-control wa-phone-input" placeholder="919825012345" />
          </div>
        </div>

        <!-- Message Template Selector -->
        <div class="wa-form-row">
          <label class="wa-label">Message Template:</label>
          <div class="wa-pills-row wa-templates-grid">
            <button type="button" class="wa-template-pill active" data-template="confirm">
              📝 Order Confirmation Receipt
            </button>
            <button type="button" class="wa-template-pill" data-template="dispatch">
              🚚 Dispatch &amp; Live Tracking
            </button>
            <button type="button" class="wa-template-pill" data-template="delivered">
              ✅ Delivery Completed
            </button>
            <button type="button" class="wa-template-pill" data-template="cancelled" style="color:#DC2626;">
              🚫 Cancellation Notice
            </button>
          </div>
        </div>

        <!-- Message Box -->
        <div class="wa-form-row">
          <div class="wa-message-header">
            <label class="wa-label" for="wa-message-textarea">Message Content Preview (Editable):</label>
            <span class="wa-char-count" id="wa-char-count">0 characters</span>
          </div>
          <textarea id="wa-message-textarea" class="form-control wa-textarea" rows="8"></textarea>
        </div>
      </div>

      <div class="wa-dispatch-footer">
        <button type="button" class="btn btn-outline" id="wa-copy-btn">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy Text
        </button>

        <button type="button" class="btn btn-primary btn-wa-send" id="wa-send-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24zm4.52 11.53c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.38-.44.13-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.45 1.03 2.62.13.17 1.77 2.71 4.29 3.8.6.26 1.07.41 1.44.53.61.19 1.16.17 1.6.1 1.02-.15 1.47-.83 1.68-1.16.21-.34.21-.63.15-.76-.07-.13-.25-.2-.5-.33z"/>
          </svg>
          Open in WhatsApp &rarr;
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modalWrap);
  return modalWrap;
}
