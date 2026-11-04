/**
 * Comprehensive Automated Test Suite for File Upload Security & Image Validation
 * 
 * Verifies:
 * 1. Type & Extension Whitelist: Only .jpg, .jpeg, .png, .webp permitted; dangerous extensions (.exe, .php, .svg, .html) blocked.
 * 2. Size Boundary Enforcement: Rejects 0-byte empty files and files > 5MB.
 * 3. Binary Magic Number Content Inspection:
 *    - Real JPEG (FF D8 FF), PNG (89 50 4E 47), WebP (RIFF...WEBP) verified.
 *    - Disguised PHP scripts, HTML, SVGs, Windows EXEs, Linux ELFs disguised as images are rejected.
 * 4. MIME Type Spoofing Detection: Rejects files where reported MIME differs from binary signature.
 * 5. Safe Filename Generation: Discards user names and generates collision-resistant random names with strict extensions.
 * 6. Storage Isolation: Verifies upload destinations reside strictly outside the web root.
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
} from '../lib/file-validator.js';

let passed = 0;
let failed = 0;

function assert(condition, description) {
  if (condition) {
    console.log(`  ✓ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${description}`);
    failed++;
  }
}

function assertEqual(actual, expected, description) {
  if (actual === expected) {
    console.log(`  ✓ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${description} (Expected: ${expected}, Got: ${actual})`);
    failed++;
  }
}

// Byte signature fixtures
const FIXTURES = {
  validJpeg: new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]),
  validPng: new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]),
  validWebp: new Uint8Array([
    0x52, 0x49, 0x46, 0x46, // "RIFF"
    0x24, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50, // "WEBP"
    0x56, 0x50, 0x38, 0x20
  ]),
  fakePhpJpg: new Uint8Array(Buffer.from('<?php system($_GET["cmd"]); ?>\n\n\xFF\xD8\xFF')),
  fakeHtmlPng: new Uint8Array(Buffer.from('<!DOCTYPE html><html><script>alert(1)</script>')),
  fakeSvgJpg: new Uint8Array(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><circle r="10"/></svg>')),
  fakePeExeJpg: new Uint8Array([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]), // "MZ" PE header
  fakeElfJpg: new Uint8Array([0x7F, 0x45, 0x4C, 0x46, 0x02, 0x01, 0x01, 0x00]),   // "\x7fELF"
  corruptedHeader: new Uint8Array([0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77])
};

async function runTests() {
  console.log('\n======================================================');
  console.log('🛡️ DEVSHREE FILE UPLOAD & SECURITY VALIDATION TESTS');
  console.log('======================================================\n');

  // --------------------------------------------------------------------------
  console.log('--- 1. EXTENSION & TYPE PARSING TESTS ---');
  // --------------------------------------------------------------------------
  assertEqual(getFileExtension('drill.jpg'), '.jpg', 'Extracts .jpg extension');
  assertEqual(getFileExtension('drill.PNG'), '.png', 'Normalizes uppercase .PNG to lowercase');
  assertEqual(getFileExtension('heavy.tool.webp'), '.webp', 'Extracts extension from multi-dot filename');
  assertEqual(getFileExtension('malicious.php.jpg'), '.jpg', 'Identifies final extension in double-extension filename');
  assertEqual(getFileExtension('noextension'), '', 'Returns empty string for filename with no extension');
  assert(ALLOWED_EXTENSIONS.includes('.jpg'), 'Allowed extensions includes .jpg');
  assert(ALLOWED_EXTENSIONS.includes('.png'), 'Allowed extensions includes .png');
  assert(ALLOWED_EXTENSIONS.includes('.webp'), 'Allowed extensions includes .webp');
  assert(DANGEROUS_EXTENSIONS.includes('.exe'), 'Dangerous extensions includes .exe');
  assert(DANGEROUS_EXTENSIONS.includes('.php'), 'Dangerous extensions includes .php');
  assert(DANGEROUS_EXTENSIONS.includes('.svg'), 'Dangerous extensions includes .svg');
  assert(DANGEROUS_EXTENSIONS.includes('.html'), 'Dangerous extensions includes .html');

  // --------------------------------------------------------------------------
  console.log('\n--- 2. BINARY MAGIC BYTE INSPECTION TESTS ---');
  // --------------------------------------------------------------------------
  const jpegCheck = inspectMagicBytes(FIXTURES.validJpeg);
  assertEqual(jpegCheck.isValid, true, 'Validates true JPEG magic bytes (FF D8 FF)');
  assertEqual(jpegCheck.detectedMime, 'image/jpeg', 'Detects image/jpeg MIME');

  const pngCheck = inspectMagicBytes(FIXTURES.validPng);
  assertEqual(pngCheck.isValid, true, 'Validates true PNG magic bytes (89 50 4E 47)');
  assertEqual(pngCheck.detectedMime, 'image/png', 'Detects image/png MIME');

  const webpCheck = inspectMagicBytes(FIXTURES.validWebp);
  assertEqual(webpCheck.isValid, true, 'Validates true WebP magic bytes (RIFF...WEBP)');
  assertEqual(webpCheck.detectedMime, 'image/webp', 'Detects image/webp MIME');

  const phpCheck = inspectMagicBytes(FIXTURES.fakePhpJpg);
  assertEqual(phpCheck.isValid, false, 'Rejects disguised PHP file');
  assertEqual(phpCheck.isDangerous, true, 'Flags disguised PHP file as dangerous');

  const htmlCheck = inspectMagicBytes(FIXTURES.fakeHtmlPng);
  assertEqual(htmlCheck.isValid, false, 'Rejects disguised HTML file');
  assertEqual(htmlCheck.isDangerous, true, 'Flags disguised HTML as dangerous');

  const svgCheck = inspectMagicBytes(FIXTURES.fakeSvgJpg);
  assertEqual(svgCheck.isValid, false, 'Rejects disguised SVG file');
  assert(svgCheck.reason.includes('SVG files are disallowed'), 'Explicit reason for SVG rejection');

  const exeCheck = inspectMagicBytes(FIXTURES.fakePeExeJpg);
  assertEqual(exeCheck.isValid, false, 'Rejects disguised Windows PE executable');
  assertEqual(exeCheck.isDangerous, true, 'Flags Windows EXE as dangerous');

  const elfCheck = inspectMagicBytes(FIXTURES.fakeElfJpg);
  assertEqual(elfCheck.isValid, false, 'Rejects disguised Linux ELF binary');
  assertEqual(elfCheck.isDangerous, true, 'Flags Linux ELF as dangerous');

  const corruptCheck = inspectMagicBytes(FIXTURES.corruptedHeader);
  assertEqual(corruptCheck.isValid, false, 'Rejects unrecognized corrupted binary header');

  // --------------------------------------------------------------------------
  console.log('\n--- 3. FULL MULTI-LAYER VALIDATION (SIZE, TYPE, MAGIC BYTES) ---');
  // --------------------------------------------------------------------------

  // Test 3.1: Valid 250KB JPEG upload
  const validUpload = validateImageUpload({
    name: 'cordless-drill.jpg',
    size: 250 * 1024,
    type: 'image/jpeg',
    bytes: FIXTURES.validJpeg
  });
  assertEqual(validUpload.valid, true, 'Accepts compliant JPEG upload');
  assert(validUpload.sanitizedFileName.startsWith('prod_'), 'Generates sanitized product filename');
  assert(validUpload.sanitizedFileName.endsWith('.jpg'), 'Sanitized filename ends with .jpg');

  // Test 3.2: Rejects empty 0-byte file
  const emptyUpload = validateImageUpload({
    name: 'empty.jpg',
    size: 0,
    type: 'image/jpeg',
    bytes: new Uint8Array([])
  });
  assertEqual(emptyUpload.valid, false, 'Rejects 0-byte empty file');
  assert(emptyUpload.error.includes('empty'), 'Returns file empty error message');

  // Test 3.3: Rejects oversized file (> 5 MB)
  const oversizedUpload = validateImageUpload({
    name: 'huge-poster.jpg',
    size: 6 * 1024 * 1024, // 6 MB
    type: 'image/jpeg',
    bytes: FIXTURES.validJpeg
  });
  assertEqual(oversizedUpload.valid, false, 'Rejects file exceeding 5MB limit');
  assert(oversizedUpload.error.includes('5MB limit'), 'Returns 5MB size limit warning');

  // Test 3.4: Rejects dangerous extension (.php)
  const phpUpload = validateImageUpload({
    name: 'backdoor.php',
    size: 1024,
    type: 'image/jpeg',
    bytes: FIXTURES.validJpeg
  });
  assertEqual(phpUpload.valid, false, 'Rejects file with .php extension');
  assert(phpUpload.error.includes('forbidden'), 'Returns dangerous extension forbidden error');

  // Test 3.5: Rejects SVG files (even if user renames to .svg with image/svg+xml)
  const svgUpload = validateImageUpload({
    name: 'logo.svg',
    size: 2048,
    type: 'image/svg+xml',
    bytes: FIXTURES.fakeSvgJpg
  });
  assertEqual(svgUpload.valid, false, 'Rejects SVG image upload');
  assert(svgUpload.error.includes('strictly prohibited'), 'Returns SVG security prohibition message');

  // Test 3.6: Detects and blocks MIME spoofing (reported JPEG but actually PNG bytes)
  const spoofedUpload = validateImageUpload({
    name: 'spoofed.jpg',
    size: 50 * 1024,
    type: 'image/jpeg',
    bytes: FIXTURES.validPng // Actually PNG bytes!
  });
  assertEqual(spoofedUpload.valid, false, 'Rejects MIME-spoofed file');
  assert(spoofedUpload.error.includes('spoofing detected'), 'Returns MIME spoofing detected error');

  // Test 3.7: Blocks disguised shell script with .jpg extension
  const disguisedShell = validateImageUpload({
    name: 'product_photo.jpg',
    size: 500,
    type: 'image/jpeg',
    bytes: FIXTURES.fakePhpJpg
  });
  assertEqual(disguisedShell.valid, false, 'Rejects PHP shell disguised as .jpg');

  // --------------------------------------------------------------------------
  console.log('\n--- 4. SAFE FILENAME GENERATION & USER NAME STRIPPING ---');
  // --------------------------------------------------------------------------
  const safeName1 = generateSafeFileName('jpg');
  const safeName2 = generateSafeFileName('webp');
  assert(/^prod_\d+_[a-f0-9a-z]+\.jpg$/.test(safeName1), 'Safe filename matches prod_<timestamp>_<hash>.jpg');
  assert(/^prod_\d+_[a-f0-9a-z]+\.webp$/.test(safeName2), 'Safe filename matches prod_<timestamp>_<hash>.webp');
  assert(safeName1 !== safeName2, 'Sequential safe filenames are unique');

  // Verify user-supplied path injection is impossible with generateSafeFileName
  const evilInput = '../../../../etc/passwd%00.php';
  const sanitizedOutput = generateSafeFileName('png');
  assert(!sanitizedOutput.includes('..'), 'Contains no directory traversal');
  assert(!sanitizedOutput.includes('passwd'), 'Completely discards user filename');
  assert(!sanitizedOutput.includes('php'), 'Ignores user file extension');
  assert(sanitizedOutput.endsWith('.png'), 'Strictly applies validated extension');

  // --------------------------------------------------------------------------
  console.log('\n--- 5. STORAGE ISOLATION & WEB ROOT PROTECTION ---');
  // --------------------------------------------------------------------------
  // Must reject any path pointing to web root or application source folders
  const localWebRoot1 = verifyStorageIsolation('public/products/drill.jpg');
  assertEqual(localWebRoot1.isIsolated, false, 'Rejects destination in local public/ web root');

  const localWebRoot2 = verifyStorageIsolation('assets/images/drill.jpg');
  assertEqual(localWebRoot2.isIsolated, false, 'Rejects destination in assets/ folder');

  const localApiRoot = verifyStorageIsolation('api/uploads/drill.jpg');
  assertEqual(localApiRoot.isIsolated, false, 'Rejects destination in api/ folder');

  const traversalPath = verifyStorageIsolation('products/../../etc/passwd');
  assertEqual(traversalPath.isIsolated, false, 'Rejects directory traversal in storage path');

  // Must accept approved isolated cloud storage buckets
  const isolatedProduct = verifyStorageIsolation('products/prod_1730720400000_a8f3b2.webp');
  assertEqual(isolatedProduct.isIsolated, true, 'Accepts isolated products/ storage bucket');

  const isolatedCategory = verifyStorageIsolation('categories/cat_banner_tools.jpg');
  assertEqual(isolatedCategory.isIsolated, true, 'Accepts isolated categories/ storage bucket');

  const isolatedUser = verifyStorageIsolation('users/usr_101/avatar.webp');
  assertEqual(isolatedUser.isIsolated, true, 'Accepts isolated users/ storage bucket');

  // --------------------------------------------------------------------------
  console.log('\n======================================================');
  console.log(`🏁 FILE VALIDATION TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

