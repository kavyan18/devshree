/**
 * DEVSHREE — FILE UPLOAD & IMAGE VALIDATOR ENGINE
 * 
 * Provides strict multi-layered security validation for file uploads:
 * 1. File Type & Extension Whitelist (rejects executables, scripts, SVGs, HTML).
 * 2. Strict Size Boundary Validation (rejects empty 0-byte files and files > 5MB).
 * 3. Deep Binary Content Inspection (verifies magic bytes for JPEG, PNG, WebP).
 * 4. Dangerous Content Detection (detects & blocks SVGs, PHP, HTML, ELF, PE/EXE).
 * 5. Safe Cryptographic Filename Generation (completely discards user filenames).
 * 6. Storage Isolation Verification (ensures uploads are kept out of web root).
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
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // RIFF
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50  // WEBP
};

/**
 * Signatures for malicious/executable files disguised as images
 */
const DANGEROUS_SIGNATURES = {
  // PE / Windows executable (MZ)
  peExe: (bytes) => bytes.length >= 2 && bytes[0] === 0x4D && bytes[1] === 0x5A,
  // Linux ELF
  elf: (bytes) => bytes.length >= 4 && bytes[0] === 0x7F && bytes[1] === 0x45 && bytes[2] === 0x4C && bytes[3] === 0x46,
  // Shell Shebang #!
  shebang: (bytes) => bytes.length >= 2 && bytes[0] === 0x23 && bytes[1] === 0x21,
  // Java class file (CA FE BA BE)
  javaClass: (bytes) => bytes.length >= 4 && bytes[0] === 0xCA && bytes[1] === 0xFE && bytes[2] === 0xBA && bytes[3] === 0xBE,
  // ZIP / APK / Jar (PK..)
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
 * @param {Uint8Array|number[]} bytes - Initial slice of bytes (at least 16 bytes recommended)
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
      // Allow minor jpeg/jpg mismatch
      const isBothJpeg = (inspection.detectedMime === 'image/jpeg' && normMime === 'image/jpeg');
      if (!isBothJpeg) {
        return {
          valid: false,
          error: `MIME type spoofing detected: reported as "${type}" but binary signature is "${inspection.detectedMime}".`
        };
      }
    }
  }

  // 5. Generate Safe Cryptographic Filename (completely strips user path & original name)
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
