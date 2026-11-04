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

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
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
// NEVER hardcode raw API keys into source files pushed to Git!
// ===============================================

const runtimeConfig = (typeof window !== 'undefined' && window.__DEVSHREE_FIREBASE_CONFIG) || {};
const envConfig = (typeof process !== 'undefined' && process.env) || {};

let storedConfig = {};
try {
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem('devshree_firebase_runtime_config');
    if (raw) storedConfig = JSON.parse(raw);
  }
} catch (_) {}

export const firebaseConfig = {
  apiKey: runtimeConfig.apiKey || envConfig.FIREBASE_API_KEY || storedConfig.apiKey || "YOUR_FIREBASE_API_KEY",
  authDomain: runtimeConfig.authDomain || envConfig.FIREBASE_AUTH_DOMAIN || storedConfig.authDomain || "devshree-2dfae.firebaseapp.com",
  projectId: runtimeConfig.projectId || envConfig.FIREBASE_PROJECT_ID || storedConfig.projectId || "devshree-2dfae",
  storageBucket: runtimeConfig.storageBucket || envConfig.FIREBASE_STORAGE_BUCKET || storedConfig.storageBucket || "devshree-2dfae.firebasestorage.app",
  messagingSenderId: runtimeConfig.messagingSenderId || envConfig.FIREBASE_MESSAGING_SENDER_ID || storedConfig.messagingSenderId || "140419631249",
  appId: runtimeConfig.appId || envConfig.FIREBASE_APP_ID || storedConfig.appId || "YOUR_FIREBASE_APP_ID",
  measurementId: runtimeConfig.measurementId || envConfig.FIREBASE_MEASUREMENT_ID || storedConfig.measurementId || ""
};

// Check if user has pasted real credentials or is still using placeholders
export const isConfigured =
  firebaseConfig.apiKey !== "YOUR_API_KEY" &&
  firebaseConfig.projectId !== "your-project-id";

let app = null;
let auth = null;
let db = null;
let storage = null;

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
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
