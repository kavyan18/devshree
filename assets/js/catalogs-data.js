/**
 * Devshree Architectural Hardware & Interior Catalogs
 * Official brand PDF catalogs, lookbooks, and technical spec sheets
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

/**
 * Universal PDF Modal Viewer Handler
 */
function openPdfViewerModal(pdfUrl, title, filename) {
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
          <iframe id="pdf-viewer-iframe" class="pdf-viewer-iframe" src="about:blank" title="Catalog PDF Viewer"></iframe>
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
  const downloadBtn = modal.querySelector('#pdf-viewer-download-btn');
  const newtabBtn = modal.querySelector('#pdf-viewer-newtab-btn');

  if (titleEl) titleEl.textContent = title || 'Product Catalog';
  if (downloadBtn) {
    downloadBtn.href = pdfUrl;
    downloadBtn.setAttribute('download', filename || 'Devshree-Catalog.pdf');
  }
  if (newtabBtn) newtabBtn.href = pdfUrl;
  if (iframeEl) iframeEl.src = pdfUrl;

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closePdfViewerModal() {
  const modal = document.getElementById('devshree-pdf-modal');
  if (!modal) return;
  modal.classList.remove('active');
  const iframeEl = modal.querySelector('#pdf-viewer-iframe');
  if (iframeEl) iframeEl.src = 'about:blank';
  document.body.style.overflow = '';
}

const CUSTOM_CATALOGS_KEY = 'devshree_custom_catalogs';

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
  return DEVSHREE_CATALOGS;
}

/**
 * Persist catalogs array to local storage and trigger change event
 * @param {Array} catalogs 
 */
function saveActiveCatalogs(catalogs) {
  try {
    localStorage.setItem(CUSTOM_CATALOGS_KEY, JSON.stringify(catalogs));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('devshree:catalogs-updated', { detail: { catalogs } }));
    }
  } catch (err) {
    console.error('[Devshree] Failed saving custom catalogs:', err);
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

// Make accessible to all scripts and window context
if (typeof window !== 'undefined') {
  window.getActiveCatalogs = getActiveCatalogs;
  window.saveActiveCatalogs = saveActiveCatalogs;
  window.resetCatalogsToDefault = resetCatalogsToDefault;
  window.openPdfViewerModal = openPdfViewerModal;
  window.closePdfViewerModal = closePdfViewerModal;
  window.DEVSHREE_CATALOGS = DEVSHREE_CATALOGS;
  window.DEVSHREE_CATEGORIES = DEVSHREE_CATEGORIES;
}

export {
  DEVSHREE_CATALOGS,
  DEVSHREE_CATEGORIES,
  getActiveCatalogs,
  saveActiveCatalogs,
  resetCatalogsToDefault,
  openPdfViewerModal,
  closePdfViewerModal
};
