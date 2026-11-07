/**
 * DEVSHREE — STORE MAINTENANCE MODE CONTROLLER
 * 
 * Allows store owner to put the website into maintenance mode while making changes.
 * Features:
 * - Beautiful maintenance screen matching user specifications
 * - Custom headline, message, and estimated uptime
 * - Disconnected cable & plug illustration in responsive SVG
 * - 1-click toggle in Admin topbar & Settings panel
 * - Seamless bypass for authenticated store administrators
 * - Cloud Firestore synchronization with localStorage offline persistence
 */

import { getStorage, setStorage, escapeHTML, showToast } from './utils.js';

export const MAINTENANCE_STORAGE_KEY = 'devshree_maintenance_config';

export const DEFAULT_MAINTENANCE_CONFIG = {
  enabled: false,
  headline: 'The site is currently down for maintenance',
  message: "We apologize for any inconveniences caused. We've almost done.",
  estimatedTime: '',
  contactPhone: '+91 8866130409',
  contactEmail: '',
  updatedAt: new Date().toISOString()
};

/**
 * Get the current maintenance configuration from local storage
 * @returns {Object}
 */
export function getMaintenanceConfig() {
  try {
    const saved = getStorage(MAINTENANCE_STORAGE_KEY, null);
    if (saved && typeof saved === 'object') {
      return { ...DEFAULT_MAINTENANCE_CONFIG, ...saved };
    }
  } catch (_) {}
  return { ...DEFAULT_MAINTENANCE_CONFIG };
}

/**
 * Fetch remote maintenance config from Cloud Firestore (if available)
 * @returns {Promise<Object>}
 */
export async function fetchRemoteMaintenanceConfig() {
  let config = getMaintenanceConfig();

  if (typeof window !== 'undefined') {
    try {
      const fb = await import('./firebase-config.js');
      if (fb.db && fb.doc && fb.getDoc) {
        const docRef = fb.doc(fb.db, 'settings', 'store_config');
        const snap = await fb.getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data && typeof data.maintenance === 'object') {
            config = { ...config, ...data.maintenance };
            setStorage(MAINTENANCE_STORAGE_KEY, config);
          } else if (typeof data.maintenanceMode === 'boolean') {
            config.enabled = data.maintenanceMode;
            if (data.maintenanceHeadline) config.headline = data.maintenanceHeadline;
            if (data.maintenanceMessage) config.message = data.maintenanceMessage;
            if (data.maintenanceEstimatedTime) config.estimatedTime = data.maintenanceEstimatedTime;
            setStorage(MAINTENANCE_STORAGE_KEY, config);
          }
        }
      }
    } catch (err) {
      console.warn('[Maintenance] Firestore fetch skipped / using local cache:', err);
    }
  }

  return config;
}

/**
 * Update maintenance mode state and sync to Cloud Firestore
 * @param {boolean} enabled
 * @param {Object} [options={}]
 * @returns {Promise<Object>}
 */
export async function setMaintenanceMode(enabled, options = {}) {
  const current = getMaintenanceConfig();
  const updated = {
    ...current,
    ...options,
    enabled: Boolean(enabled),
    updatedAt: new Date().toISOString()
  };

  setStorage(MAINTENANCE_STORAGE_KEY, updated);

  // Sync to Cloud Firestore
  if (typeof window !== 'undefined') {
    try {
      const fb = await import('./firebase-config.js');
      if (fb.db && fb.doc && fb.setDoc) {
        await fb.setDoc(fb.doc(fb.db, 'settings', 'store_config'), {
          maintenanceMode: updated.enabled,
          maintenanceHeadline: updated.headline,
          maintenanceMessage: updated.message,
          maintenanceEstimatedTime: updated.estimatedTime,
          maintenance: updated,
          updatedAt: fb.serverTimestamp ? fb.serverTimestamp() : new Date().toISOString()
        }, { merge: true });
        console.log('[Maintenance] Synced state to Cloud Firestore:', updated.enabled);
      }
    } catch (err) {
      console.warn('[Maintenance] Firestore sync error:', err);
    }

    // Broadcast local event
    window.dispatchEvent(new CustomEvent('devshree:maintenance-changed', {
      detail: updated
    }));
  }

  return updated;
}

/**
 * Generates the animated/responsive SVG illustration matching the user's reference image
 * Features a disconnected light-blue power plug on the left and vibrant green socket on the right
 * @returns {string} SVG HTML string
 */
export function getMaintenanceIllustrationSvg() {
  return `
    <svg class="maintenance-illustration" viewBox="0 0 740 180" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Disconnected power cables illustration">
      <!-- Left Cable: Soft Blue Line -->
      <path d="M 0 95 L 160 95 C 175 95 185 105 185 120 L 185 125 C 185 135 195 145 205 145 L 255 145" 
            stroke="#93C5FD" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" />
      
      <!-- Blue Male Plug Body -->
      <g class="maintenance-plug-blue">
        <!-- Base / Handle -->
        <rect x="255" y="123" width="55" height="44" rx="10" fill="#0284C7" />
        <rect x="255" y="123" width="28" height="44" rx="6" fill="#0369A1" />
        <rect x="270" y="130" width="16" height="30" fill="#38BDF8" rx="3" />
        <!-- Ridge Grip -->
        <line x1="262" y1="133" x2="262" y2="157" stroke="#075985" stroke-width="3" stroke-linecap="round" />
        <line x1="268" y1="133" x2="268" y2="157" stroke="#075985" stroke-width="3" stroke-linecap="round" />
        
        <!-- Prongs (Metal Terminals) -->
        <rect x="310" y="130" width="26" height="10" rx="3" fill="#38BDF8" />
        <rect x="310" y="150" width="26" height="10" rx="3" fill="#38BDF8" />
      </g>

      <!-- Disconnection Geometric Particle Accents (Blue Side) -->
      <path d="M 320 85 A 15 15 0 0 1 335 100 L 320 100 Z" fill="#38BDF8" opacity="0.8" />
      <circle cx="328" cy="182" r="7" fill="#BAE6FD" />

      <!-- Center Disconnection Gap & Spark -->
      <g class="maintenance-spark" opacity="0.85">
        <circle cx="370" cy="145" r="4" fill="#FBBF24" />
        <path d="M 370 135 L 372 143 L 380 145 L 372 147 L 370 155 L 368 147 L 360 145 L 368 143 Z" fill="#F59E0B" />
      </g>

      <!-- Disconnection Geometric Particle Accents (Green Side) -->
      <path d="M 405 85 A 15 15 0 0 0 390 100 L 405 100 Z" fill="#4ADE80" opacity="0.8" />
      <circle cx="395" cy="182" r="7" fill="#BBF7D0" />

      <!-- Green Female Socket Body -->
      <g class="maintenance-plug-green">
        <!-- Socket Receptacle Face -->
        <path d="M 410 120 C 405 120 400 125 400 130 L 400 160 C 400 165 405 170 410 170 L 420 170 C 424 170 426 168 426 164 L 426 126 C 426 122 424 120 420 120 Z" fill="#15803D" />
        <rect x="403" y="128" width="5" height="14" rx="2" fill="#14532D" />
        <rect x="403" y="148" width="5" height="14" rx="2" fill="#14532D" />
        
        <!-- Main Body -->
        <rect x="424" y="121" width="58" height="48" rx="10" fill="#22C55E" />
        <rect x="424" y="121" width="28" height="48" rx="6" fill="#16A34A" />
        <rect x="442" y="129" width="18" height="32" fill="#4ADE80" rx="3" />
        <!-- Ridge Grip -->
        <line x1="470" y1="131" x2="470" y2="159" stroke="#15803D" stroke-width="3" stroke-linecap="round" />
        <line x1="476" y1="131" x2="476" y2="159" stroke="#15803D" stroke-width="3" stroke-linecap="round" />
      </g>

      <!-- Right Cable: Vibrant Green Line -->
      <path d="M 482 145 L 535 145 C 545 145 555 135 555 125 L 555 120 C 555 105 565 95 580 95 L 740 95" 
            stroke="#22C55E" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;
}

/**
 * Generate full HTML structure for the maintenance screen
 * @param {Object} config
 * @returns {string}
 */
export function generateMaintenanceHtml(config) {
  const safeHeadline = escapeHTML(config.headline || DEFAULT_MAINTENANCE_CONFIG.headline);
  const safeMessage = escapeHTML(config.message || DEFAULT_MAINTENANCE_CONFIG.message);
  const safeEstTime = config.estimatedTime ? escapeHTML(config.estimatedTime) : '';
  const safePhone = escapeHTML(config.contactPhone || '+91 8866130409');
  const safeEmail = config.contactEmail ? escapeHTML(config.contactEmail) : '';
  const cleanPhoneLink = safePhone.replace(/[^\d+]/g, '');
  const isAdmin = checkIsAdminActive();

  return `
    <div class="maintenance-page-wrapper" id="devshree-maintenance-root">
      <div class="maintenance-card">
        ${isAdmin ? `
          <!-- Administrator Quick Control Bar -->
          <div class="maintenance-admin-toolbar" id="maintenance-admin-quick-bar">
            <div class="maintenance-admin-toolbar-text">
              <span class="maintenance-admin-dot"></span>
              <span><strong>Administrator Mode:</strong> Store Maintenance is currently active.</span>
            </div>
            <div class="maintenance-admin-toolbar-btns">
              <a href="index.html?admin_preview=1" class="maintenance-admin-action-btn preview-btn" title="View live storefront as administrator">
                👁️ Preview Live Store
              </a>
              <button type="button" class="maintenance-admin-action-btn disable-btn" id="btn-quick-disable-maintenance" title="Turn off maintenance mode now">
                🔓 Turn OFF Maintenance
              </button>
              <a href="admin.html" class="maintenance-admin-action-btn admin-btn" title="Open administrator console">
                ⚙️ Admin Console
              </a>
            </div>
          </div>
        ` : ''}

        <!-- Top Brand Header -->
        <header class="maintenance-header">
          <div class="maintenance-brand">
            <span class="maintenance-brand-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
            </span>
            <span class="maintenance-brand-name">DEVSHREE<strong>HARDWARE</strong></span>
          </div>
        </header>

        <!-- Main Body Content -->
        <main class="maintenance-body">
          <h1 class="maintenance-title">${safeHeadline}</h1>
          <p class="maintenance-subtitle">${safeMessage}</p>

          ${safeEstTime ? `
            <div class="maintenance-eta-pill">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>Estimated Return: <strong>${safeEstTime}</strong></span>
            </div>
          ` : ''}

          <!-- Disconnected Cords Visual Artwork -->
          <div class="maintenance-art-container">
            ${getMaintenanceIllustrationSvg()}
          </div>
        </main>

        <!-- Footer Strip -->
        <footer class="maintenance-footer">
          <div class="maintenance-contact-left">
            <span class="maintenance-contact-label">You can contact us:</span>
            <a href="tel:${cleanPhoneLink}" class="maintenance-contact-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              <span>Phone: <strong>${safePhone}</strong></span>
            </a>
            <a href="https://wa.me/918866130409?text=${encodeURIComponent('Hello Devshree Hardware team, I am checking on the store status.')}" target="_blank" rel="noopener noreferrer" class="maintenance-contact-item wa-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.634.053-.949.034-1.026-.062-2.072-.511-2.92-1.359-.838-.838-1.293-1.874-1.359-2.894-.02-.315-.011-.637.034-.949.05-.333.419-1.026.824-1.17.189-.067.369-.077.531-.077.162 0 .288.018.396.261.126.288.432 1.053.468 1.134.036.081.054.18.009.279-.045.099-.081.162-.162.243-.081.081-.171.18-.243.243-.09.09-.18.18-.081.351.099.171.441.729.945 1.179.648.576 1.197.756 1.368.837.171.081.27-.009.369-.117.099-.108.432-.504.549-.675.117-.171.234-.144.387-.09.153.054.981.459 1.152.549.171.09.288.135.324.207.036.072.036.423-.108.828z"></path>
              </svg>
              <span>WhatsApp: <strong>Chat with us</strong></span>
            </a>
          </div>

          <div class="maintenance-social-strip">
            <button type="button" class="maintenance-refresh-btn" onclick="window.location.reload()" title="Check if site is back online">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              <span>Refresh Page</span>
            </button>
            <a href="admin.html" class="maintenance-admin-link" title="Store Owner / Administrator Login">
              🔐 Admin Portal
            </a>
          </div>
        </footer>
      </div>
    </div>
  `;
}

/**
 * Safely runs a callback once the DOM body is ready
 * @param {Function} fn
 */
function ensureDOMReady(fn) {
  if (typeof document === 'undefined') return;
  if (document.body) {
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  }
}

/**
 * Checks if current user has an active, verified admin session
 * @returns {boolean}
 */
export function checkIsAdminActive() {
  try {
    const authState = getStorage('devshree_admin_session', null);
    if (authState && authState.authenticated === true) return true;
  } catch (_) {}

  try {
    const authSess = getStorage('devshree_admin_session_auth', null);
    if (authSess && authSess.email) return true;
  } catch (_) {}

  try {
    if (typeof sessionStorage !== 'undefined') {
      const sess = sessionStorage.getItem('devshree_admin_session_auth');
      if (sess && JSON.parse(sess)?.email) return true;
    }
  } catch (_) {}

  try {
    const user = getStorage('devshree_current_user', null);
    if (user && (user.role === 'admin' || (user.email && user.email.toLowerCase().includes('admin')))) return true;
  } catch (_) {}

  return false;
}

/**
 * Real-time listener for Cloud Firestore store_config changes
 * Allows immediate, sub-second sync across all devices
 * @param {Function} onUpdate
 * @returns {Function} unsubscribe function
 */
export function listenRemoteMaintenanceConfig(onUpdate) {
  if (typeof window === 'undefined') return () => {};
  let unsub = () => {};

  import('./firebase-config.js').then(fb => {
    if (fb.db && fb.doc && fb.onSnapshot) {
      try {
        const docRef = fb.doc(fb.db, 'settings', 'store_config');
        unsub = fb.onSnapshot(docRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            let config = getMaintenanceConfig();
            if (data && typeof data.maintenance === 'object') {
              config = { ...config, ...data.maintenance };
            } else if (typeof data.maintenanceMode === 'boolean') {
              config.enabled = data.maintenanceMode;
              if (data.maintenanceHeadline) config.headline = data.maintenanceHeadline;
              if (data.maintenanceMessage) config.message = data.maintenanceMessage;
              if (data.maintenanceEstimatedTime) config.estimatedTime = data.maintenanceEstimatedTime;
            }
            setStorage(MAINTENANCE_STORAGE_KEY, config);
            if (onUpdate) onUpdate(config);
          }
        }, (err) => {
          console.warn('[Maintenance] Firestore realtime notice:', err);
        });
      } catch (e) {
        console.warn('[Maintenance] Realtime setup error:', e);
      }
    }
  }).catch(() => {});

  return () => { try { unsub(); } catch (_) {} };
}

/**
 * Main Guard Function: Evaluates maintenance mode and applies the screen if active
 * Safe to call on all storefront pages (index.html, product.html, contact.html, etc.)
 * @returns {Promise<boolean>} Whether maintenance mode blocked regular view
 */
export async function initMaintenanceGuard() {
  if (typeof window === 'undefined') return false;

  // Never block the admin portal!
  const currentPath = window.location.pathname.toLowerCase();
  if (currentPath.endsWith('admin.html') || currentPath.includes('/admin')) {
    return false;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const isAdminPreview = urlParams.get('admin_preview') === '1' || urlParams.get('preview') === 'store';

  // 1. Initial check with local cache for instant render without flash
  let config = getMaintenanceConfig();

  if (config.enabled) {
    if (checkIsAdminActive() && isAdminPreview) {
      ensureDOMReady(() => renderAdminMaintenanceModeBanner(config));
      return false;
    }
    ensureDOMReady(() => renderMaintenanceScreen(config));
  }

  // 2. Real-time Cloud Firestore synchronization across devices
  listenRemoteMaintenanceConfig((fresh) => {
    if (!fresh) return;
    const wasEnabled = config.enabled;
    config = fresh;

    if (fresh.enabled) {
      if (checkIsAdminActive() && isAdminPreview) {
        ensureDOMReady(() => renderAdminMaintenanceModeBanner(fresh));
      } else {
        ensureDOMReady(() => renderMaintenanceScreen(fresh));
      }
    } else if (wasEnabled && !fresh.enabled) {
      // Maintenance turned OFF! If on maintenance screen, restore live store!
      if (document.getElementById('devshree-maintenance-root')) {
        window.location.href = 'index.html';
      } else {
        const bar = document.getElementById('devshree-admin-maintenance-bar');
        if (bar) bar.remove();
      }
    }
  });

  // Background fetch to guarantee cache sync
  fetchRemoteMaintenanceConfig().then(fresh => {
    if (fresh && fresh.enabled !== config.enabled) {
      config = fresh;
      if (fresh.enabled) {
        if (checkIsAdminActive() && isAdminPreview) {
          ensureDOMReady(() => renderAdminMaintenanceModeBanner(fresh));
        } else {
          ensureDOMReady(() => renderMaintenanceScreen(fresh));
        }
      }
    }
  }).catch(() => {});

  return Boolean(config.enabled && !(checkIsAdminActive() && isAdminPreview));
}

/**
 * Renders the full-page maintenance screen over the document body
 * @param {Object} config
 */
function renderMaintenanceScreen(config) {
  if (typeof document === 'undefined') return;

  document.title = `${config.headline || 'Site Under Maintenance'} — DEVSHREE Hardware`;
  injectMaintenanceStyles();

  if (!document.body) {
    ensureDOMReady(() => renderMaintenanceScreen(config));
    return;
  }

  const existingRoot = document.getElementById('devshree-maintenance-root');
  if (!existingRoot) {
    document.body.innerHTML = generateMaintenanceHtml(config);
    document.body.classList.add('in-maintenance-mode');
  }

  // Bind quick turn off button on the maintenance screen
  document.getElementById('btn-quick-disable-maintenance')?.addEventListener('click', async () => {
    if (confirm('Turn OFF maintenance mode now and make store live for all visitors?')) {
      await setMaintenanceMode(false);
      showToast('Maintenance mode turned OFF. Store is now live!', 'success');
      setTimeout(() => { window.location.href = 'index.html'; }, 300);
    }
  });
}

/**
 * Injects a non-intrusive alert banner for logged-in Admins viewing the live store
 * @param {Object} config
 */
function renderAdminMaintenanceModeBanner(config) {
  if (document.getElementById('devshree-admin-maintenance-bar')) return;

  const bar = document.createElement('aside');
  bar.id = 'devshree-admin-maintenance-bar';
  bar.className = 'admin-maintenance-banner';
  bar.setAttribute('role', 'alert');
  bar.innerHTML = `
    <div class="admin-maintenance-banner-inner">
      <span class="admin-maintenance-pulse"></span>
      <span class="admin-maintenance-text">
        <strong>⚠️ Maintenance Mode Active:</strong> Regular visitors currently see the maintenance page. You are viewing as Admin.
      </span>
      <div class="admin-maintenance-actions">
        <a href="admin.html" class="admin-banner-btn primary">Go to Admin Dashboard</a>
        <button type="button" class="admin-banner-btn secondary" id="btn-disable-maintenance-quick">
          Turn OFF Maintenance
        </button>
      </div>
    </div>
  `;

  document.body.prepend(bar);

  document.getElementById('btn-disable-maintenance-quick')?.addEventListener('click', async () => {
    if (confirm('Turn OFF maintenance mode now and make store visible to all customers?')) {
      await setMaintenanceMode(false);
      showToast('Maintenance mode turned OFF. Store is now live!', 'success');
      setTimeout(() => window.location.reload(), 400);
    }
  });
}

/**
 * Injects CSS rules for the maintenance page and admin banner
 */
export function injectMaintenanceStyles() {
  if (document.getElementById('devshree-maintenance-styles')) return;

  const styleEl = document.createElement('style');
  styleEl.id = 'devshree-maintenance-styles';
  styleEl.textContent = `
    body.in-maintenance-mode {
      margin: 0;
      padding: 0;
      min-height: 100vh;
      background-color: #EEF2F6;
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1E293B;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .maintenance-page-wrapper {
      width: 100%;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1.5rem;
      box-sizing: border-box;
      background: linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%);
    }

    .maintenance-card {
      width: 100%;
      max-width: 860px;
      background: #FFFFFF;
      border-radius: 20px;
      box-shadow: 0 20px 45px -15px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(15, 23, 42, 0.05);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: fadeInScale 0.4s ease-out;
    }

    @keyframes fadeInScale {
      from { opacity: 0; transform: scale(0.97) translateY(10px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    .maintenance-admin-toolbar {
      background: #7C2D12;
      color: #FFFFFF;
      padding: 0.75rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
      font-size: 0.85rem;
      border-bottom: 1px solid rgba(255,255,255,0.15);
    }

    .maintenance-admin-toolbar-text {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .maintenance-admin-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #FB923C;
      box-shadow: 0 0 0 3px rgba(251, 146, 60, 0.35);
      animation: pulseAlert 1.5s infinite;
      display: inline-block;
    }

    .maintenance-admin-toolbar-btns {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    .maintenance-admin-action-btn {
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 0.78rem;
      font-weight: 700;
      text-decoration: none;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .maintenance-admin-action-btn.preview-btn {
      background: #EA580C;
      color: #FFFFFF;
    }
    .maintenance-admin-action-btn.preview-btn:hover {
      background: #C2410C;
    }

    .maintenance-admin-action-btn.disable-btn {
      background: #FFFFFF;
      color: #7C2D12;
    }
    .maintenance-admin-action-btn.disable-btn:hover {
      background: #FEE2E2;
    }

    .maintenance-admin-action-btn.admin-btn {
      background: rgba(255,255,255,0.18);
      color: #FFFFFF;
    }
    .maintenance-admin-action-btn.admin-btn:hover {
      background: rgba(255,255,255,0.3);
    }

    .maintenance-header {
      padding: 2.25rem 2.5rem 1rem;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .maintenance-brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: #0F172A;
    }

    .maintenance-brand-icon {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: #0284C7;
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(2, 132, 199, 0.3);
    }

    .maintenance-brand-name {
      font-size: 1.35rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #0F172A;
    }

    .maintenance-brand-name strong {
      color: #EA580C;
      font-weight: 800;
      margin-left: 2px;
    }

    .maintenance-body {
      padding: 1rem 3rem 2.5rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .maintenance-title {
      font-size: 2.35rem;
      font-weight: 800;
      color: #0F172A;
      letter-spacing: -0.03em;
      line-height: 1.25;
      margin: 0.5rem 0 0.85rem;
      max-width: 680px;
    }

    .maintenance-subtitle {
      font-size: 1.05rem;
      color: #64748B;
      line-height: 1.6;
      margin: 0 0 1.25rem;
      max-width: 540px;
      font-weight: 400;
    }

    .maintenance-eta-pill {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: #FEF3C7;
      color: #92400E;
      border: 1px solid #FDE68A;
      font-size: 0.88rem;
      padding: 6px 16px;
      border-radius: 30px;
      margin-bottom: 1.5rem;
      font-weight: 500;
    }

    .maintenance-art-container {
      width: 100%;
      max-width: 720px;
      margin: 1.5rem auto 0.5rem;
      padding: 0.5rem 0;
      overflow: hidden;
    }

    .maintenance-illustration {
      width: 100%;
      height: auto;
      max-height: 180px;
      display: block;
    }

    /* Subtle animation on spark */
    .maintenance-spark {
      animation: pulseSpark 2s ease-in-out infinite alternate;
      transform-origin: 370px 145px;
    }

    @keyframes pulseSpark {
      0% { opacity: 0.4; transform: scale(0.9); }
      100% { opacity: 1; transform: scale(1.1); }
    }

    .maintenance-footer {
      border-top: 1px solid #E2E8F0;
      padding: 1.25rem 2.5rem;
      background: #FAFAFA;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1.25rem;
    }

    .maintenance-contact-left {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 1.25rem;
      font-size: 0.88rem;
      color: #475569;
    }

    .maintenance-contact-label {
      font-weight: 600;
      color: #1E293B;
    }

    .maintenance-contact-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
      color: #334155;
      transition: color 0.2s ease;
    }

    .maintenance-contact-item:hover {
      color: #0284C7;
    }

    .maintenance-contact-item.wa-item {
      color: #16A34A;
      font-weight: 600;
    }

    .maintenance-contact-item.wa-item:hover {
      color: #15803D;
    }

    .maintenance-social-strip {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }

    .maintenance-refresh-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #FFFFFF;
      border: 1px solid #CBD5E1;
      color: #334155;
      font-size: 0.82rem;
      font-weight: 600;
      padding: 6px 14px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .maintenance-refresh-btn:hover {
      background: #F8FAFC;
      border-color: #94A3B8;
      color: #0F172A;
    }

    .maintenance-admin-link {
      font-size: 0.82rem;
      color: #64748B;
      text-decoration: none;
      font-weight: 600;
      padding: 6px 10px;
      border-radius: 6px;
      transition: all 0.2s ease;
    }

    .maintenance-admin-link:hover {
      color: #0284C7;
      background: #E0F2FE;
    }

    /* Top Admin Banner when store owner views store in maintenance mode */
    .admin-maintenance-banner {
      position: sticky;
      top: 0;
      left: 0;
      width: 100%;
      background: #7C2D12;
      color: #FFFFFF;
      padding: 0.65rem 1.25rem;
      z-index: 99999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-size: 0.88rem;
    }

    .admin-maintenance-banner-inner {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .admin-maintenance-pulse {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #FB923C;
      box-shadow: 0 0 0 0 rgba(251, 146, 60, 0.7);
      animation: pulseAlert 1.5s infinite;
      display: inline-block;
      flex-shrink: 0;
    }

    @keyframes pulseAlert {
      0% { box-shadow: 0 0 0 0 rgba(251, 146, 60, 0.7); }
      70% { box-shadow: 0 0 0 8px rgba(251, 146, 60, 0); }
      100% { box-shadow: 0 0 0 0 rgba(251, 146, 60, 0); }
    }

    .admin-maintenance-text {
      flex: 1;
      min-width: 280px;
    }

    .admin-maintenance-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .admin-banner-btn {
      border: none;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s ease;
    }

    .admin-banner-btn.primary {
      background: #EA580C;
      color: #FFFFFF;
    }
    .admin-banner-btn.primary:hover {
      background: #C2410C;
    }

    .admin-banner-btn.secondary {
      background: #FFFFFF;
      color: #7C2D12;
    }
    .admin-banner-btn.secondary:hover {
      background: #FEE2E2;
    }

    @media (max-width: 768px) {
      .maintenance-title {
        font-size: 1.75rem;
      }
      .maintenance-body {
        padding: 0.75rem 1.25rem 1.5rem;
      }
      .maintenance-footer {
        flex-direction: column;
        align-items: flex-start;
        padding: 1.25rem 1.5rem;
      }
      .maintenance-social-strip {
        width: 100%;
        justify-content: space-between;
      }
    }
  `;

  document.head.appendChild(styleEl);
}

