/**
 * DEVSHREE — FIREBASE CONFIGURATION & INITIALIZATION
 * Connects to Firebase Authentication, Cloud Firestore, and Storage.
 *
 * HOW TO CONFIGURE YOUR FIREBASE CREDENTIALS:
 * 1. Go to https://console.firebase.google.com/
 * 2. Create a project named "Devshree" (or select an existing one)
 * 3. Add a Web App (</> icon) and copy the `firebaseConfig` object
 * 4. Replace the placeholder values below with your credentials.
 */

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  orderBy,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import { 
  getStorage, 
  ref, 
  uploadBytesResumable, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-storage.js";

// ===============================================
// FIREBASE CONFIGURATION (ENVIRONMENT-DRIVEN)
// Loads from serverless /api/config, window.__DEVSHREE_FIREBASE_CONFIG,
// process.env, or secure local storage.
// ===============================================

// Clean up any stale placeholder config from localStorage
try {
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem('devshree_firebase_runtime_config');
    if (raw && (raw.includes('YOUR_') || raw.includes('your-project-id') || !raw.includes('AIzaSy'))) {
      localStorage.removeItem('devshree_firebase_runtime_config');
    }
  }
} catch (_) {}

const runtimeConfig = (typeof window !== 'undefined' && window.__DEVSHREE_FIREBASE_CONFIG) || {};
const envConfig = (typeof process !== 'undefined' && process.env) || {};

let storedConfig = {};
try {
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem('devshree_firebase_runtime_config');
    if (raw) storedConfig = JSON.parse(raw);
  }
} catch (_) {}

function cleanConfigVal(val, fallback) {
  if (typeof val === 'string' && val.trim() && !val.startsWith('YOUR_') && val !== 'your-project-id') {
    return val.trim();
  }
  return fallback;
}

export const firebaseConfig = {
  apiKey: cleanConfigVal(runtimeConfig.apiKey || envConfig.FIREBASE_API_KEY || storedConfig.apiKey, "AIzaSyAsMbGnNSh5yCiJnS9XDd16o34C6oqdhpc"),
  authDomain: cleanConfigVal(runtimeConfig.authDomain || envConfig.FIREBASE_AUTH_DOMAIN || storedConfig.authDomain, "devshree-2dfae.firebaseapp.com"),
  projectId: cleanConfigVal(runtimeConfig.projectId || envConfig.FIREBASE_PROJECT_ID || storedConfig.projectId, "devshree-2dfae"),
  storageBucket: cleanConfigVal(runtimeConfig.storageBucket || envConfig.FIREBASE_STORAGE_BUCKET || storedConfig.storageBucket, "devshree-2dfae.firebasestorage.app"),
  messagingSenderId: cleanConfigVal(runtimeConfig.messagingSenderId || envConfig.FIREBASE_MESSAGING_SENDER_ID || storedConfig.messagingSenderId, "140419631249"),
  appId: cleanConfigVal(runtimeConfig.appId || envConfig.FIREBASE_APP_ID || storedConfig.appId, "1:140419631249:web:3e123bc405c5736a375730"),
  measurementId: cleanConfigVal(runtimeConfig.measurementId || envConfig.FIREBASE_MEASUREMENT_ID || storedConfig.measurementId, "G-83EBMNKBGJ")
};

// Check if user has real credentials
export const isConfigured = Boolean(
  firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.startsWith("YOUR_") &&
  firebaseConfig.apiKey !== "YOUR_API_KEY" &&
  firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY" &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== "your-project-id"
);

let app = null;
let auth = null;
let db = null;
let storage = null;

if (isConfigured) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    console.log("[Devshree] Firebase successfully connected to project:", firebaseConfig.projectId);
  } catch (err) {
    console.error("[Devshree] Firebase initialization error:", err);
  }
} else {
  console.info(
    "[Devshree] Notice: Firebase credentials are not yet configured in assets/js/firebase-config.js. " +
    "Running in offline local mode for demonstration until Firebase keys are pasted."
  );
}

export {
  app,
  auth,
  db,
  storage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  orderBy,
  serverTimestamp,
  onSnapshot
};
