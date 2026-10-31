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

// PASTE YOUR FIREBASE CONFIG HERE:
export const firebaseConfig = {
  apiKey: "AIzaSyAsMbGnNSh5yCiJnS9XDd16o34C6oqdhpc",
  authDomain: "devshree-2dfae.firebaseapp.com",
  projectId: "devshree-2dfae",
  storageBucket: "devshree-2dfae.firebasestorage.app",
  messagingSenderId: "140419631249",
  appId: "1:140419631249:web:3e123bc405c5736a375730",
  measurementId: "G-83EBMNKBGJ"
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
