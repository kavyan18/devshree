/**
 * DEVSHREE — CLIENT-SIDE IMAGE VALIDATOR & SANITIZER
 * 
 * Multi-layer client-side protection:
 * 1. Validates extension against whitelist (.jpg, .jpeg, .png, .webp).
 * 2. Validates size (rejects 0 bytes or > 5MB).
 * 3. Validates MIME type (rejects SVGs, HTML, and arbitrary binaries).
 * 4. Inspects binary magic numbers (verifies real JPEG, PNG, or WebP bytes).
 * 5. Deep Canvas Sanitization: Re-encodes the image onto an HTML5 Canvas, completely
 *    destroying polyglot code, script injections, and malformed EXIF metadata.
 * 6. Generates safe cryptographic filenames ignoring user-provided names.
 */

import {
  MAX_FILE_SIZE_BYTES,
  MIN_FILE_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  DANGEROUS_EXTENSIONS,
  getFileExtension,
  inspectMagicBytes,
  validateImageUpload,
  generateSafeFileName,
  verifyStorageIsolation
} from '../../lib/file-validator.js';

export {
  MAX_FILE_SIZE_BYTES,
  MIN_FILE_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  DANGEROUS_EXTENSIONS,
  getFileExtension,
  inspectMagicBytes,
  validateImageUpload,
  generateSafeFileName,
  verifyStorageIsolation
};

/**
 * Reads the first N bytes of a browser File / Blob as a Uint8Array
 * @param {Blob|File} file
 * @param {number} [byteCount=64]
 * @returns {Promise<Uint8Array>}
 */
export async function readFileHeaderBytes(file, byteCount = 64) {
  if (!file) throw new Error('No file provided');

  // Modern browsers: file.slice().arrayBuffer()
  if (file.slice && typeof file.slice(0, byteCount).arrayBuffer === 'function') {
    const buffer = await file.slice(0, byteCount).arrayBuffer();
    return new Uint8Array(buffer);
  }

  // Fallback to FileReader
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const slice = file.slice(0, byteCount);
    reader.onload = (e) => resolve(new Uint8Array(e.target.result));
    reader.onerror = () => reject(new Error('Failed to read file binary header'));
    reader.readAsArrayBuffer(slice);
  });
}

/**
 * Fully validates a browser File object before any upload or canvas operation.
 * Checks extension, size, MIME type, and binary magic bytes.
 * 
 * @param {File} file
 * @param {Object} [config]
 * @returns {Promise<{ valid: boolean, error?: string, sanitizedFileName?: string, mimeType?: string, extension?: string }>}
 */
export async function validateBrowserFile(file, config = {}) {
  if (!file) {
    return { valid: false, error: 'No file selected. Please choose an image.' };
  }

  // 1. Read binary header (magic bytes)
  let bytes = null;
  try {
    bytes = await readFileHeaderBytes(file, 64);
  } catch (_) {
    return { valid: false, error: 'Unable to inspect file contents. File may be unreadable.' };
  }

  // 2. Run comprehensive validator
  return validateImageUpload({
    name: file.name,
    size: file.size,
    type: file.type,
    bytes
  }, config);
}

/**
 * Deep Canvas Image Sanitization & Optimization
 * 
 * Renders the image through an HTML5 canvas and re-encodes it into a pristine Blob.
 * This completely strips:
 * - Hidden polyglot executable payloads
 * - Embedded script tags (<script>, onload handlers)
 * - Malicious or oversized EXIF / metadata chunks
 * 
 * @param {File|Blob} file
 * @param {Object} [options]
 * @param {number} [options.maxDimension=1200]
 * @param {number} [options.quality=0.88]
 * @param {string} [options.outputFormat='image/webp']
 * @returns {Promise<{ sanitizedBlob: Blob, dataUrl: string, width: number, height: number, size: number, safeFileName: string }>}
 */
export async function sanitizeAndOptimizeImage(file, options = {}) {
  // First, run full binary & metadata validation
  const validation = await validateBrowserFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const maxDim = options.maxDimension || 1200;
  const quality = options.quality || 0.88;
  const preferredFormat = options.outputFormat || 'image/webp';

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;

        // Downscale proportionally if larger than maxDim
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

        // Draw image cleanly on canvas
        ctx.drawImage(img, 0, 0, w, h);

        // Convert to dataUrl for immediate UI preview
        let dataUrl = '';
        try {
          dataUrl = canvas.toDataURL(preferredFormat, quality);
        } catch (_) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        // Convert to clean binary Blob
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Canvas image re-encoding failed.'));
            return;
          }

          const outputExt = (blob.type === 'image/webp') ? 'webp' : 'jpg';
          const safeFileName = generateSafeFileName(outputExt);

          resolve({
            sanitizedBlob: blob,
            dataUrl,
            width: w,
            height: h,
            size: blob.size,
            mimeType: blob.type,
            safeFileName
          });
        }, preferredFormat, quality);
      };

      img.onerror = () => reject(new Error('Corrupted or unreadable image file.'));
      img.src = e.target.result;
    };

    reader.onerror = () => reject(new Error('Error reading image file data.'));
    reader.readAsDataURL(file);
  });
}

