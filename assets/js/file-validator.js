/**
 * DEVSHREE — CLIENT-SIDE IMAGE VALIDATOR & SANITIZER (BROWSER-NATIVE)
 * 
 * Fully self-contained browser module with multi-layer client-side protection:
 * 1. File Type & Extension Whitelist (rejects executables, scripts, SVGs, HTML).
 * 2. Strict Size Boundary Validation (rejects empty 0-byte files and files > 5MB).
 * 3. Deep Binary Content Inspection (verifies magic bytes for JPEG, PNG, WebP).
 * 4. Dangerous Content Detection (detects & blocks SVGs, PHP, HTML, ELF, PE/EXE).
 * 5. Safe Cryptographic Filename Generation (completely discards user filenames).
 * 6. Storage Isolation Verification (ensures uploads are kept out of web root).
 * 7. Deep Canvas Sanitization: Re-encodes the image onto an HTML5 Canvas, completely
 *    destroying polyglot code, script injections, and malformed EXIF metadata.
 */

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MIN_FILE_SIZE_BYTES = 1; // 1 byte

export const ALLOWED_EXTENSIONS = Object.freeze(['.jpg', '.jpeg', '.png', '.webp']);
export const ALLOWED_MIME_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);

export const DANGEROUS_EXTENSIONS = Object.freeze([
  '.exe', '.dll', '.so', '.bin', '.com', '.bat', '.cmd', '.ps1', '.sh', '.bash',
  '.php', '.php3', '.php4', '.php5', '.phtml', '.phps',
  '.html', '.htm', '.xhtml', '.shtml',
  '.js', '.mjs', '.cjs', '.ts', '.vbs',
  '.jsp', '.asp', '.aspx', '.py', '.pl', '.cgi',
  '.svg', '.xml', '.svgz'
]);

/**
 * Magic Byte Signatures for Permitted Images
 */
const MAGIC_SIGNATURES = {
  // JPEG starts with FF D8 FF
  jpeg: (bytes) => bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF,
  // PNG starts with 89 50 4E 47 0D 0A 1A 0A
  png: (bytes) => bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
    bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A,
  // WebP starts with RIFF (bytes 0..3: 0x52, 0x49, 0x46, 0x46) and WEBP (bytes 8..11: 0x57, 0x45, 0x42, 0x50)
  webp: (bytes) => bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
};

/**
 * Signatures for malicious/executable files disguised as images
 */
const DANGEROUS_SIGNATURES = {
  peExe: (bytes) => bytes.length >= 2 && bytes[0] === 0x4D && bytes[1] === 0x5A,
  elf: (bytes) => bytes.length >= 4 && bytes[0] === 0x7F && bytes[1] === 0x45 && bytes[2] === 0x4C && bytes[3] === 0x46,
  shebang: (bytes) => bytes.length >= 2 && bytes[0] === 0x23 && bytes[1] === 0x21,
  javaClass: (bytes) => bytes.length >= 4 && bytes[0] === 0xCA && bytes[1] === 0xFE && bytes[2] === 0xBA && bytes[3] === 0xBE,
  zip: (bytes) => bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04
};

/**
 * Extracts the file extension (in lowercase, including dot)
 * @param {string} filename
 * @returns {string}
 */
export function getFileExtension(filename = '') {
  if (typeof filename !== 'string') return '';
  const clean = filename.trim().toLowerCase();
  const lastDot = clean.lastIndexOf('.');
  if (lastDot === -1) return '';
  return clean.slice(lastDot);
}

/**
 * Inspect raw binary bytes to determine genuine image format by magic numbers.
 * @param {Uint8Array|number[]} bytes
 * @returns {{ isValid: boolean, format: string|null, detectedMime: string|null, isDangerous: boolean, reason?: string }}
 */
export function inspectMagicBytes(bytes) {
  if (!bytes || bytes.length < 3) {
    return { isValid: false, format: null, detectedMime: null, isDangerous: false, reason: 'File content too short or empty' };
  }

  // 1. Check for dangerous executable signatures
  if (DANGEROUS_SIGNATURES.peExe(bytes)) {
    return { isValid: false, format: 'exe', detectedMime: 'application/x-msdownload', isDangerous: true, reason: 'Windows executable binary signature detected' };
  }
  if (DANGEROUS_SIGNATURES.elf(bytes)) {
    return { isValid: false, format: 'elf', detectedMime: 'application/x-executable', isDangerous: true, reason: 'Linux ELF executable binary signature detected' };
  }
  if (DANGEROUS_SIGNATURES.shebang(bytes)) {
    return { isValid: false, format: 'script', detectedMime: 'text/x-shellscript', isDangerous: true, reason: 'Executable shell script detected' };
  }
  if (DANGEROUS_SIGNATURES.javaClass(bytes)) {
    return { isValid: false, format: 'class', detectedMime: 'application/java-vm', isDangerous: true, reason: 'Compiled Java bytecode detected' };
  }

  // 2. Check for script/HTML/SVG text patterns in leading bytes
  const textPrefix = Array.from(bytes.slice(0, 100))
    .map(b => String.fromCharCode(b))
    .join('')
    .toLowerCase();

  if (/<\?php|<\?=|<!doctype\s+html|<html|<script|<\?xml|<svg/i.test(textPrefix)) {
    const isSvg = /<svg|<\?xml.*<svg/i.test(textPrefix);
    return {
      isValid: false,
      format: isSvg ? 'svg' : 'script',
      detectedMime: isSvg ? 'image/svg+xml' : 'text/html',
      isDangerous: true,
      reason: isSvg
        ? 'SVG files are disallowed due to embedded script execution risks'
        : 'HTML or script tag pattern detected in file header'
    };
  }

  // 3. Check for valid permitted image magic signatures
  if (MAGIC_SIGNATURES.jpeg(bytes)) {
    return { isValid: true, format: 'jpeg', detectedMime: 'image/jpeg', isDangerous: false };
  }
  if (MAGIC_SIGNATURES.png(bytes)) {
    return { isValid: true, format: 'png', detectedMime: 'image/png', isDangerous: false };
  }
  if (MAGIC_SIGNATURES.webp(bytes)) {
    return { isValid: true, format: 'webp', detectedMime: 'image/webp', isDangerous: false };
  }

  return {
    isValid: false,
    format: null,
    detectedMime: null,
    isDangerous: false,
    reason: 'Binary header does not match any recognized permitted image format (JPEG, PNG, WebP)'
  };
}

/**
 * Validates file metadata and binary content against all security rules.
 * 
 * @param {Object} options
 * @param {string} options.name - Original filename
 * @param {number} options.size - File size in bytes
 * @param {string} options.type - Client-reported MIME type
 * @param {Uint8Array} options.bytes - Initial bytes of the file (at least 16 bytes)
 * @param {Object} [config]
 * @returns {{ valid: boolean, error?: string, sanitizedFileName?: string, mimeType?: string, extension?: string }}
 */
export function validateImageUpload({ name, size, type, bytes }, config = {}) {
  const maxBytes = config.maxBytes || MAX_FILE_SIZE_BYTES;
  const minBytes = config.minBytes || MIN_FILE_SIZE_BYTES;

  // 1. Size Validation
  if (typeof size !== 'number' || isNaN(size) || size < minBytes) {
    return { valid: false, error: 'File is empty. Please select a valid product image.' };
  }
  if (size > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    return { valid: false, error: `File size exceeds the ${maxMb}MB limit. Please upload a smaller image.` };
  }

  // 2. Extension Validation
  const ext = getFileExtension(name);
  if (!ext) {
    return { valid: false, error: 'File is missing an extension. Please select a .jpg, .png, or .webp image.' };
  }
  if (ext === '.svg' || ext === '.svgz') {
    return { valid: false, error: 'SVG images are strictly prohibited for security reasons.' };
  }
  if (DANGEROUS_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `Dangerous file extension "${ext}" is strictly forbidden.` };
  }
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `Extension "${ext}" is not permitted. Only JPG, PNG, and WebP images are allowed.` };
  }

  // 3. MIME Type Validation (normalize variations & check against whitelist)
  let normMime = (type || '').trim().toLowerCase();
  if (normMime === 'image/jpg' || normMime === 'image/pjpeg') normMime = 'image/jpeg';
  if (normMime === 'image/x-png') normMime = 'image/png';
  if (!normMime) {
    if (ext === '.jpg' || ext === '.jpeg') normMime = 'image/jpeg';
    else if (ext === '.png') normMime = 'image/png';
    else if (ext === '.webp') normMime = 'image/webp';
  }

  if (normMime === 'image/svg+xml' || ext === '.svg' || ext === '.svgz') {
    return { valid: false, error: 'SVG images are strictly prohibited for security reasons.' };
  }
  if (!ALLOWED_MIME_TYPES.includes(normMime)) {
    return { valid: false, error: `MIME type "${normMime || type}" is not allowed. Only JPEG, PNG, and WebP are accepted.` };
  }

  // 4. Content / Magic Bytes Inspection
  if (bytes) {
    const inspection = inspectMagicBytes(bytes);
    if (!inspection.isValid) {
      return {
        valid: false,
        error: inspection.reason || 'File content does not match a valid image. The file may be disguised or corrupted.'
      };
    }

    // Verify magic bytes match reported MIME type family
    if (inspection.detectedMime !== normMime) {
      const isBothJpeg = (inspection.detectedMime === 'image/jpeg' && normMime === 'image/jpeg');
      if (!isBothJpeg) {
        return {
          valid: false,
          error: `MIME type spoofing detected: reported as "${type}" but binary signature is "${inspection.detectedMime}".`
        };
      }
    }
  }

  // 5. Generate Safe Cryptographic Filename
  const safeExt = normMime === 'image/webp' ? 'webp' : (normMime === 'image/png' ? 'png' : 'jpg');
  const safeFileName = generateSafeFileName(safeExt);

  return {
    valid: true,
    sanitizedFileName: safeFileName,
    mimeType: normMime,
    extension: `.${safeExt}`
  };
}

/**
 * Generate a cryptographically random, collision-resistant filename.
 * Strips any original filename, directory traversal characters, or dangerous symbols.
 * 
 * @param {string} extension - File extension without dot ('jpg', 'png', 'webp')
 * @returns {string}
 */
export function generateSafeFileName(extension = 'jpg') {
  const ext = extension.replace(/^\./, '').toLowerCase();
  const timestamp = Date.now();
  let randToken = '';
  
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    randToken = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  } else if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(6);
    crypto.getRandomValues(arr);
    randToken = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  } else {
    randToken = Math.random().toString(36).substring(2, 14);
  }

  return `prod_${timestamp}_${randToken}.${ext}`;
}

/**
 * Verifies that a storage path is strictly isolated outside the web root.
 * 
 * @param {string} destinationPath
 * @returns {{ isIsolated: boolean, reason?: string }}
 */
export function verifyStorageIsolation(destinationPath = '') {
  const normalized = destinationPath.replace(/\\/g, '/');

  // Must not target local web root folders
  const webRootViolations = [
    /^\.?\/?public\//i,
    /^\.?\/?assets\//i,
    /^\.?\/?api\//i,
    /^\.?\/?node_modules\//i,
    /^\.?\/?bin\//i,
    /\.\.\//, // Directory traversal
    /\0/      // Null byte
  ];

  for (const pattern of webRootViolations) {
    if (pattern.test(normalized)) {
      return {
        isIsolated: false,
        reason: `Destination path "${destinationPath}" violates web root isolation policy.`
      };
    }
  }

  // Permitted isolated storage destinations
  const allowedPrefixes = ['products/', 'categories/', 'users/'];
  const hasAllowedPrefix = allowedPrefixes.some(p => normalized.startsWith(p));

  if (!hasAllowedPrefix) {
    return {
      isIsolated: false,
      reason: `Storage path "${destinationPath}" must reside under an approved isolated bucket folder (products/, categories/, users/).`
    };
  }

  return { isIsolated: true };
}

/**
 * Convert a base64 DataURL into a binary Blob cleanly
 * @param {string} dataUrl
 * @returns {Blob}
 */
export function dataUrlToBlob(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return new Blob([], { type: 'image/jpeg' });
  }
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

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
    try {
      const buffer = await file.slice(0, byteCount).arrayBuffer();
      return new Uint8Array(buffer);
    } catch (_) {}
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
        try {
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
          if (!ctx) {
            throw new Error('Canvas 2D context unavailable');
          }

          // Draw image cleanly on canvas
          ctx.drawImage(img, 0, 0, w, h);

          // Convert to dataUrl for immediate UI preview
          let dataUrl = '';
          try {
            dataUrl = canvas.toDataURL(preferredFormat, quality);
          } catch (_) {}
          if (!dataUrl || dataUrl === 'data:,') {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          // Finalize with pristine binary blob
          const finalizeWithBlob = (blob) => {
            const finalBlob = blob || dataUrlToBlob(dataUrl);
            const outputExt = (finalBlob.type === 'image/webp') ? 'webp' : 'jpg';
            const safeFileName = generateSafeFileName(outputExt);

            resolve({
              sanitizedBlob: finalBlob,
              dataUrl,
              width: w,
              height: h,
              size: finalBlob.size,
              mimeType: finalBlob.type || 'image/jpeg',
              safeFileName
            });
          };

          if (typeof canvas.toBlob === 'function') {
            canvas.toBlob((blob) => {
              if (blob) {
                finalizeWithBlob(blob);
              } else {
                canvas.toBlob((jpegBlob) => {
                  finalizeWithBlob(jpegBlob);
                }, 'image/jpeg', quality);
              }
            }, preferredFormat, quality);
          } else {
            finalizeWithBlob(dataUrlToBlob(dataUrl));
          }
        } catch (canvasErr) {
          reject(canvasErr);
        }
      };

      img.onerror = () => reject(new Error('Corrupted or unreadable image file.'));
      img.src = e.target.result;
    };

    reader.onerror = () => reject(new Error('Error reading image file data.'));
    reader.readAsDataURL(file);
  });
}
