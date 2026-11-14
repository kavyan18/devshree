/**
 * Devshree Architectural Hardware & Interior Catalogs
 * Official brand PDF catalogs, lookbooks, and technical spec sheets
 * High-performance dual storage: IndexedDB for large PDF payloads + LocalStorage metadata
 */

const DEVSHREE_CATALOGS = [
  {
    id: 'cat-acrysoft-genoa',
    title: 'Acrysoft Genoa Matt Acrylic Laminates',
    brand: 'Acrysoft',
    category: 'Laminates & Liners',
    categorySlug: 'laminates',
    coverImage: 'assets/images/catalogs/catalog_acrysoft_genoa.jpg',
    pdfUrl: 'assets/catalogs/acrysoft-genoa-matt-acrylic-laminates.pdf',
    filename: 'Acrysoft-Genoa-Matt-Acrylic-Laminates-2026.pdf',
    pages: 3,
    size: '5.4 KB',
    description: 'Anti-fingerprint super matte acrylic surfaces designed for luxury interior kitchen cabinetry and living spaces.'
  },
  {
    id: 'cat-action-tesa-highgloss',
    title: 'Action Tesa Prelam Acrylic High Gloss Board',
    brand: 'Action Tesa',
    category: 'MDF, HDHMR & PVC Boards',
    categorySlug: 'boards',
    coverImage: 'assets/images/catalogs/catalog_action_tesa_highgloss.jpg',
    pdfUrl: 'assets/catalogs/action-tesa-prelam-acrylic-high-gloss-board.pdf',
    filename: 'Action-Tesa-Prelam-Acrylic-High-Gloss-Board.pdf',
    pages: 4,
    size: '7.1 KB',
    description: 'Innovation That Shines: Ultra high-gloss pre-laminated boards engineered with German technology for mirror finish.'
  },
  {
    id: 'cat-action-tesa-mdf',
    title: 'Action Tesa Prelam MDF',
    brand: 'Action Tesa',
    category: 'MDF, HDHMR & PVC Boards',
    categorySlug: 'boards',
    coverImage: 'assets/images/catalogs/catalog_action_tesa_mdf.jpg',
    pdfUrl: 'assets/catalogs/action-tesa-prelam-mdf-boards.pdf',
    filename: 'Action-Tesa-Prelam-MDF-Boards.pdf',
    pages: 3,
    size: '5.3 KB',
    description: 'Color your imagination: High-density moisture-resistant prelaminated MDF with synchronized timber grains.'
  },
  {
    id: 'cat-action-tesa-particle',
    title: 'Action Tesa Prelam Particle Boards',
    brand: 'Action Tesa',
    category: 'MDF, HDHMR & PVC Boards',
    categorySlug: 'boards',
    coverImage: 'assets/images/catalogs/catalog_action_tesa_particle.jpg',
    pdfUrl: 'assets/catalogs/action-tesa-prelam-particle-boards.pdf',
    filename: 'Action-Tesa-Prelam-Particle-Boards.pdf',
    pages: 3,
    size: '5.4 KB',
    description: 'Commercial interior grade prelaminated particle boards ideal for modular office and wardrobe manufacturing.'
  },
  {
    id: 'cat-advance-spc',
    title: 'Advance 1.25mm SPC Laminates',
    brand: 'Advance',
    category: 'Laminates & Liners',
    categorySlug: 'laminates',
    coverImage: 'assets/images/catalogs/catalog_advance_spc.jpg',
    pdfUrl: 'assets/catalogs/advance-1-25mm-spc-laminates.pdf',
    filename: 'Advance-1.25mm-SPC-Laminates-Collection.pdf',
    pages: 4,
    size: '7.0 KB',
    description: '100% waterproof and borer-proof Stone Polymer Composite laminates with ultra-high impact resistance.'
  },
  {
    id: 'cat-century-lookbook',
    title: 'CenturyLaminates LookBook 2026',
    brand: 'CenturyLaminates',
    category: 'Laminates & Liners',
    categorySlug: 'laminates',
    coverImage: 'assets/images/catalogs/catalog_century_lookbook.jpg',
    pdfUrl: 'assets/catalogs/century-laminates-lookbook-2026.pdf',
    filename: 'Century-Laminates-LookBook-2026.pdf',
    pages: 4,
    size: '6.9 KB',
    description: 'ViroKill technology antimicrobial surfaces, deep synchronized textures, and classic woodgrain veneers.'
  },
  {
    id: 'cat-greenlam-surfaces',
    title: 'Greenlam Architectural Surfaces',
    brand: 'Greenlam',
    category: 'Laminates & Liners',
    categorySlug: 'laminates',
    coverImage: 'assets/images/catalogs/catalog_greenlam_surfaces.jpg',
    pdfUrl: 'assets/catalogs/greenlam-architectural-surfaces.pdf',
    filename: 'Greenlam-Architectural-Surfaces-Catalogue.pdf',
    pages: 5,
    size: '8.6 KB',
    description: 'Global standard interior & exterior cladding panels, solid surface compact sheets, and designer veneers.'
  },
  {
    id: 'cat-godrej-hardware',
    title: 'Godrej Architectural Hardware & Digital Locks',
    brand: 'Godrej',
    category: 'Cabinet Hardware',
    categorySlug: 'hardware',
    coverImage: 'assets/images/catalogs/catalog_godrej_hardware.jpg',
    pdfUrl: 'assets/catalogs/godrej-architectural-hardware.pdf',
    filename: 'Godrej-Architectural-Hardware-Catalogue.pdf',
    pages: 4,
    size: '7.0 KB',
    description: 'Heavy duty mortise locks, biometric keypad door handles, hydraulic concealed hinges, and drawer slides.'
  },
  {
    id: 'cat-pidilite-adhesives',
    title: 'Pidilite Fevicol Industrial Wood Adhesives',
    brand: 'Pidilite',
    category: 'Adhesive',
    categorySlug: 'adhesive',
    coverImage: 'assets/images/catalogs/catalog_pidilite_adhesives.jpg',
    pdfUrl: 'assets/catalogs/pidilite-fevicol-wood-adhesives.pdf',
    filename: 'Pidilite-Fevicol-Adhesives-Guide.pdf',
    pages: 3,
    size: '5.3 KB',
    description: 'Fevicol Marine waterproof adhesive, HeatX heat-resistant adhesive, and Loctite fast-curing adhesives.'
  }
];

const DEVSHREE_CATEGORIES = [
  {
    id: 'cat-plywood',
    name: 'Plywood & Blockboard',
    image: 'assets/images/categories/cat_plywood.jpg',
    query: 'plywood'
  },
  {
    id: 'cat-mdf-hdhmr',
    name: 'MDF, HDHMR & PVC Boards',
    image: 'assets/images/categories/cat_mdf_hdhmr.jpg',
    query: 'boards'
  },
  {
    id: 'cat-laminates-liners',
    name: 'Laminates & Liners',
    image: 'assets/images/categories/cat_laminates_liners.jpg',
    query: 'laminates'
  },
  {
    id: 'cat-panels-mouldings',
    name: 'Panels & Mouldings',
    image: 'assets/images/categories/cat_panels_mouldings.jpg',
    query: 'panels'
  },
  {
    id: 'cat-adhesive',
    name: 'Adhesive',
    image: 'assets/images/categories/cat_adhesive.jpg',
    query: 'adhesive'
  },
  {
    id: 'cat-kitchen-hardware',
    name: 'Kitchen Hardware',
    image: 'assets/images/categories/cat_kitchen_hardware.jpg',
    query: 'kitchen'
  },
  {
    id: 'cat-cabinet-hardware',
    name: 'Cabinet Hardware',
    image: 'assets/images/categories/cat_cabinet_hardware.jpg',
    query: 'hardware'
  },
  {
    id: 'cat-nails-screws',
    name: 'Nails, Screws & Accessories',
    image: 'assets/images/categories/cat_nails_screws.jpg',
    query: 'fasteners'
  }
];

/* =========================================================================
   IndexedDB Engine for Large PDF & Cover Payloads (Bypasses 5MB Quota)
   ========================================================================= */

const DB_NAME = 'devshree_catalog_db';
const DB_VERSION = 2;
const STORE_NAME = 'pdf_documents';
const COVER_STORE_NAME = 'cover_documents';
const CUSTOM_CATALOGS_KEY = 'devshree_custom_catalogs';

let _pdfDbPromise = null;
let _activeObjectUrl = null;

function openPdfDb() {
  if (_pdfDbPromise) return _pdfDbPromise;
  _pdfDbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(COVER_STORE_NAME)) {
          db.createObjectStore(COVER_STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => {
        console.warn('[Devshree Catalogs] IndexedDB open error:', e);
        resolve(null);
      };
    } catch (err) {
      console.warn('[Devshree Catalogs] IndexedDB initialization error:', err);
      resolve(null);
    }
  });
  return _pdfDbPromise;
}

/**
 * Convert base64 data URL to native binary Blob
 * @param {string} dataUrl 
 * @returns {Blob}
 */
function dataUrlToBlob(dataUrl) {
  if (dataUrl instanceof Blob) return dataUrl;
  try {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (err) {
    console.warn('[Devshree Catalogs] Failed converting data URL to Blob:', err);
    return new Blob([], { type: 'application/pdf' });
  }
}

/**
 * Save large PDF payload to IndexedDB
 */
async function saveCatalogPdfBlob(id, dataUrlOrBlob, metadata = {}) {
  const db = await openPdfDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const entry = {
        id,
        payload: dataUrlOrBlob,
        filename: metadata.filename || `${id}.pdf`,
        size: metadata.size || '',
        updatedAt: Date.now()
      };
      const req = store.put(entry);
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => {
        console.warn('[Devshree Catalogs] IndexedDB store write failed:', e);
        resolve(false);
      };
    } catch (err) {
      console.warn('[Devshree Catalogs] IndexedDB write exception:', err);
      resolve(false);
    }
  });
}

/**
 * Retrieve PDF payload from IndexedDB
 */
async function getCatalogPdfBlob(id) {
  const db = await openPdfDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result && req.result.payload) {
          resolve(req.result.payload);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch (_) {
      resolve(null);
    }
  });
}

/**
 * Remove PDF payload from IndexedDB
 */
async function deleteCatalogPdfBlob(id) {
  const db = await openPdfDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch (_) {
      resolve(false);
    }
  });
}

/**
 * Save Cover image payload to IndexedDB
 */
async function saveCatalogCoverBlob(id, dataUrlOrBlob) {
  const db = await openPdfDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      if (!db.objectStoreNames.contains(COVER_STORE_NAME)) {
        resolve(false);
        return;
      }
      const tx = db.transaction(COVER_STORE_NAME, 'readwrite');
      const store = tx.objectStore(COVER_STORE_NAME);
      const entry = {
        id,
        payload: dataUrlOrBlob,
        updatedAt: Date.now()
      };
      const req = store.put(entry);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch (err) {
      console.warn('[Devshree Catalogs] Save cover IndexedDB exception:', err);
      resolve(false);
    }
  });
}

/**
 * Retrieve Cover image payload from IndexedDB
 */
async function getCatalogCoverBlob(id) {
  const db = await openPdfDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      if (!db.objectStoreNames.contains(COVER_STORE_NAME)) {
        resolve(null);
        return;
      }
      const tx = db.transaction(COVER_STORE_NAME, 'readonly');
      const store = tx.objectStore(COVER_STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result && req.result.payload) {
          resolve(req.result.payload);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch (_) {
      resolve(null);
    }
  });
}

/**
 * Remove Cover image payload from IndexedDB
 */
async function deleteCatalogCoverBlob(id) {
  const db = await openPdfDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      if (!db.objectStoreNames.contains(COVER_STORE_NAME)) {
        resolve(false);
        return;
      }
      const tx = db.transaction(COVER_STORE_NAME, 'readwrite');
      const store = tx.objectStore(COVER_STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch (_) {
      resolve(false);
    }
  });
}

/**
 * Resolve any PDF URL (IndexedDB ID, Base64 DataURL, or Static URL) into a reliable browser URL
 * @param {string} pdfUrl 
 * @param {string} catalogId 
 * @returns {Promise<string>}
 */
async function resolveCatalogPdfUrl(pdfUrl, catalogId = '') {
  if (!pdfUrl) return '';

  // 1. If stored in IndexedDB via reference
  if (pdfUrl.startsWith('indexeddb:')) {
    const id = pdfUrl.replace('indexeddb:', '').trim() || catalogId;
    const stored = await getCatalogPdfBlob(id);
    if (stored) {
      const blob = typeof stored === 'string' && stored.startsWith('data:') ? dataUrlToBlob(stored) : stored;
      return URL.createObjectURL(blob);
    }
  }

  // 2. If it's a raw Base64 data URL
  if (typeof pdfUrl === 'string' && pdfUrl.startsWith('data:')) {
    const blob = dataUrlToBlob(pdfUrl);
    return URL.createObjectURL(blob);
  }

  // 3. Check if an IndexedDB entry exists by catalogId fallback
  if (catalogId) {
    const stored = await getCatalogPdfBlob(catalogId);
    if (stored) {
      const blob = typeof stored === 'string' && stored.startsWith('data:') ? dataUrlToBlob(stored) : stored;
      return URL.createObjectURL(blob);
    }
  }

  // 4. Standard relative/absolute URL
  return pdfUrl;
}

/* =========================================================================
   Universal PDF Modal Viewer Handler
   ========================================================================= */

async function openPdfViewerModal(pdfUrl, title, filename, catalogId = '') {
  let modal = document.getElementById('devshree-pdf-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'devshree-pdf-modal';
    modal.className = 'pdf-viewer-modal-backdrop';
    modal.innerHTML = `
      <div class="pdf-viewer-modal-dialog" role="dialog" aria-modal="true" aria-label="PDF Viewer">
        <div class="pdf-viewer-modal-header">
          <div class="pdf-viewer-title-wrap">
            <span class="pdf-viewer-badge">PDF LOOKBOOK</span>
            <h3 class="pdf-viewer-modal-title" id="pdf-viewer-title">Product Catalog</h3>
          </div>
          <div class="pdf-viewer-modal-actions">
            <a href="#" class="btn-pdf-header-action" id="pdf-viewer-newtab-btn" target="_blank" rel="noopener noreferrer" title="Open in New Tab">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              <span>Open Tab</span>
            </a>
            <a href="#" class="btn-pdf-header-action btn-pdf-primary-action" id="pdf-viewer-download-btn" download title="Download PDF">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span>Download PDF</span>
            </a>
            <button type="button" class="btn-pdf-modal-close" id="pdf-viewer-close-btn" aria-label="Close PDF Viewer">&times;</button>
          </div>
        </div>
        <div class="pdf-viewer-modal-body">
          <div id="pdf-viewer-loading" style="display:flex;align-items:center;justify-content:center;height:100%;color:#7A766F;font-size:0.9rem;gap:8px;">
            <span>Loading PDF catalog...</span>
          </div>
          <iframe id="pdf-viewer-iframe" class="pdf-viewer-iframe" src="about:blank" title="Catalog PDF Viewer" style="display:none;"></iframe>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#pdf-viewer-close-btn')?.addEventListener('click', closePdfViewerModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closePdfViewerModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closePdfViewerModal();
      }
    });
  }

  const titleEl = modal.querySelector('#pdf-viewer-title');
  const iframeEl = modal.querySelector('#pdf-viewer-iframe');
  const loadingEl = modal.querySelector('#pdf-viewer-loading');
  const downloadBtn = modal.querySelector('#pdf-viewer-download-btn');
  const newtabBtn = modal.querySelector('#pdf-viewer-newtab-btn');

  if (titleEl) titleEl.textContent = title || 'Product Catalog';
  if (loadingEl) loadingEl.style.display = 'flex';
  if (iframeEl) iframeEl.style.display = 'none';

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Revoke previous blob URL if any to free memory
  if (_activeObjectUrl) {
    try { URL.revokeObjectURL(_activeObjectUrl); } catch (_) {}
    _activeObjectUrl = null;
  }

  const resolved = await resolveCatalogPdfUrl(pdfUrl, catalogId);
  if (resolved.startsWith('blob:')) {
    _activeObjectUrl = resolved;
  }

  if (downloadBtn) {
    downloadBtn.href = resolved;
    downloadBtn.setAttribute('download', filename || 'Devshree-Catalog.pdf');
  }
  if (newtabBtn) newtabBtn.href = resolved;
  if (iframeEl) {
    iframeEl.onload = () => {
      if (loadingEl) loadingEl.style.display = 'none';
      iframeEl.style.display = 'block';
    };
    iframeEl.src = resolved;
    // Fallback if onload doesn't fire for pdf viewer plugin
    setTimeout(() => {
      if (loadingEl) loadingEl.style.display = 'none';
      if (iframeEl) iframeEl.style.display = 'block';
    }, 400);
  }
}

function closePdfViewerModal() {
  const modal = document.getElementById('devshree-pdf-modal');
  if (!modal) return;
  modal.classList.remove('active');
  const iframeEl = modal.querySelector('#pdf-viewer-iframe');
  if (iframeEl) iframeEl.src = 'about:blank';
  document.body.style.overflow = '';
  if (_activeObjectUrl) {
    try { URL.revokeObjectURL(_activeObjectUrl); } catch (_) {}
    _activeObjectUrl = null;
  }
}

/* =========================================================================
   Active Catalogs Management & Persistence
   ========================================================================= */

/**
 * Retrieve active catalogs merged with admin customizations from localStorage
 * @returns {Array} List of official and admin-added PDF catalogs
 */
function getActiveCatalogs() {
  try {
    const raw = localStorage.getItem(CUSTOM_CATALOGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (_) {}
  return DEVSHREE_CATALOGS.slice();
}

/**
 * Downscale a Base64 image data URL to a lightweight thumbnail using HTML5 Canvas
 * @param {string} dataUrl 
 * @param {number} maxDim 
 * @param {number} quality 
 * @returns {Promise<string>}
 */
function compressDataUrlThumbnail(dataUrl, maxDim = 480, quality = 0.82) {
  return new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      resolve(dataUrl);
      return;
    }
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      resolve(dataUrl);
      return;
    }
    if (dataUrl.length < 65000) {
      resolve(dataUrl);
      return;
    }
    try {
      const img = new Image();
      img.onload = () => {
        try {
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const thumb = canvas.toDataURL('image/jpeg', quality);
            resolve(thumb);
          } else {
            resolve(dataUrl);
          }
        } catch (_) {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch (_) {
      resolve(dataUrl);
    }
  });
}

/**
 * Persist catalogs array: saves heavy PDF payloads to IndexedDB and stores lightweight metadata in localStorage
 * @param {Array} catalogs 
 */
async function saveActiveCatalogs(catalogs) {
  if (!Array.isArray(catalogs)) return;

  // 1. Process items: isolate heavy base64 strings into IndexedDB
  const sanitizedList = [];
  for (const c of catalogs) {
    const copy = { ...c };

    // Separate bulky PDF payloads into IndexedDB
    if (copy.pdfUrl && typeof copy.pdfUrl === 'string' && copy.pdfUrl.startsWith('data:')) {
      await saveCatalogPdfBlob(copy.id, copy.pdfUrl, { filename: copy.filename, size: copy.size });
      copy.pdfUrl = `indexeddb:${copy.id}`;
      copy.hasLocalPdf = true;
    }

    // Safely compress bulky cover image payloads (> 65 KB) and store full version in IndexedDB
    if (copy.coverImage && typeof copy.coverImage === 'string' && copy.coverImage.startsWith('data:image/') && copy.coverImage.length > 65000) {
      await saveCatalogCoverBlob(copy.id, copy.coverImage);
      copy.coverImage = await compressDataUrlThumbnail(copy.coverImage, 480, 0.82);
    }

    sanitizedList.push(copy);
  }

  // 2. Safely store clean metadata into localStorage (typically < 25 KB)
  try {
    localStorage.setItem(CUSTOM_CATALOGS_KEY, JSON.stringify(sanitizedList));
  } catch (err) {
    console.warn('[Devshree Catalogs] LocalStorage quota fallback, attempting compact compression:', err);
    try {
      const ultraSlim = await Promise.all(sanitizedList.map(async item => {
        if (item.coverImage && typeof item.coverImage === 'string' && item.coverImage.startsWith('data:')) {
          const ultra = await compressDataUrlThumbnail(item.coverImage, 320, 0.7);
          return { ...item, coverImage: ultra };
        }
        return item;
      }));
      localStorage.setItem(CUSTOM_CATALOGS_KEY, JSON.stringify(ultraSlim));
    } catch (e2) {
      console.error('[Devshree Catalogs] Critical LocalStorage save error:', e2);
    }
  }

  // 3. Keep caller's in-memory array elements in sync
  catalogs.forEach((orig, idx) => {
    if (sanitizedList[idx]) {
      orig.pdfUrl = sanitizedList[idx].pdfUrl;
      orig.coverImage = sanitizedList[idx].coverImage;
      orig.hasLocalPdf = sanitizedList[idx].hasLocalPdf;
    }
  });

  // 4. Dispatch sync events
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('devshree:catalogs-updated', { detail: { catalogs: sanitizedList } }));
  }
}

/**
 * Reset catalogs to factory default brand lookbooks
 */
function resetCatalogsToDefault() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(CUSTOM_CATALOGS_KEY);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('devshree:catalogs-updated', { detail: { catalogs: DEVSHREE_CATALOGS } }));
    }
  } catch (err) {
    console.warn('[Catalogs Data] Failed to reset catalogs:', err);
  }
  return DEVSHREE_CATALOGS.slice();
}

// Make accessible to all scripts and global window context
if (typeof window !== 'undefined') {
  window.DEVSHREE_CATALOGS = DEVSHREE_CATALOGS;
  window.DEVSHREE_CATEGORIES = DEVSHREE_CATEGORIES;
  window.getActiveCatalogs = getActiveCatalogs;
  window.saveActiveCatalogs = saveActiveCatalogs;
  window.resetCatalogsToDefault = resetCatalogsToDefault;
  window.openPdfViewerModal = openPdfViewerModal;
  window.closePdfViewerModal = closePdfViewerModal;
  window.saveCatalogPdfBlob = saveCatalogPdfBlob;
  window.getCatalogPdfBlob = getCatalogPdfBlob;
  window.deleteCatalogPdfBlob = deleteCatalogPdfBlob;
  window.resolveCatalogPdfUrl = resolveCatalogPdfUrl;
  window.dataUrlToBlob = dataUrlToBlob;
}

export {
  DEVSHREE_CATALOGS,
  DEVSHREE_CATEGORIES,
  getActiveCatalogs,
  saveActiveCatalogs,
  resetCatalogsToDefault,
  openPdfViewerModal,
  closePdfViewerModal,
  saveCatalogPdfBlob,
  getCatalogPdfBlob,
  deleteCatalogPdfBlob,
  resolveCatalogPdfUrl,
  dataUrlToBlob
};
