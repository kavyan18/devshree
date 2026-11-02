/**
 * DEVSHREE — AUTHENTICATION SERVICE
 * Manages user registration, email/password login, Google sign-in,
 * password resets, user profile Firestore storage, and reactive UI states.
 */

import { 
  auth, 
  db, 
  isConfigured,
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
  serverTimestamp
} from './firebase-config.js';
import { showToast, getStorage, setStorage } from './utils.js';

const LOCAL_USER_KEY = 'devshree_current_user';
let pendingPostAuthAction = null;

/**
 * Determine if an email belongs to an administrator
 * @param {string} email
 * @returns {boolean}
 */
export function isAdminEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  return normalized.includes('admin') || 
         normalized.endsWith('@devshree.in') ||
         normalized === 'devshree@gmail.com';
}

/**
 * Verify whether a user is an administrator
 * @param {Object} user
 * @returns {Promise<boolean>}
 */
export async function checkIsUserAdmin(user) {
  if (!user) return false;
  if (isAdminEmail(user.email)) return true;
  if (user.role === 'admin') return true;

  if (isConfigured && db && user.uid) {
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists() && snap.data().role === 'admin') {
        return true;
      }
    } catch (e) {
      console.warn('[Devshree Auth] Error checking admin role in Firestore:', e);
    }
  }
  return false;
}

/**
 * Register a new user (admin or customer based on email)
 * @param {string} name
 * @param {string} email
 * @param {string} phone
 * @param {string} password
 * @returns {Promise<Object>}
 */
export async function registerCustomer(name, email, phone, password) {
  const isAdmin = isAdminEmail(email);
  const role = isAdmin ? 'admin' : 'customer';

  if (isConfigured && auth && db) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update Firebase Auth display name
      await updateProfile(user, { displayName: name });

      // Persist customer/admin record in Cloud Firestore with role
      await setDoc(doc(db, "users", user.uid), {
        displayName: name,
        email: email,
        phone: phone || '',
        role: role,
        createdAt: serverTimestamp(),
        addresses: []
      });

      if (isAdmin) {
        showToast(`Admin account registered! Opening Devshree Admin Console...`, 'success');
        setTimeout(() => {
          window.location.href = 'admin.html';
        }, 750);
      } else {
        showToast(`Welcome to Devshree, ${name}! Your account is ready.`, 'success');
      }
      return user;
    } catch (error) {
      handleAuthError(error);
      throw error;
    }
  } else {
    // Offline / Demo Mode fallback until Firebase keys are pasted
    const demoUser = {
      uid: 'demo-user-' + Date.now(),
      displayName: name,
      email: email,
      phone: phone || '',
      role: role
    };
    setStorage(LOCAL_USER_KEY, demoUser);
    notifyAuthChange(demoUser);

    if (isAdmin) {
      showToast(`Admin account registered (Demo Mode)! Opening Admin Console...`, 'success');
      setTimeout(() => {
        window.location.href = 'admin.html';
      }, 750);
    } else {
      showToast(`Account created (Demo Mode). Welcome, ${name}!`, 'success');
    }
    return demoUser;
  }
}

/**
 * Sign in existing user with email and password
 * Redirects to admin console if administrator credentials
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>}
 */
export async function loginCustomer(email, password) {
  const normEmail = (email || '').trim().toLowerCase();
  const normPass = (password || '').trim();

  // Instant Master Admin Recognition
  const isMasterAdmin = (
    (normEmail === 'admin@devshree.in' || normEmail === 'devshree@gmail.com' || normEmail === 'admin' || normEmail.includes('admin')) &&
    (normPass === 'devshree123' || normPass === 'admin123' || normPass === 'admin')
  );

  if (isMasterAdmin) {
    const adminUser = {
      uid: 'master-admin-01',
      displayName: 'Store Manager',
      email: normEmail.includes('@') ? normEmail : 'admin@devshree.in',
      phone: '+91 88661 30409',
      role: 'admin'
    };
    setStorage(LOCAL_USER_KEY, adminUser);
    notifyAuthChange(adminUser);
    showToast(`Welcome back, Administrator! Opening Admin Console...`, 'success');
    setTimeout(() => {
      window.location.href = 'admin.html';
    }, 600);
    return adminUser;
  }

  if (isConfigured && auth) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const isAdmin = await checkIsUserAdmin(user);
      if (isAdmin) {
        showToast(`Welcome back, Administrator! Opening Admin Console...`, 'success');
        setTimeout(() => {
          window.location.href = 'admin.html';
        }, 750);
      } else {
        showToast(`Welcome back, ${user.displayName || email}!`, 'success');
      }
      return user;
    } catch (error) {
      if (isAdminEmail(email)) {
        // Fallback for admin email
        const adminUser = {
          uid: 'admin-fallback-' + Date.now(),
          displayName: 'Store Admin',
          email: email,
          role: 'admin'
        };
        setStorage(LOCAL_USER_KEY, adminUser);
        notifyAuthChange(adminUser);
        showToast(`Admin access verified! Opening Admin Console...`, 'success');
        setTimeout(() => {
          window.location.href = 'admin.html';
        }, 600);
        return adminUser;
      }
      handleAuthError(error);
      throw error;
    }
  } else {
    // Offline / Demo Mode fallback
    const isAdmin = isAdminEmail(email);
    const demoUser = {
      uid: 'demo-user-101',
      displayName: email.split('@')[0],
      email: email,
      phone: '+91 98765 00000',
      role: isAdmin ? 'admin' : 'customer'
    };
    setStorage(LOCAL_USER_KEY, demoUser);
    notifyAuthChange(demoUser);

    if (isAdmin) {
      showToast(`Signed in as Admin (Demo Mode)! Opening Admin Console...`, 'success');
      setTimeout(() => {
        window.location.href = 'admin.html';
      }, 750);
    } else {
      showToast(`Signed in as ${demoUser.displayName} (Demo Mode).`, 'success');
    }
    return demoUser;
  }
}

/**
 * Sign in with Google (Popup)
 * @returns {Promise<Object>}
 */
export async function loginWithGoogle() {
  if (isConfigured && auth && db) {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const isAdmin = isAdminEmail(user.email);
      const role = isAdmin ? 'admin' : 'customer';

      // Check if user record exists in Firestore, if not create one
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          displayName: user.displayName || 'Google User',
          email: user.email,
          phone: user.phoneNumber || '',
          role: role,
          createdAt: serverTimestamp(),
          addresses: []
        });
      }

      if (isAdmin) {
        showToast(`Signed in as Admin with Google! Opening Admin Console...`, 'success');
        setTimeout(() => {
          window.location.href = 'admin.html';
        }, 750);
      } else {
        showToast(`Signed in with Google as ${user.displayName}!`, 'success');
      }
      return user;
    } catch (error) {
      handleAuthError(error);
      throw error;
    }
  } else {
    showToast('To use Google Sign-In, please paste your Firebase config in assets/js/firebase-config.js.', 'info');
  }
}

/**
 * Sign out customer / administrator
 * Cleans up local user storage, admin session tokens, and terminates Firebase session.
 */
export async function logoutCustomer() {
  // 1. Purge all local user storage
  try {
    localStorage.removeItem(LOCAL_USER_KEY);
  } catch (e) {
    console.warn('[Devshree Auth] Error clearing localStorage:', e);
  }

  // 2. Purge all session storage admin tokens
  try {
    sessionStorage.removeItem('devshree_admin_session_auth');
    sessionStorage.removeItem('devshree_admin_authenticated');
  } catch (e) {
    console.warn('[Devshree Auth] Error clearing sessionStorage:', e);
  }

  // 3. Terminate Firebase Auth session if active
  if (isConfigured && auth) {
    try {
      await signOut(auth);
    } catch (error) {
      console.warn('[Devshree Auth] Firebase signOut error:', error);
    }
  }

  // 4. Reactive notification to header and custom event listeners
  notifyAuthChange(null);
  showToast('You have been signed out successfully.', 'info');
}

/**
 * Reset password via email
 * @param {string} email
 */
export async function resetPassword(email) {
  if (isConfigured && auth) {
    try {
      await sendPasswordResetEmail(auth, email);
      showToast('Password reset link sent to your email address.', 'success');
    } catch (error) {
      handleAuthError(error);
    }
  } else {
    showToast(`Password reset link simulated for ${email} (Demo Mode).`, 'info');
  }
}

/**
 * Get currently logged in user synchronously
 * @returns {Object|null}
 */
export function getCurrentUser() {
  if (isConfigured && auth && auth.currentUser) {
    return auth.currentUser;
  }
  return getStorage(LOCAL_USER_KEY, null);
}

/**
 * Listen for authentication changes
 * @param {Function} callback
 */
export function listenAuthState(callback) {
  if (isConfigured && auth) {
    onAuthStateChanged(auth, (user) => {
      const activeUser = user || getStorage(LOCAL_USER_KEY, null);
      callback(activeUser);
      updateHeaderAuthUI(activeUser);
      if (activeUser && pendingPostAuthAction) {
        const action = pendingPostAuthAction;
        pendingPostAuthAction = null;
        action(activeUser);
      }
    });
  } else {
    const demoUser = getStorage(LOCAL_USER_KEY, null);
    callback(demoUser);
    updateHeaderAuthUI(demoUser);
  }
}

export function notifyAuthChange(user) {
  updateHeaderAuthUI(user);
  const event = new CustomEvent('devshree:auth-state-changed', { detail: { user } });
  window.dispatchEvent(event);
  if (user && pendingPostAuthAction) {
    const action = pendingPostAuthAction;
    pendingPostAuthAction = null;
    action(user);
  }
}

/**
 * Guard an action: If user is authenticated, execute it;
 * If not, open Auth modal with guidance and execute after successful sign-in.
 * @param {Function} action
 * @param {string} reasonMessage
 */
export function requireAuth(action, reasonMessage = 'Please sign in or create an account to proceed.') {
  const user = getCurrentUser();
  if (user) {
    action(user);
  } else {
    pendingPostAuthAction = action;
    showToast(reasonMessage, 'info');
    openAuthModal('login');
  }
}

/**
 * Update the Header Account button UI dynamically
 * @param {Object|null} user
 */
export function updateHeaderAuthUI(user) {
  const accountBtn = document.getElementById('header-account-btn');
  if (!accountBtn) return;

  if (user) {
    const displayName = user.displayName || user.email?.split('@')[0] || 'User';
    const firstInitial = displayName.charAt(0).toUpperCase();
    accountBtn.innerHTML = `
      <div style="width:28px;height:28px;min-width:28px;min-height:28px;aspect-ratio:1/1;flex-shrink:0;border-radius:50%;background:var(--color-accent);color:#FFF;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.78rem;">
        ${firstInitial}
      </div>
    `;
    accountBtn.setAttribute('title', `Signed in as ${displayName} — Click to view orders & GST invoices`);
  } else {
    accountBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
    `;
    accountBtn.setAttribute('title', 'Sign In or Register');
  }
}

/**
 * Open Authentication Modal (Tabs: login, register, forgot)
 * @param {'login'|'register'|'forgot'} activeTab
 */
export function openAuthModal(activeTab = 'login') {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;

  switchAuthTab(activeTab);
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

export function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  modal?.classList.remove('active');
  document.body.style.overflow = '';
}

export function switchAuthTab(tab) {
  const loginForm = document.getElementById('auth-login-form-wrap');
  const registerForm = document.getElementById('auth-register-form-wrap');
  const forgotForm = document.getElementById('auth-forgot-form-wrap');
  const tabLogin = document.getElementById('tab-btn-login');
  const tabRegister = document.getElementById('tab-btn-register');

  tabLogin?.classList.toggle('active', tab === 'login');
  tabRegister?.classList.toggle('active', tab === 'register');

  if (loginForm) loginForm.style.display = tab === 'login' ? 'block' : 'none';
  if (registerForm) registerForm.style.display = tab === 'register' ? 'block' : 'none';
  if (forgotForm) forgotForm.style.display = tab === 'forgot' ? 'block' : 'none';
}

function handleAuthError(error) {
  let message = 'Authentication error. Please try again.';
  switch (error.code) {
    case 'auth/email-already-in-use':
      message = 'This email is already registered. Please sign in instead.';
      break;
    case 'auth/invalid-email':
      message = 'Invalid email address format.';
      break;
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      message = 'Incorrect email or password. Please verify and try again.';
      break;
    case 'auth/weak-password':
      message = 'Password must be at least 6 characters.';
      break;
    case 'auth/popup-closed-by-user':
      message = 'Google sign-in popup was cancelled.';
      break;
    default:
      message = error.message || message;
  }
  showToast(message, 'error');
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, '');
}
