/**
 * DEVSHREE — TRADE CATEGORIES & SUBCATEGORIES REPOSITORY
 * Dual-tier state: Supabase PostgreSQL (primary) + LocalStorage (fast 0ms cache) + Cloud Firestore
 * Allows administrator to change categories, add new categories, and add/manage subcategories.
 */

import { getSupabaseClient, isSupabaseConfigured } from './supabase-config.js';
import { getStorage, setStorage } from './utils.js';

export const STORAGE_KEY_CATEGORIES = 'devshree_categories';
export const STORAGE_KEY_SUBCATEGORIES = 'devshree_subcategories';
export const STORAGE_KEY_DELETED_CATEGORIES = 'devshree_deleted_category_ids';
export const STORAGE_KEY_DELETED_SUBCATEGORIES = 'devshree_deleted_subcategory_ids';

// Protected Core 5 Trade Departments
export const CORE_CATEGORY_IDS = new Set([
  'cat-hardware',
  'cat-electric',
  'cat-plumbing',
  'cat-paints',
  'cat-lamination'
]);

export const isTestingEnvironment = Boolean(
  (typeof window === 'undefined' && !(typeof process !== 'undefined' && process.env.DEVSHREE_ALLOW_SUPABASE_MUTATION === 'true')) ||
  (typeof process !== 'undefined' && (process.env.DEVSHREE_TEST_MODE === 'true' || process.env.NODE_ENV === 'test' || (process.argv && process.argv.some(a => a.includes('test'))))) ||
  (typeof window !== 'undefined' && window.__DEVSHREE_TEST_MODE === true)
);

// Default Core 5 Trade Departments: Hardware, Electric, Plumbing, Paints, Lamination
export const DEFAULT_CATEGORIES = [
  {
    id: 'cat-hardware',
    name: 'Hardware',
    slug: 'hardware',
    description: 'Solid brass & architectural hardware, handles, knobs, aldrops, locks & carpentry fittings.',
    image: 'assets/images/cat_hardware.jpg',
    imageUrl: 'assets/images/cat_hardware.jpg',
    icon: '🔩',
    badgeClass: 'hardware',
    displayOrder: 1
  },
  {
    id: 'cat-electric',
    name: 'Electric',
    slug: 'electric',
    description: 'Modular switches, sockets, wires, cables, LED lighting, MCBs & distribution boards.',
    image: 'assets/images/cat_electrical.jpg',
    imageUrl: 'assets/images/cat_electrical.jpg',
    icon: '⚡',
    badgeClass: 'electrical',
    displayOrder: 2
  },
  {
    id: 'cat-plumbing',
    name: 'Plumbing',
    slug: 'plumbing',
    description: 'CPVC & UPVC pipes, brass ball valves, chrome bib taps, solvent cements & sanitary fittings.',
    image: 'assets/images/cat_plumbing.jpg',
    imageUrl: 'assets/images/cat_plumbing.jpg',
    icon: '🚰',
    badgeClass: 'plumbing',
    displayOrder: 3
  },
  {
    id: 'cat-paints',
    name: 'Paints',
    slug: 'paints',
    description: 'Luxury interior emulsions, weatherproof exterior paints, primers, wall putty & wood finishes.',
    image: 'assets/images/cat_paints.jpg',
    imageUrl: 'assets/images/cat_paints.jpg',
    icon: '🎨',
    badgeClass: 'paints',
    displayOrder: 4
  },
  {
    id: 'cat-lamination',
    name: 'Lamination',
    slug: 'lamination',
    description: 'Decorative laminates, mica sheets, edge banding tapes, acrylic sheets & PVC laminates.',
    image: 'assets/images/categories/cat_laminates_liners.jpg',
    imageUrl: 'assets/images/categories/cat_laminates_liners.jpg',
    icon: '🪵',
    badgeClass: 'lamination',
    displayOrder: 5
  }
];

// Default Subcategories for all 5 departments
export const DEFAULT_SUBCATEGORIES = [
  // Hardware Subcategories
  { id: 'subcat-hw-handles', categoryId: 'cat-hardware', name: 'Mortise Handles & Knobs', slug: 'mortise-handles-knobs', displayOrder: 1 },
  { id: 'subcat-hw-aldrops', categoryId: 'cat-hardware', name: 'Aldrops, Latches & Tower Bolts', slug: 'aldrops-latches-tower-bolts', displayOrder: 2 },
  { id: 'subcat-hw-hinges', categoryId: 'cat-hardware', name: 'Concealed & Bearing Hinges', slug: 'concealed-bearing-hinges', displayOrder: 3 },
  { id: 'subcat-hw-locks', categoryId: 'cat-hardware', name: 'Padlocks & Mortise Locks', slug: 'padlocks-mortise-locks', displayOrder: 4 },
  { id: 'subcat-hw-closers', categoryId: 'cat-hardware', name: 'Door Closers & Floor Springs', slug: 'door-closers-floor-springs', displayOrder: 5 },
  { id: 'subcat-hw-fasteners', categoryId: 'cat-hardware', name: 'Fasteners, Nails & Screws', slug: 'fasteners-nails-screws', displayOrder: 6 },
  { id: 'subcat-hw-drawer', categoryId: 'cat-hardware', name: 'Drawer Channels & Tandem Boxes', slug: 'drawer-channels-tandem-boxes', displayOrder: 7 },

  // Electric Subcategories
  { id: 'subcat-el-switches', categoryId: 'cat-electric', name: 'Modular Switches & Sockets', slug: 'modular-switches-sockets', displayOrder: 1 },
  { id: 'subcat-el-wires', categoryId: 'cat-electric', name: 'Copper Wires & Cables', slug: 'copper-wires-cables', displayOrder: 2 },
  { id: 'subcat-el-lighting', categoryId: 'cat-electric', name: 'LED Bulbs, Battens & Panel Lights', slug: 'led-lighting', displayOrder: 3 },
  { id: 'subcat-el-mcb', categoryId: 'cat-electric', name: 'MCBs, RCCBs & Distribution Boards', slug: 'mcb-distribution-boards', displayOrder: 4 },
  { id: 'subcat-el-conduit', categoryId: 'cat-electric', name: 'PVC Conduit Pipes & Fittings', slug: 'pvc-conduit-fittings', displayOrder: 5 },
  { id: 'subcat-el-accessories', categoryId: 'cat-electric', name: 'Holders, Plugs & Extension Boards', slug: 'electrical-accessories', displayOrder: 6 },

  // Plumbing Subcategories
  { id: 'subcat-pl-pipes', categoryId: 'cat-plumbing', name: 'CPVC & UPVC Pipes & Fittings', slug: 'cpvc-upvc-pipes', displayOrder: 1 },
  { id: 'subcat-pl-valves', categoryId: 'cat-plumbing', name: 'Brass Ball Valves & NRVs', slug: 'brass-ball-valves', displayOrder: 2 },
  { id: 'subcat-pl-taps', categoryId: 'cat-plumbing', name: 'Chrome Bib Taps & Angle Cocks', slug: 'chrome-bib-taps', displayOrder: 3 },
  { id: 'subcat-pl-sanitary', categoryId: 'cat-plumbing', name: 'Sanitaryware & Wash Basin Fittings', slug: 'sanitaryware-fittings', displayOrder: 4 },
  { id: 'subcat-pl-cements', categoryId: 'cat-plumbing', name: 'Solvent Cements & Teflon Tapes', slug: 'solvent-cements-tapes', displayOrder: 5 },
  { id: 'subcat-pl-drainage', categoryId: 'cat-plumbing', name: 'Waste Pipes, Traps & Floor Drains', slug: 'drainage-traps', displayOrder: 6 },

  // Paints Subcategories
  { id: 'subcat-pa-interior', categoryId: 'cat-paints', name: 'Interior Luxury Emulsions', slug: 'interior-luxury-emulsions', displayOrder: 1 },
  { id: 'subcat-pa-exterior', categoryId: 'cat-paints', name: 'Weatherproof Exterior Emulsions', slug: 'weatherproof-exterior-emulsions', displayOrder: 2 },
  { id: 'subcat-pa-primers', categoryId: 'cat-paints', name: 'Wall Primers & Acrylic Putty', slug: 'wall-primers-putty', displayOrder: 3 },
  { id: 'subcat-pa-enamels', categoryId: 'cat-paints', name: 'Synthetic Enamels & Metal Primers', slug: 'synthetic-enamels', displayOrder: 4 },
  { id: 'subcat-pa-wood', categoryId: 'cat-paints', name: 'Wood Finishes, Melamyne & Stains', slug: 'wood-finishes-stains', displayOrder: 5 },
  { id: 'subcat-pa-tools', categoryId: 'cat-paints', name: 'Brushes, Rollers & Painting Tools', slug: 'painting-tools', displayOrder: 6 },

  // Lamination Subcategories
  { id: 'subcat-la-decorative', categoryId: 'cat-lamination', name: 'Decorative Laminates & Mica', slug: 'decorative-laminates-mica', displayOrder: 1 },
  { id: 'subcat-la-acrylic', categoryId: 'cat-lamination', name: 'Acrylic & High Gloss Sheets', slug: 'acrylic-high-gloss-sheets', displayOrder: 2 },
  { id: 'subcat-la-edgeband', categoryId: 'cat-lamination', name: 'Edge Banding Tapes & Trims', slug: 'edge-banding-tapes', displayOrder: 3 },
  { id: 'subcat-la-pvc', categoryId: 'cat-lamination', name: 'PVC & Charcoal Panels', slug: 'pvc-charcoal-panels', displayOrder: 4 },
  { id: 'subcat-la-adhesives', categoryId: 'cat-lamination', name: 'Laminate Adhesives & SR Glue', slug: 'laminate-adhesives', displayOrder: 5 }
];

/**
 * Get all active categories synchronously from localStorage with defaults fallback
 * Ensures the 5 core departments (Hardware, Electric, Plumbing, Paints, Lamination) are always present.
 * @returns {Array}
 */
export function getActiveCategories() {
  const deleted = new Set(getStorage(STORAGE_KEY_DELETED_CATEGORIES, []).map(String));
  const saved = getStorage(STORAGE_KEY_CATEGORIES, null);

  let list = [];
  if (Array.isArray(saved) && saved.length > 0) {
    list = saved.slice();
  } else {
    list = DEFAULT_CATEGORIES.map(c => ({ ...c }));
  }

  // Ensure all 5 core categories are always included even if stale localStorage exists
  const presentIds = new Set(list.map(c => c.id));
  DEFAULT_CATEGORIES.forEach(def => {
    if (!presentIds.has(def.id)) {
      list.push({ ...def });
    }
  });

  // Normalize canonical names and icons for core trade categories
  list = list.map(c => {
    if (c.id === 'cat-hardware') {
      return {
        ...c,
        name: 'Hardware',
        slug: 'hardware',
        icon: '🔩',
        image: c.image || 'assets/images/cat_hardware.jpg',
        imageUrl: c.imageUrl || 'assets/images/cat_hardware.jpg',
        badgeClass: 'hardware',
        displayOrder: 1
      };
    }
    if (c.id === 'cat-electric' || c.id === 'cat-electrical') {
      return {
        ...c,
        id: 'cat-electric',
        name: 'Electric',
        slug: 'electric',
        icon: '⚡',
        badgeClass: 'electrical',
        displayOrder: 2
      };
    }
    if (c.id === 'cat-plumbing') {
      return {
        ...c,
        name: 'Plumbing',
        slug: 'plumbing',
        icon: '🚰',
        badgeClass: 'plumbing',
        displayOrder: 3
      };
    }
    if (c.id === 'cat-paints') {
      return {
        ...c,
        name: 'Paints',
        slug: 'paints',
        icon: '🎨',
        badgeClass: 'paints',
        displayOrder: 4
      };
    }
    if (c.id === 'cat-lamination') {
      return {
        ...c,
        name: 'Lamination',
        slug: 'lamination',
        icon: '🪵',
        badgeClass: 'lamination',
        displayOrder: 5
      };
    }
    return c;
  });

  // Core categories can NEVER be deleted
  const filtered = list.filter(c => {
    if (CORE_CATEGORY_IDS.has(c.id)) return true;
    return !deleted.has(String(c.id));
  });

  // Deduplicate by ID
  const seen = new Set();
  const deduped = [];
  for (const c of filtered) {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      deduped.push(c);
    }
  }

  // Sort ascending by displayOrder
  deduped.sort((a, b) => (Number(a.displayOrder || 99) - Number(b.displayOrder || 99)));
  return deduped;
}

/**
 * Get all active subcategories synchronously from localStorage with defaults fallback
 * @returns {Array}
 */
export function getActiveSubcategories() {
  const deleted = new Set(getStorage(STORAGE_KEY_DELETED_SUBCATEGORIES, []).map(String));
  const saved = getStorage(STORAGE_KEY_SUBCATEGORIES, null);

  let list = [];
  if (Array.isArray(saved) && saved.length > 0) {
    list = saved;
  } else {
    list = DEFAULT_SUBCATEGORIES.slice();
  }

  return list.filter(s => !deleted.has(String(s.id)));
}

/**
 * Get subcategories belonging to a specific category
 * @param {string} categoryId
 * @returns {Array}
 */
export function getSubcategoriesForCategory(categoryId) {
  if (!categoryId) return [];
  const allSubcats = getActiveSubcategories();
  const targetId = String(categoryId);
  return allSubcats.filter(s => {
    const parentId = String(s.categoryId || s.category_id);
    if (parentId === targetId) return true;
    if ((targetId === 'cat-electric' || targetId === 'cat-electrical') && (parentId === 'cat-electric' || parentId === 'cat-electrical')) return true;
    return false;
  });
}

/**
 * Save active categories array to localStorage
 * @param {Array} categories
 */
export function saveActiveCategories(categories) {
  if (!Array.isArray(categories)) return;
  setStorage(STORAGE_KEY_CATEGORIES, categories);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('devshree:categories-updated', { detail: { categories } }));
  }
}

/**
 * Save active subcategories array to localStorage
 * @param {Array} subcategories
 */
export function saveActiveSubcategories(subcategories) {
  if (!Array.isArray(subcategories)) return;
  setStorage(STORAGE_KEY_SUBCATEGORIES, subcategories);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('devshree:subcategories-updated', { detail: { subcategories } }));
  }
}

/**
 * Add or update a Category (Admin)
 * Persists to Supabase PostgreSQL, localStorage cache, and Firestore
 * @param {Object} category
 * @returns {Promise<Object>}
 */
export async function saveCategory(category) {
  if (!category || !category.name) throw new Error('Category name is required');

  const id = category.id || `cat-${(category.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || Date.now()}`;
  const slug = category.slug || id.replace(/^cat-/, '');
  const item = {
    id,
    name: category.name.trim(),
    slug,
    description: (category.description || '').trim(),
    image: category.image || category.imageUrl || 'assets/images/placeholder.webp',
    imageUrl: category.imageUrl || category.image || 'assets/images/placeholder.webp',
    icon: category.icon || '📦',
    badgeClass: category.badgeClass || slug,
    displayOrder: category.displayOrder != null ? Number(category.displayOrder) : 99,
    updatedAt: new Date().toISOString()
  };

  // 1. Update in-memory & localStorage
  const current = getActiveCategories();
  const idx = current.findIndex(c => c.id === id);
  if (idx >= 0) {
    current[idx] = { ...current[idx], ...item };
  } else {
    current.push(item);
  }
  saveActiveCategories(current);

  // Clear from deleted list if re-added
  const deleted = getStorage(STORAGE_KEY_DELETED_CATEGORIES, []).filter(d => String(d) !== String(id));
  setStorage(STORAGE_KEY_DELETED_CATEGORIES, deleted);

  // 2. Cloud Persistence: Supabase PostgreSQL
  if (isSupabaseConfigured && !isTestingEnvironment) {
    try {
      const client = await getSupabaseClient();
      if (client) {
        await client.from('categories').upsert({
          id: item.id,
          name: item.name,
          slug: item.slug,
          description: item.description,
          image_url: item.imageUrl,
          icon: item.icon,
          badge_class: item.badgeClass,
          display_order: item.displayOrder
        });
      }
    } catch (sbErr) {
      console.warn('[Categories] Supabase category upsert fallback:', sbErr);
    }
  }

  return item;
}

/**
 * Delete a category
 * @param {string} categoryId
 * @param {Array} [productsList=[]]
 * @returns {Promise<boolean>}
 */
export async function deleteCategory(categoryId, productsList = []) {
  if (!categoryId) return false;

  // Protect core trade departments
  if (CORE_CATEGORY_IDS.has(categoryId)) {
    throw new Error('Core trade departments (Hardware, Electric, Plumbing, Paints, Lamination) cannot be deleted.');
  }

  // Protect if products are currently assigned to this category
  if (Array.isArray(productsList) && productsList.some(p => String(p.categoryId) === String(categoryId))) {
    throw new Error('Cannot delete category: products are currently assigned to this department. Reassign or remove those products first.');
  }

  const current = getActiveCategories().filter(c => c.id !== categoryId);
  saveActiveCategories(current);

  const deleted = getStorage(STORAGE_KEY_DELETED_CATEGORIES, []);
  if (!deleted.includes(categoryId)) {
    deleted.push(categoryId);
    setStorage(STORAGE_KEY_DELETED_CATEGORIES, deleted);
  }

  if (isSupabaseConfigured && !isTestingEnvironment) {
    try {
      const client = await getSupabaseClient();
      if (client) {
        await client.from('categories').delete().eq('id', categoryId);
      }
    } catch (sbErr) {
      console.warn('[Categories] Supabase category delete fallback:', sbErr);
    }
  }

  return true;
}

/**
 * Add or update a Subcategory (Admin)
 * @param {Object} subcategory
 * @returns {Promise<Object>}
 */
export async function saveSubcategory(subcategory) {
  if (!subcategory || !subcategory.name || !subcategory.categoryId) {
    throw new Error('Subcategory name and parent Category are required');
  }

  const cleanName = subcategory.name.trim();
  const slug = subcategory.slug || cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const id = subcategory.id || `subcat-${(subcategory.categoryId || '').replace('cat-', '')}-${slug || Date.now()}`;

  const item = {
    id,
    categoryId: subcategory.categoryId,
    category_id: subcategory.categoryId,
    name: cleanName,
    slug,
    displayOrder: subcategory.displayOrder != null ? Number(subcategory.displayOrder) : 99,
    updatedAt: new Date().toISOString()
  };

  // 1. Update in-memory & localStorage
  const current = getActiveSubcategories();
  const idx = current.findIndex(s => s.id === id);
  if (idx >= 0) {
    current[idx] = { ...current[idx], ...item };
  } else {
    current.push(item);
  }
  saveActiveSubcategories(current);

  // Clear from deleted list
  const deleted = getStorage(STORAGE_KEY_DELETED_SUBCATEGORIES, []).filter(d => String(d) !== String(id));
  setStorage(STORAGE_KEY_DELETED_SUBCATEGORIES, deleted);

  // 2. Cloud Persistence: Supabase PostgreSQL
  if (isSupabaseConfigured && !isTestingEnvironment) {
    try {
      const client = await getSupabaseClient();
      if (client) {
        await client.from('subcategories').upsert({
          id: item.id,
          category_id: item.categoryId,
          name: item.name,
          slug: item.slug,
          display_order: item.displayOrder
        });
      }
    } catch (sbErr) {
      console.warn('[Subcategories] Supabase subcategory upsert fallback:', sbErr);
    }
  }

  return item;
}

/**
 * Delete a subcategory
 * @param {string} subcategoryId
 * @returns {Promise<boolean>}
 */
export async function deleteSubcategory(subcategoryId) {
  if (!subcategoryId) return false;

  const current = getActiveSubcategories().filter(s => s.id !== subcategoryId);
  saveActiveSubcategories(current);

  const deleted = getStorage(STORAGE_KEY_DELETED_SUBCATEGORIES, []);
  if (!deleted.includes(subcategoryId)) {
    deleted.push(subcategoryId);
    setStorage(STORAGE_KEY_DELETED_SUBCATEGORIES, deleted);
  }

  if (isSupabaseConfigured && !isTestingEnvironment) {
    try {
      const client = await getSupabaseClient();
      if (client) {
        await client.from('subcategories').delete().eq('id', subcategoryId);
      }
    } catch (sbErr) {
      console.warn('[Subcategories] Supabase subcategory delete fallback:', sbErr);
    }
  }

  return true;
}

/**
 * Fetch live categories from Supabase / Firestore with 0ms cache update
 * @returns {Promise<Array>}
 */
export async function fetchAllCategoriesLive() {
  const deleted = new Set(getStorage(STORAGE_KEY_DELETED_CATEGORIES, []).map(String));

  if (isSupabaseConfigured) {
    try {
      const client = await getSupabaseClient();
      if (client) {
        const { data, error } = await client.from('categories').select('*').order('display_order', { ascending: true });
        if (!error && Array.isArray(data) && data.length > 0) {
          let list = data
            .filter(c => CORE_CATEGORY_IDS.has(c.id) || !deleted.has(String(c.id)))
            .map(c => {
              let name = c.name;
              let icon = c.icon || '📦';
              let displayOrder = c.display_order != null ? Number(c.display_order) : 99;
              let image = c.image_url || 'assets/images/placeholder.webp';

              if (c.id === 'cat-hardware') {
                name = 'Hardware';
                icon = '🔩';
                displayOrder = 1;
                image = 'assets/images/cat_hardware.jpg';
              } else if (c.id === 'cat-electric' || c.id === 'cat-electrical') {
                name = 'Electric';
                icon = '⚡';
                displayOrder = 2;
                image = 'assets/images/cat_electrical.jpg';
              } else if (c.id === 'cat-plumbing') {
                name = 'Plumbing';
                icon = '🚰';
                displayOrder = 3;
                image = 'assets/images/cat_plumbing.jpg';
              } else if (c.id === 'cat-paints') {
                name = 'Paints';
                icon = '🎨';
                displayOrder = 4;
                image = 'assets/images/cat_paints.jpg';
              } else if (c.id === 'cat-lamination') {
                name = 'Lamination';
                icon = '🪵';
                displayOrder = 5;
                image = 'assets/images/categories/cat_laminates_liners.jpg';
              }

              return {
                id: c.id === 'cat-electrical' ? 'cat-electric' : c.id,
                name,
                slug: c.slug,
                description: c.description || '',
                image,
                imageUrl: image,
                icon,
                badgeClass: c.badge_class || c.slug,
                displayOrder
              };
            });

          // Ensure all 5 core categories are always present
          const presentIds = new Set(list.map(c => c.id));
          DEFAULT_CATEGORIES.forEach(def => {
            if (!presentIds.has(def.id)) {
              list.push({ ...def });
            }
          });

          // Deduplicate and sort
          const seen = new Set();
          const deduped = [];
          for (const c of list) {
            if (!seen.has(c.id)) {
              seen.add(c.id);
              deduped.push(c);
            }
          }
          deduped.sort((a, b) => (Number(a.displayOrder || 99) - Number(b.displayOrder || 99)));

          saveActiveCategories(deduped);
          return deduped;
        }
      }
    } catch (sbErr) {
      console.warn('[Categories] Supabase live fetch fallback:', sbErr);
    }
  }

  return getActiveCategories();
}

/**
 * Fetch live subcategories from Supabase / Firestore with 0ms cache update
 * @returns {Promise<Array>}
 */
export async function fetchAllSubcategoriesLive() {
  const deleted = new Set(getStorage(STORAGE_KEY_DELETED_SUBCATEGORIES, []).map(String));

  if (isSupabaseConfigured) {
    try {
      const client = await getSupabaseClient();
      if (client) {
        const { data, error } = await client.from('subcategories').select('*').order('display_order', { ascending: true });
        if (!error && Array.isArray(data) && data.length > 0) {
          const list = data
            .filter(s => !deleted.has(String(s.id)))
            .map(s => ({
              id: s.id,
              categoryId: s.category_id,
              category_id: s.category_id,
              name: s.name,
              slug: s.slug,
              displayOrder: s.display_order || 0
            }));
          saveActiveSubcategories(list);
          return list;
        }
      }
    } catch (sbErr) {
      console.warn('[Subcategories] Supabase live fetch fallback:', sbErr);
    }
  }

  return getActiveSubcategories();
}

/**
 * Returns clean human-readable Category name
 * @param {string} catId
 * @returns {string}
 */
export function formatCategoryName(catId) {
  if (!catId) return 'General';
  const cats = getActiveCategories();
  const found = cats.find(c => c.id === catId || c.slug === catId);
  if (found) return found.name;

  switch (catId) {
    case 'cat-electric':
    case 'cat-electrical': return 'Electric';
    case 'cat-hardware': return 'Hardware';
    case 'cat-plumbing': return 'Plumbing';
    case 'cat-paints': return 'Paints';
    case 'cat-lamination': return 'Lamination';
    default:
      return catId.replace(/^cat-/, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
}

/**
 * Returns clean human-readable Subcategory name
 * @param {string} subcatId
 * @returns {string}
 */
export function formatSubcategoryName(subcatId) {
  if (!subcatId) return '';
  const subcats = getActiveSubcategories();
  const found = subcats.find(s => s.id === subcatId || s.slug === subcatId);
  if (found) return found.name;

  return subcatId.replace(/^subcat-[a-z]+-/, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Reset Categories and Subcategories to factory defaults
 */
export function resetCategoriesToDefault() {
  setStorage(STORAGE_KEY_CATEGORIES, DEFAULT_CATEGORIES);
  setStorage(STORAGE_KEY_DELETED_CATEGORIES, []);
  setStorage(STORAGE_KEY_SUBCATEGORIES, DEFAULT_SUBCATEGORIES);
  setStorage(STORAGE_KEY_DELETED_SUBCATEGORIES, []);
}
