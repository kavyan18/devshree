/**
 * DEVSHREE — SUPABASE & CLOUDFLARE CDN CLIENT CONFIGURATION
 * Connects directly to high-performance PostgreSQL 17 database & Edge CDN storage.
 *
 * Configured project:
 * Project URL: https://kbdjezowhuteumywjoep.supabase.co
 * CDN Buckets: 'products', 'catalogs'
 */

// Determine environment configuration
const runtimeConfig = (typeof window !== 'undefined' && window.__DEVSHREE_SUPABASE_CONFIG) || {};
const envConfig = (typeof process !== 'undefined' && process.env) || {};

let storedConfig = {};
try {
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem('devshree_supabase_runtime_config');
    if (raw) storedConfig = JSON.parse(raw);
  }
} catch (_) {}

function cleanVal(val, fallback) {
  if (typeof val === 'string' && val.trim() && !val.startsWith('YOUR_')) {
    return val.trim();
  }
  return fallback;
}

export const supabaseConfig = {
  supabaseUrl: cleanVal(
    runtimeConfig.supabaseUrl || envConfig.SUPABASE_URL || storedConfig.supabaseUrl,
    "https://kbdjezowhuteumywjoep.supabase.co"
  ),
  supabaseAnonKey: cleanVal(
    runtimeConfig.supabaseAnonKey || envConfig.SUPABASE_ANON_KEY || storedConfig.supabaseAnonKey,
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtiZGplem93aHV0ZXVteXdqb2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ4MDk3MzcsImV4cCI6MjExMDM4NTczN30.HYi_-O3k3eRgtoHqRctbAY8g6lG1ESnGTrrsxZdHV64"
  )
};

export const isSupabaseConfigured = Boolean(
  supabaseConfig.supabaseUrl &&
  !supabaseConfig.supabaseUrl.startsWith("YOUR_") &&
  supabaseConfig.supabaseAnonKey &&
  !supabaseConfig.supabaseAnonKey.startsWith("YOUR_")
);

// Client instance initialization (supports Browser ESM CDN and Node.js)
let supabase = null;
let initPromise = null;

export async function getSupabaseClient() {
  if (supabase) return supabase;
  if (!isSupabaseConfigured) return null;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      let createClientFn = null;

      if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
        createClientFn = window.supabase.createClient;
      } else if (typeof window !== 'undefined') {
        // Browser ESM CDN import with fallbacks
        try {
          const mod = await import('https://esm.sh/@supabase/supabase-js@2');
          createClientFn = mod.createClient;
        } catch (cdnErr) {
          console.warn('[Devshree] Failed to import supabase from esm.sh, trying jsdelivr...', cdnErr);
          const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
          createClientFn = mod.createClient;
        }
      } else {
        // Node.js environment
        const mod = await import('@supabase/supabase-js');
        createClientFn = mod.createClient;
      }

      if (createClientFn) {
        supabase = createClientFn(supabaseConfig.supabaseUrl, supabaseConfig.supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true
          }
        });
        if (typeof window !== 'undefined') {
          window.__devshree_supabase = supabase;
        }
        console.log('[Devshree] Connected to Supabase PostgreSQL & CDN:', supabaseConfig.supabaseUrl);
      }
    } catch (err) {
      console.warn('[Devshree] Supabase initialization notice:', err.message);
    }
    return supabase;
  })();

  return initPromise;
}

// Immediate eager initialization attempt
if (isSupabaseConfigured) {
  getSupabaseClient().catch(() => {});
}

/**
 * Generate a public CDN URL for a bucket object
 * @param {string} bucket - 'products' | 'catalogs'
 * @param {string} path - File path or name
 * @returns {string} Public CDN URL
 */
export function getPublicStorageUrl(bucket, path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:') || path.startsWith('indexeddb:')) {
    return path;
  }
  const cleanPath = path.replace(/^\/+/, '');
  return `${supabaseConfig.supabaseUrl}/storage/v1/object/public/${bucket}/${cleanPath}`;
}

/**
 * Upload a file directly to Supabase Storage CDN
 * @param {string} bucket - 'products' | 'catalogs'
 * @param {string} path - Storage path
 * @param {File|Blob|ArrayBuffer} file - File content
 * @param {Object} [options]
 * @returns {Promise<{publicUrl: string, path: string}>}
 */
export async function uploadFileToStorage(bucket, path, file, options = {}) {
  const client = await getSupabaseClient();
  if (!client) throw new Error('Supabase client is not available');

  const { data, error } = await client.storage
    .from(bucket)
    .upload(path, file, {
      upsert: true,
      contentType: options.contentType || (file && file.type) || undefined,
      ...options
    });

  if (error) throw error;
  const publicUrl = getPublicStorageUrl(bucket, path);
  return { data, publicUrl, path };
}

/**
 * Remove file(s) from Supabase Storage
 * @param {string} bucket - 'products' | 'catalogs'
 * @param {Array<string>} paths - Array of file paths to remove
 */
export async function removeStorageFile(bucket, paths) {
  const client = await getSupabaseClient();
  if (!client) return { error: new Error('Supabase client is not available') };
  return await client.storage.from(bucket).remove(Array.isArray(paths) ? paths : [paths]);
}

export { supabase };

