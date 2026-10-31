/**
 * DEVSHREE — REAL-TIME ORDER NOTIFICATION SYSTEM
 * Provides audio chime alerts, native browser desktop push notifications,
 * floating in-app notification banners, persistent notification log,
 * and cross-tab/Firestore real-time synchronization.
 */

import { formatINR, escapeHTML, getStorage, setStorage } from './utils.js';

const NOTIF_STORAGE_KEY = 'devshree_order_notifications';
const SOUND_PREF_KEY = 'devshree_notif_sound_enabled';
const BROADCAST_CHANNEL_NAME = 'devshree_orders_broadcast';

// Unique Tab Session ID to prevent self-broadcasting loops across channels
const SESSION_TAB_ID = 'tab_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();

// Global In-Memory Deduplication Cache (Prevents duplicate triggers within 45 seconds)
const recentOrderTriggers = new Map();
const DEDUPE_WINDOW_MS = 45000;
const SESSION_NOTIF_KEY = 'devshree_recent_notified_orders';

function getSessionNotifiedMap() {
  try {
    const raw = sessionStorage.getItem(SESSION_NOTIF_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function recordSessionNotifiedKey(key) {
  if (!key) return;
  try {
    const map = getSessionNotifiedMap();
    map[key] = Date.now();
    // Prune entries older than 2 minutes
    const cutoff = Date.now() - 120000;
    for (const k in map) {
      if (map[k] < cutoff) delete map[k];
    }
    sessionStorage.setItem(SESSION_NOTIF_KEY, JSON.stringify(map));
  } catch (_) {}
}

export function isOrderAlreadyNotified(order) {
  if (!order) return false;
  const now = Date.now();
  const keys = [order.invoiceNumber, order.id].filter(Boolean);
  if (keys.length === 0) return false;

  // Check in-memory map
  for (const k of keys) {
    const last = recentOrderTriggers.get(k);
    if (last && (now - last) < DEDUPE_WINDOW_MS) return true;
  }

  // Check sessionStorage
  const sessionMap = getSessionNotifiedMap();
  for (const k of keys) {
    const last = sessionMap[k];
    if (last && (now - last) < DEDUPE_WINDOW_MS) return true;
  }

  return false;
}

function markOrderAsNotified(order) {
  if (!order) return;
  const now = Date.now();
  const keys = [order.invoiceNumber, order.id].filter(Boolean);
  for (const k of keys) {
    recentOrderTriggers.set(k, now);
    recordSessionNotifiedKey(k);
  }

  // Prune in-memory map
  if (recentOrderTriggers.size > 80) {
    for (const [k, ts] of recentOrderTriggers.entries()) {
      if (now - ts > 90000) recentOrderTriggers.delete(k);
    }
  }
}

// Shared BroadcastChannel Singleton
let sharedBroadcastChannel = null;
function getSharedBroadcastChannel() {
  if ('BroadcastChannel' in window) {
    if (!sharedBroadcastChannel) {
      try {
        sharedBroadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      } catch (e) {
        console.warn('[Notifications] BroadcastChannel init error:', e);
      }
    }
  }
  return sharedBroadcastChannel;
}

/**
 * Check if current page/session belongs to Store Admin or Shop Owner
 * Order placement audio chimes, desktop push alerts, and floating banners
 * are strictly restricted to Admin/Owner and NEVER displayed to customers.
 * @returns {boolean}
 */
export function isCurrentContextAdmin() {
  if (typeof window === 'undefined') return false;

  // 1. Check current URL (admin.html or /admin path)
  const pathname = (window.location.pathname || '').toLowerCase();
  const href = (window.location.href || '').toLowerCase();
  if (pathname.includes('admin') || href.includes('admin.html') || pathname.includes('/admin')) {
    return true;
  }

  // 2. Check local authenticated user role or email
  try {
    const raw = localStorage.getItem('devshree_current_user');
    if (raw) {
      const u = JSON.parse(raw);
      if (u) {
        if (u.role === 'admin' || u.isAdmin === true) return true;
        const email = (u.email || '').trim().toLowerCase();
        if (
          email.includes('admin') || 
          email.endsWith('@devshree.in') || 
          email === 'devshree@gmail.com'
        ) {
          return true;
        }
      }
    }
  } catch (_) {}

  // 3. Admin session token
  if (sessionStorage.getItem('devshree_admin_authenticated') === 'true') {
    return true;
  }

  return false;
}

// Audio Context Singleton for synthetic chime
let audioCtx = null;

/**
 * 1. Play Multi-Tone Melodic Chime using Web Audio API
 * (Only audible for Admin / Shop Owner)
 */
export function playOrderNotificationSound() {
  if (!isCurrentContextAdmin()) return;
  const soundEnabled = getStorage(SOUND_PREF_KEY, true);
  if (!soundEnabled) return;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;

    // First Note: D5 (587.33 Hz)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.35, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Second Note: A5 (880.00 Hz) - higher celebratory chime
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.00, now + 0.12);

    gain2.gain.setValueAtTime(0.001, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.4, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.7);

    // Third Sub-Harmonic for warmth: F#5 (739.99 Hz)
    const osc3 = audioCtx.createOscillator();
    const gain3 = audioCtx.createGain();
    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(739.99, now + 0.22);

    gain3.gain.setValueAtTime(0.001, now + 0.22);
    gain3.gain.exponentialRampToValueAtTime(0.2, now + 0.25);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc3.connect(gain3);
    gain3.connect(audioCtx.destination);
    osc3.start(now + 0.22);
    osc3.stop(now + 0.65);
  } catch (err) {
    console.warn('[Notifications] Audio chime play blocked or unsupported:', err);
  }
}

/**
 * 2. Native Desktop / Browser Push Notifications
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (e) {
      console.warn('[Notifications] Error requesting desktop notification permission:', e);
    }
  }
  return false;
}

export function sendDesktopNotification(order) {
  if (!isCurrentContextAdmin()) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const itemsCount = (order.itemsSnapshot || []).reduce((sum, i) => sum + (i.quantity || 1), 0);
  const firstItem = (order.itemsSnapshot && order.itemsSnapshot[0]) 
    ? (order.itemsSnapshot[0].name || 'Supply item')
    : 'Hardware supplies';
  const itemSummary = itemsCount > 1 ? `${firstItem} + ${itemsCount - 1} more` : firstItem;

  const title = `🔔 New Order: ${order.invoiceNumber || 'Confirmed Order'}`;
  const body = `₹${Number(order.total || 0).toLocaleString('en-IN')} received from ${order.customerName || 'Customer'}\nItems: ${itemSummary}`;

  try {
    const notif = new Notification(title, {
      body: body,
      icon: 'assets/images/logo.png',
      badge: 'assets/images/logo.png',
      tag: `order-${order.invoiceNumber || order.id || Date.now()}`,
      renotify: true
    });

    notif.onclick = () => {
      window.focus();
      if (window.location.pathname.includes('admin')) {
        const ordersTabBtn = document.getElementById('nav-orders');
        ordersTabBtn?.click();
      }
      notif.close();
    };
  } catch (err) {
    console.warn('[Notifications] Native notification display error:', err);
  }
}

/**
 * 3. In-App Floating Order Notification Banner (Admin / Shop Owner Only)
 */
export function showOrderNotificationBanner(order) {
  if (!isCurrentContextAdmin()) return;
  let container = document.getElementById('devshree-order-alert-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'devshree-order-alert-container';
    container.className = 'order-alert-container';
    document.body.appendChild(container);
  }

  const invoiceKey = order.invoiceNumber || order.id || '';
  const orderId = order.id || '';
  // Prevent duplicate banner alert if already displayed on screen
  if (
    (invoiceKey && container.querySelector(`[data-invoice="${invoiceKey}"]`)) ||
    (orderId && container.querySelector(`[data-order-id="${orderId}"]`))
  ) {
    console.log(`[Notifications] In-app banner for ${invoiceKey || orderId} already visible on screen.`);
    return;
  }

  const itemsCount = (order.itemsSnapshot || []).reduce((sum, i) => sum + (i.quantity || 1), 0);
  const itemsText = (order.itemsSnapshot || []).slice(0, 2).map(i => `${i.quantity || 1}x ${i.name || 'Item'}`).join(', ');
  const itemsRemaining = (order.itemsSnapshot || []).length > 2 ? ` + ${(order.itemsSnapshot || []).length - 2} more` : '';
  const dateStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const card = document.createElement('div');
  card.className = 'order-alert-card';
  if (invoiceKey) {
    card.setAttribute('data-invoice', invoiceKey);
  }
  if (orderId) {
    card.setAttribute('data-order-id', orderId);
  }
  card.innerHTML = `
    <div class="order-alert-glow"></div>
    <div class="order-alert-header">
      <div class="order-alert-tag">
        <span class="order-alert-pulse"></span>
        <span>NEW ORDER RECEIVED</span>
      </div>
      <span class="order-alert-time">${dateStr}</span>
      <button type="button" class="order-alert-close" aria-label="Dismiss alert">&times;</button>
    </div>

    <div class="order-alert-body">
      <div class="order-alert-icon-wrap">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <path d="M16 10a4 4 0 0 1-8 0"></path>
        </svg>
      </div>
      <div class="order-alert-content">
        <div class="order-alert-invoice">${escapeHTML(order.invoiceNumber || 'INV-DEV')}</div>
        <div class="order-alert-customer">
          <strong>${escapeHTML(order.customerName || 'Customer')}</strong>
          ${order.customerPhone ? `&bull; ${escapeHTML(order.customerPhone)}` : ''}
        </div>
        <div class="order-alert-summary">${escapeHTML(itemsText + itemsRemaining)} (${itemsCount} units)</div>
        <div class="order-alert-price">${formatINR(order.total || 0)}</div>
      </div>
    </div>

    <div class="order-alert-actions">
      <button type="button" class="btn-order-alert-view">View Order Details</button>
      <button type="button" class="btn-order-alert-wa" title="Open Store Owner WhatsApp Dispatch Alert">WhatsApp 📲</button>
      <button type="button" class="btn-order-alert-dismiss">Dismiss</button>
    </div>
    <div class="order-alert-progress"></div>
  `;

  const close = () => {
    card.classList.add('leaving');
    setTimeout(() => {
      card.remove();
    }, 350);
  };

  card.querySelector('.order-alert-close')?.addEventListener('click', close);
  card.querySelector('.btn-order-alert-dismiss')?.addEventListener('click', close);

  card.querySelector('.btn-order-alert-wa')?.addEventListener('click', () => {
    import('./whatsapp-service.js').then(module => {
      if (module.openWhatsAppDispatchModal) {
        // Open modal with Shop Owner alert ready by default
        module.openWhatsAppDispatchModal(order, 'owner');
      }
    }).catch(err => console.warn('[Notifications] WhatsApp modal load error:', err));
  });

  card.querySelector('.btn-order-alert-view')?.addEventListener('click', () => {
    close();
    if (window.location.pathname.includes('admin')) {
      const ordersTabBtn = document.getElementById('nav-orders');
      ordersTabBtn?.click();
      const searchInput = document.getElementById('admin-orders-search');
      if (searchInput && order.invoiceNumber) {
        searchInput.value = order.invoiceNumber;
        searchInput.dispatchEvent(new Event('input'));
      }
    } else {
      // In Storefront: open User Invoices modal or tracking modal
      import('./orders.js').then(module => {
        if (module.openInvoiceViewer) {
          module.openInvoiceViewer(order);
        }
      }).catch(err => console.warn(err));
    }
  });

  container.prepend(card);

  // Auto-dismiss after 12s
  setTimeout(() => {
    if (card.parentElement) {
      close();
    }
  }, 12000);
}

/**
 * 4. Persistent Notification Log Storage
 */
export function getStoredNotifications() {
  return getStorage(NOTIF_STORAGE_KEY, []);
}

export function saveNotificationRecord(order) {
  const list = getStoredNotifications();
  const newRecord = {
    id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    invoiceNumber: order.invoiceNumber || `INV-DEV-${Date.now()}`,
    customerName: order.customerName || 'Customer',
    customerPhone: order.customerPhone || '',
    total: order.total || 0,
    itemsCount: (order.itemsSnapshot || []).reduce((sum, i) => sum + (i.quantity || 1), 0),
    timestamp: Date.now(),
    read: false,
    orderSnapshot: order
  };

  // Avoid duplicate notifications for exact same invoice
  const exists = list.some(item => item.invoiceNumber === newRecord.invoiceNumber);
  if (!exists) {
    list.unshift(newRecord);
    if (list.length > 40) list.pop(); // Keep latest 40
    setStorage(NOTIF_STORAGE_KEY, list);
  }
  return newRecord;
}

export function getUnreadOrderNotificationsCount() {
  const list = getStoredNotifications();
  return list.filter(n => !n.read).length;
}

export function markNotificationAsRead(notifId) {
  const list = getStoredNotifications();
  const item = list.find(n => n.id === notifId);
  if (item) {
    item.read = true;
    setStorage(NOTIF_STORAGE_KEY, list);
    updateNotificationBadges();
  }
}

export function markAllNotificationsAsRead() {
  const list = getStoredNotifications();
  list.forEach(n => n.read = true);
  setStorage(NOTIF_STORAGE_KEY, list);
  updateNotificationBadges();
  renderAdminNotificationMenu();
}

export function clearAllNotifications() {
  setStorage(NOTIF_STORAGE_KEY, []);
  updateNotificationBadges();
  renderAdminNotificationMenu();
}

/**
 * 5. Update Badge Counters Across Topbars
 */
export function updateNotificationBadges() {
  const unreadCount = getUnreadOrderNotificationsCount();

  // Admin Topbar Badge
  const adminBadge = document.getElementById('admin-notif-badge');
  if (adminBadge) {
    if (unreadCount > 0) {
      adminBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
      adminBadge.style.display = 'inline-flex';
      adminBadge.classList.add('pulsing');
    } else {
      adminBadge.style.display = 'none';
      adminBadge.classList.remove('pulsing');
    }
  }

  // Sidebar Orders Badge (optional sync)
  const navOrdersCount = document.getElementById('nav-orders-count');
  if (navOrdersCount && unreadCount > 0) {
    navOrdersCount.title = `${unreadCount} unread order notifications`;
  }
}

/**
 * 6. Central Order Notification Trigger (Invoked when any order arrives)
 */
export function triggerOrderNotification(order, options = { broadcast: true, save: true }) {
  if (!order) return;

  // Deduplication check: Suppress repeated triggers across tabs and multiple events
  if (isOrderAlreadyNotified(order)) {
    const key = order.invoiceNumber || order.id || 'order';
    console.log(`[Notifications] Deduplication active: Suppressing duplicate trigger for ${key}`);
    return;
  }
  markOrderAsNotified(order);

  const now = Date.now();

  // 1. Save to persistent log (for admin history)
  if (options.save !== false) {
    saveNotificationRecord(order);
  }

  // 2. Broadcast across other tabs/windows so admin panel receives it in real time
  if (options.broadcast !== false) {
    try {
      const channel = getSharedBroadcastChannel();
      if (channel) {
        channel.postMessage({ 
          type: 'ORDER_RECEIVED', 
          order, 
          senderTabId: SESSION_TAB_ID,
          timestamp: now 
        });
      } else {
        localStorage.setItem('devshree_last_order_event', JSON.stringify({
          order,
          senderTabId: SESSION_TAB_ID,
          timestamp: now
        }));
      }
    } catch (e) {
      console.warn('[Notifications] Cross-tab broadcast error:', e);
    }
  }

  // CRITICAL: Visual and audio order arrival notifications (sound chime, desktop push, floating banner)
  // MUST ONLY show for Store Admin / Shop Owner. Customers must NEVER see or hear them!
  if (!isCurrentContextAdmin()) {
    console.log('[Notifications] Customer context: Suppressed store owner order alert chime & banner.');
    return;
  }

  // 3. Play Melodic Audio Chime (Admin Only)
  playOrderNotificationSound();

  // 4. Desktop / OS Notification (Admin Only)
  sendDesktopNotification(order);

  // 5. In-App Floating Banner Alert (Admin Only)
  showOrderNotificationBanner(order);

  // 6. Update UI Badges in Admin Console
  updateNotificationBadges();
  renderAdminNotificationMenu();
}

let isListenerConfigured = false;

/**
 * 7. Cross-Tab & Storage Listener Setup
 */
export function setupOrderNotificationsListener() {
  if (isListenerConfigured) return;
  isListenerConfigured = true;

  // If BroadcastChannel is supported, use it exclusively (prevents double firing with storage event)
  const channel = getSharedBroadcastChannel();
  if (channel) {
    channel.onmessage = (event) => {
      if (
        event.data && 
        event.data.type === 'ORDER_RECEIVED' && 
        event.data.order &&
        event.data.senderTabId !== SESSION_TAB_ID
      ) {
        // If current tab is NOT an Admin or Shop Owner, do not trigger audio/banner alert
        if (!isCurrentContextAdmin()) return;
        triggerOrderNotification(event.data.order, { broadcast: false, save: true });
      }
    };
  } else {
    // Fallback storage listener ONLY when BroadcastChannel is unavailable
    window.addEventListener('storage', (e) => {
      if (e.key === 'devshree_last_order_event' && e.newValue) {
        try {
          const payload = JSON.parse(e.newValue);
          if (
            payload && 
            payload.order && 
            payload.senderTabId !== SESSION_TAB_ID &&
            (Date.now() - (payload.timestamp || 0)) < 30000
          ) {
            // If current tab is NOT an Admin or Shop Owner, do not trigger audio/banner alert
            if (!isCurrentContextAdmin()) return;
            triggerOrderNotification(payload.order, { broadcast: false, save: true });
          }
        } catch (err) {
          console.warn('[Notifications] Storage event parse error:', err);
        }
      }
    });
  }

  // Initial badge update (only in admin)
  if (isCurrentContextAdmin()) {
    updateNotificationBadges();
  }
}

/**
 * 8. Admin Notification Center UI (Dropdown & Actions in admin.html)
 */
export function initAdminNotificationCenter() {
  const notifBtn = document.getElementById('admin-notif-btn');
  const notifDropdown = document.getElementById('admin-notif-dropdown');
  const notifMenu = document.getElementById('admin-notif-menu');

  if (!notifBtn || !notifMenu) return;

  // Toggle Dropdown
  notifBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    notifDropdown?.classList.toggle('active');
    if (notifDropdown?.classList.contains('active')) {
      renderAdminNotificationMenu();
    }
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (notifDropdown && !notifDropdown.contains(e.target)) {
      notifDropdown.classList.remove('active');
    }
  });

  // Initial Render
  updateNotificationBadges();
  setupOrderNotificationsListener();
}

/**
 * 9. Render Admin Notification Dropdown Menu Content
 */
export function renderAdminNotificationMenu() {
  const notifMenu = document.getElementById('admin-notif-menu');
  if (!notifMenu) return;

  const notifications = getStoredNotifications();
  const unreadCount = getUnreadOrderNotificationsCount();
  const soundEnabled = getStorage(SOUND_PREF_KEY, true);
  const desktopPermission = ('Notification' in window) ? Notification.permission : 'unsupported';

  let itemsHtml = '';
  if (notifications.length === 0) {
    itemsHtml = `
      <div class="admin-notif-empty">
        <div class="admin-notif-empty-icon">🔔</div>
        <strong>No order alerts yet</strong>
        <p>You will receive live audio and desktop notifications when customers place orders.</p>
        <button type="button" class="btn-notif-test" id="btn-notif-empty-test">
          Send Sample Order Alert
        </button>
      </div>
    `;
  } else {
    itemsHtml = notifications.map(n => {
      const timeStr = formatRelativeTime(n.timestamp);
      return `
        <div class="admin-notif-item ${n.read ? 'read' : 'unread'}" data-notif-id="${n.id}">
          <div class="admin-notif-item-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
          </div>
          <div class="admin-notif-item-body">
            <div class="admin-notif-item-title">
              <strong>${escapeHTML(n.invoiceNumber)}</strong>
              <span class="admin-notif-item-amount">${formatINR(n.total)}</span>
            </div>
            <div class="admin-notif-item-desc">
              ${escapeHTML(n.customerName)} &bull; ${n.itemsCount} item(s)
            </div>
            <div class="admin-notif-item-meta">
              <span>${timeStr}</span>
              <button type="button" class="btn-notif-wa-quick" data-wa-notif-id="${n.id}" title="Send WhatsApp Update">
                <span>WA 📲</span>
              </button>
              ${!n.read ? `<span class="admin-notif-unread-dot"></span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  notifMenu.innerHTML = `
    <div class="admin-notif-header">
      <div class="admin-notif-header-title">
        <h4>Order Alerts</h4>
        ${unreadCount > 0 ? `<span class="admin-notif-pill">${unreadCount} New</span>` : ''}
      </div>
      <div class="admin-notif-header-actions">
        ${unreadCount > 0 ? `<button type="button" class="btn-notif-header-action" id="btn-notif-mark-read">Mark all read</button>` : ''}
        <button type="button" class="btn-notif-header-action" id="btn-notif-clear-all" title="Clear all alerts">Clear</button>
      </div>
    </div>

    <!-- Quick Preferences Bar -->
    <div class="admin-notif-toolbar">
      <button type="button" class="btn-notif-tool ${soundEnabled ? 'active' : ''}" id="btn-toggle-sound" title="${soundEnabled ? 'Chime sound is active' : 'Chime sound is muted'}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${soundEnabled 
            ? '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>'
            : '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>'}
        </svg>
        <span>Sound: ${soundEnabled ? 'On' : 'Muted'}</span>
      </button>

      <button type="button" class="btn-notif-tool ${desktopPermission === 'granted' ? 'granted' : ''}" id="btn-request-desktop-notif">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        <span>${desktopPermission === 'granted' ? 'Desktop: Enabled' : 'Enable Desktop'}</span>
      </button>

      <button type="button" class="btn-notif-tool test" id="btn-send-test-notif" title="Test audio, toast & desktop alert">
        <span>⚡ Test Alert</span>
      </button>
    </div>

    <div class="admin-notif-list">
      ${itemsHtml}
    </div>
  `;

  // Bind Listeners in Menu
  document.getElementById('btn-notif-mark-read')?.addEventListener('click', () => {
    markAllNotificationsAsRead();
  });

  document.getElementById('btn-notif-clear-all')?.addEventListener('click', () => {
    if (confirm('Clear all order notifications?')) {
      clearAllNotifications();
    }
  });

  document.getElementById('btn-toggle-sound')?.addEventListener('click', () => {
    const current = getStorage(SOUND_PREF_KEY, true);
    setStorage(SOUND_PREF_KEY, !current);
    if (!current) playOrderNotificationSound();
    renderAdminNotificationMenu();
  });

  document.getElementById('btn-request-desktop-notif')?.addEventListener('click', async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      sendDesktopNotification({
        invoiceNumber: 'INV-DEV-TEST',
        customerName: 'Devshree Admin',
        total: 1000,
        itemsSnapshot: [{ name: 'Test Notification Access', quantity: 1 }]
      });
    }
    renderAdminNotificationMenu();
  });

  document.getElementById('btn-send-test-notif')?.addEventListener('click', () => {
    sendTestOrderNotification();
  });

  document.getElementById('btn-notif-empty-test')?.addEventListener('click', () => {
    sendTestOrderNotification();
  });

  // Bind quick WhatsApp dispatch in notification items
  notifMenu.querySelectorAll('.btn-notif-wa-quick').forEach(waBtn => {
    waBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const notifId = waBtn.dataset.waNotifId;
      const notifs = getStoredNotifications();
      const target = notifs.find(n => n.id === notifId);
      if (target && target.orderSnapshot) {
        import('./whatsapp-service.js').then(module => {
          if (module.openWhatsAppDispatchModal) {
            module.openWhatsAppDispatchModal(target.orderSnapshot, 'owner');
          }
        }).catch(err => console.warn('[Notifications] WhatsApp modal load error:', err));
      }
    });
  });

  // Bind Item Clicks to view details
  notifMenu.querySelectorAll('.admin-notif-item').forEach(itemEl => {
    itemEl.addEventListener('click', () => {
      const id = itemEl.dataset.notifId;
      markNotificationAsRead(id);
      const notifs = getStoredNotifications();
      const target = notifs.find(n => n.id === id);
      if (target && target.orderSnapshot) {
        document.getElementById('admin-notif-dropdown')?.classList.remove('active');
        const ordersTabBtn = document.getElementById('nav-orders');
        ordersTabBtn?.click();
        const searchInput = document.getElementById('admin-orders-search');
        if (searchInput && target.invoiceNumber) {
          searchInput.value = target.invoiceNumber;
          searchInput.dispatchEvent(new Event('input'));
        }
      }
    });
  });
}

/**
 * 10. Generate and Send a Realistic Test Order Notification
 */
export function sendTestOrderNotification() {
  const sampleNames = ['Rajesh Patel', 'Vikramaditya Shah', 'Aarav Mehta', 'Ananya Desai', 'Pooja Trivedi'];
  const sampleItems = [
    { name: 'Brass Bib Cock Tap', quantity: 2, price: 1180 },
    { name: 'LED Bulb 12W Havells', quantity: 4, price: 141.60 },
    { name: 'PVC Pipe 1 inch Astral', quantity: 3, price: 66.30 },
    { name: 'Royale Luxury Wall Paint 1L', quantity: 1, price: 566 }
  ];

  const randomName = sampleNames[Math.floor(Math.random() * sampleNames.length)];
  const randomItems = [sampleItems[Math.floor(Math.random() * sampleItems.length)]];
  if (Math.random() > 0.4) {
    randomItems.push(sampleItems[Math.floor(Math.random() * sampleItems.length)]);
  }

  const subtotal = randomItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const total = Math.round(subtotal * 1.18);
  const invoiceNum = `INV-DEV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const testOrder = {
    invoiceNumber: invoiceNum,
    customerName: randomName,
    customerPhone: `+91 ${Math.floor(9000000000 + Math.random() * 999999999)}`,
    itemsSnapshot: randomItems,
    subtotal: subtotal,
    shippingCost: 0,
    total: total,
    orderStatus: 'Confirmed',
    createdAtIso: new Date().toISOString()
  };

  triggerOrderNotification(testOrder, { broadcast: true, save: true });
}

/**
 * Utility: Relative time string
 */
function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Just now';
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins === 1) return '1 min ago';
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}
