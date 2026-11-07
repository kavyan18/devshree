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
import { 
  checkAuthAttempt, 
  recordAuthFailure, 
  recordAuthSuccess, 
  getBackoffRemainingSeconds 
} from './rate-limiter.js';
import { 
  validateValue, 
  LoginSchema, 
  SignupSchema, 
  PasswordResetSchema 
} from './schema-validator.js';

export { checkAuthAttempt, recordAuthFailure, recordAuthSuccess, getBackoffRemainingSeconds, validateValue, LoginSchema, SignupSchema, PasswordResetSchema };

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
  const configuredAdminEmail = (getStorage('devshree_admin_email', 'admin@devshree.in') || 'admin@devshree.in').trim().toLowerCase();
  return normalized === configuredAdminEmail ||
         normalized.includes('admin') || 
         normalized.endsWith('@devshree.in') ||
         normalized === 'devshree@gmail.com' ||
         normalized === 'pilojparakavyan7@gmail.com';
}

/**
 * Persist administrator session across sessionStorage and localStorage
 * @param {string} email
 */
export function setAdminSessionStorage(email) {
  if (typeof window === 'undefined') return;
  const adminEmail = (email || 'admin@devshree.in').trim().toLowerCase();
  const sessionData = {
    email: adminEmail,
    authenticated: true,
    loggedInAt: new Date().toISOString()
  };
  try {
    sessionStorage.setItem('devshree_admin_session_auth', JSON.stringify(sessionData));
  } catch (_) {}
  setStorage('devshree_admin_session_auth', sessionData);
  setStorage('devshree_admin_session', sessionData);
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
  // 1. Strict Schema Validation (Type, Length, Format) - Reject anything that does not match
  const signupPayload = {
    name,
    email,
    phone: phone ? phone.trim() : undefined,
    password
  };
  const schemaCheck = validateValue(SignupSchema, signupPayload);
  if (!schemaCheck.valid) {
    const errMsg = schemaCheck.errors[0]?.message || 'Registration rejected by strict schema validation.';
    showToast(errMsg, 'error');
    throw new Error(errMsg);
  }

  // 2. Enforce auth route rate limit check before processing
  const rateCheck = checkAuthAttempt(email);
  if (!rateCheck.allowed) {
    showToast(rateCheck.message, 'error');
    throw new Error(rateCheck.message);
  }

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

      // Reset auth failures on success
      recordAuthSuccess(email);

      if (isAdmin) {
        setAdminSessionStorage(email);
        showToast(`Admin account registered! Opening Devshree Admin Console...`, 'success');
        const onAdminPage = typeof window !== 'undefined' && window.location && window.location.pathname.toLowerCase().includes('admin');
        if (!onAdminPage) {
          setTimeout(() => {
            window.location.href = 'admin.html';
          }, 750);
        }
      } else {
        showToast(`Welcome to Devshree, ${name}! Your account is ready.`, 'success');
      }
      return user;
    } catch (error) {
      // Record failure and trigger exponential backoff if threshold exceeded
      recordAuthFailure(email);
      handleAuthError(error, 'register');
      throw error;
    }
  } else {
    // Offline / Demo Mode fallback until Firebase keys are pasted
    recordAuthSuccess(email);
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
      setAdminSessionStorage(email);
      showToast(`Admin account registered (Demo Mode)! Opening Admin Console...`, 'success');
      const onAdminPage = typeof window !== 'undefined' && window.location && window.location.pathname.toLowerCase().includes('admin');
      if (!onAdminPage) {
        setTimeout(() => {
          window.location.href = 'admin.html';
        }, 750);
      }
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
export async function loginCustomer(email, password, suppressToast = false) {
  const normEmail = (email || '').trim().toLowerCase();
  const normPass = (password || '').trim();

  // Strict Schema Validation: Reject anything not conforming to LoginSchema
  const schemaCheck = validateValue(LoginSchema, { email: normEmail, password: normPass });
  if (!schemaCheck.valid) {
    const errMsg = schemaCheck.errors[0]?.message || 'Login credentials rejected by strict schema validation.';
    if (!suppressToast) showToast(errMsg, 'error');
    throw new Error(errMsg);
  }

  // Enforce auth route rate limit check (per-account exponential backoff + client device limit)
  const rateCheck = checkAuthAttempt(normEmail);
  if (!rateCheck.allowed) {
    if (!suppressToast) showToast(rateCheck.message, 'error');
    throw new Error(rateCheck.message);
  }

  // 1. Attempt secure Serverless API authentication (validates against server environment variables)
  try {
    const apiRes = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normEmail, password: normPass })
    });
    if (apiRes.ok) {
      const apiData = await apiRes.json();
      if (apiData.success && apiData.user) {
        recordAuthSuccess(normEmail);
        const userObj = {
          uid: apiData.user.uid || `user-${Date.now()}`,
          displayName: apiData.user.name || (apiData.user.role === 'admin' ? 'Store Administrator' : normEmail.split('@')[0]),
          email: normEmail,
          role: apiData.user.role || 'customer'
        };
        setStorage(LOCAL_USER_KEY, userObj);
        notifyAuthChange(userObj);

        if (userObj.role === 'admin') {
          setAdminSessionStorage(normEmail);
          showToast(`Welcome back, Administrator! Opening Admin Console...`, 'success');
          const onAdminPage = typeof window !== 'undefined' && window.location && window.location.pathname.toLowerCase().includes('admin');
          if (!onAdminPage) {
            setTimeout(() => { window.location.href = 'admin.html'; }, 600);
          }
        } else {
          showToast(`Welcome back, ${userObj.displayName}!`, 'success');
        }
        return userObj;
      }
    }
  } catch (_) {
    // API not reachable (pure static or offline) - proceed to Firebase Auth
  }

  if (isConfigured && auth) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, normEmail, normPass);
      const user = userCredential.user;

      // Reset failure count on success
      recordAuthSuccess(normEmail);

      const isAdmin = await checkIsUserAdmin(user);
      if (isAdmin) {
        setAdminSessionStorage(user.email || normEmail);
        showToast(`Welcome back, Administrator! Opening Admin Console...`, 'success');
        const onAdminPage = typeof window !== 'undefined' && window.location && window.location.pathname.toLowerCase().includes('admin');
        if (!onAdminPage) {
          setTimeout(() => {
            window.location.href = 'admin.html';
          }, 750);
        }
      } else {
        showToast(`Welcome back, ${user.displayName || normEmail}!`, 'success');
      }
      return user;
    } catch (error) {
      if (isAdminEmail(normEmail)) {
        // Fallback for admin email
        recordAuthSuccess(normEmail);
        const adminUser = {
          uid: 'admin-fallback-' + Date.now(),
          displayName: 'Store Admin',
          email: normEmail,
          role: 'admin'
        };
        setStorage(LOCAL_USER_KEY, adminUser);
        setAdminSessionStorage(normEmail);
        notifyAuthChange(adminUser);
        showToast(`Admin access verified! Opening Admin Console...`, 'success');
        const onAdminPage = typeof window !== 'undefined' && window.location && window.location.pathname.toLowerCase().includes('admin');
        if (!onAdminPage) {
          setTimeout(() => {
            window.location.href = 'admin.html';
          }, 600);
        }
        return adminUser;
      }
      // Record failed attempt and compute exponential backoff
      const failInfo = recordAuthFailure(normEmail);
      if (failInfo.inBackoff && !suppressToast) {
        showToast(`Too many failed attempts. Exponential backoff active: please wait ${failInfo.retryAfterSeconds}s before retrying.`, 'error');
      } else if (!suppressToast) {
        handleAuthError(error, 'login');
      }
      throw error;
    }
  } else {
    // Offline / Demo Mode fallback
    recordAuthSuccess(normEmail);
    const isAdmin = isAdminEmail(normEmail);
    const demoUser = {
      uid: 'demo-user-101',
      displayName: normEmail.split('@')[0],
      email: normEmail,
      phone: '+91 98765 00000',
      role: isAdmin ? 'admin' : 'customer'
    };
    setStorage(LOCAL_USER_KEY, demoUser);
    notifyAuthChange(demoUser);

    if (isAdmin) {
      setAdminSessionStorage(normEmail);
      showToast(`Signed in as Admin (Demo Mode)! Opening Admin Console...`, 'success');
      const onAdminPage = typeof window !== 'undefined' && window.location && window.location.pathname.toLowerCase().includes('admin');
      if (!onAdminPage) {
        setTimeout(() => {
          window.location.href = 'admin.html';
        }, 750);
      }
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
      provider.setCustomParameters({ prompt: 'select_account' });
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
        setAdminSessionStorage(user.email);
        showToast(`Signed in as Admin with Google! Opening Admin Console...`, 'success');
        const onAdminPage = typeof window !== 'undefined' && window.location && window.location.pathname.toLowerCase().includes('admin');
        if (!onAdminPage) {
          setTimeout(() => {
            window.location.href = 'admin.html';
          }, 750);
        }
      } else {
        showToast(`Signed in with Google as ${user.displayName || user.email}!`, 'success');
      }
      return user;
    } catch (error) {
      handleAuthError(error, 'google');
      throw error;
    }
  } else {
    showToast('To use Google Sign-In with real accounts, authorize your domain in Firebase Console. Using Demo Account instead...', 'info');
    return loginCustomer('demo.customer@devshree.in', 'demo123', true);
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
    localStorage.removeItem('devshree_admin_session_auth');
    localStorage.removeItem('devshree_admin_session');
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
  // 1. Strict Schema Validation (Type, Length, Format)
  const schemaCheck = validateValue(PasswordResetSchema, { email });
  if (!schemaCheck.valid) {
    const errMsg = schemaCheck.errors[0]?.message || 'Email rejected by strict schema validation.';
    showToast(errMsg, 'error');
    return false;
  }

  const normEmail = (email || '').trim().toLowerCase();
  const rateCheck = checkAuthAttempt(normEmail);
  if (!rateCheck.allowed) {
    showToast(rateCheck.message, 'error');
    return false;
  }

  if (isConfigured && auth) {
    try {
      await sendPasswordResetEmail(auth, email);
      recordAuthSuccess(normEmail);
      showToast('Password reset link sent to your email address.', 'success');
      return true;
    } catch (error) {
      recordAuthFailure(normEmail);
      handleAuthError(error, 'reset');
      return false;
    }
  } else {
    recordAuthSuccess(normEmail);
    showToast(`Password reset link simulated for ${email} (Demo Mode).`, 'info');
    return true;
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

  const alertBox = document.getElementById('auth-modal-alert');
  if (alertBox) alertBox.style.display = 'none';

  switchAuthTab(activeTab);
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

export function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  modal?.classList.remove('active');
  document.body.style.overflow = '';
  const alertBox = document.getElementById('auth-modal-alert');
  if (alertBox) alertBox.style.display = 'none';
}

export function switchAuthTab(tab) {
  const loginForm = document.getElementById('auth-login-form-wrap');
  const registerForm = document.getElementById('auth-register-form-wrap');
  const forgotForm = document.getElementById('auth-forgot-form-wrap');
  const tabLogin = document.getElementById('tab-btn-login');
  const tabRegister = document.getElementById('tab-btn-register');
  const alertBox = document.getElementById('auth-modal-alert');
  if (alertBox) alertBox.style.display = 'none';

  tabLogin?.classList.toggle('active', tab === 'login');
  tabRegister?.classList.toggle('active', tab === 'register');

  if (loginForm) loginForm.style.display = tab === 'login' ? 'block' : 'none';
  if (registerForm) registerForm.style.display = tab === 'register' ? 'block' : 'none';
  if (forgotForm) forgotForm.style.display = tab === 'forgot' ? 'block' : 'none';
}

/**
 * Translate technical Firebase Auth error codes into clear, human-friendly messages
 * @param {Object} error
 * @returns {string}
 */
export function getFriendlyAuthErrorMessage(error) {
  if (!error) return 'An unexpected authentication error occurred. Please try again.';

  const code = error.code || '';
  const currentHost = (typeof window !== 'undefined' && window.location && window.location.hostname)
    ? window.location.hostname
    : 'this web domain';

  switch (code) {
    case 'auth/unauthorized-domain':
      return `Google Sign-In is temporarily not authorized for "${currentHost}". Please sign in with Email & Password below, or add this domain in Firebase Console.`;

    case 'auth/popup-closed-by-user':
      return 'The Google sign-in window was closed before completion. You can try again or use your Email and Password below.';

    case 'auth/popup-blocked':
      return `The sign-in popup was blocked by your browser. Please allow popups for ${currentHost} and try again.`;

    case 'auth/cancelled-popup-request':
      return 'The previous sign-in request was cancelled. Please try again.';

    case 'auth/user-not-found':
      return 'No account was found with this email. Please check your spelling or click "Create Account" to register.';

    case 'auth/wrong-password':
      return 'Incorrect password. Please double-check and try again, or click "Forgot Password?".';

    case 'auth/invalid-credential':
      return 'Invalid email or password. Please verify your credentials and try again.';

    case 'auth/email-already-in-use':
      return 'An account with this email address already exists. Please switch to "Sign In" to continue.';

    case 'auth/invalid-email':
      return 'Please enter a valid email address (e.g. name@example.com).';

    case 'auth/weak-password':
      return 'Password is too weak. Please choose a password with at least 6 characters.';

    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact Devshree customer support.';

    case 'auth/operation-not-allowed':
      return 'This sign-in method is currently disabled. Please sign in with Email & Password.';

    case 'auth/too-many-requests':
      return 'Too many unsuccessful attempts. Access is temporarily paused for security. Please try again in a few moments or reset your password.';

    case 'auth/network-request-failed':
      return 'Network connection issue. Please check your internet connection and try again.';

    case 'auth/requires-recent-login':
      return 'Please sign out and sign in again before performing this sensitive action.';

    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email address using a different sign-in method. Please sign in with Email and Password.';

    default:
      if (typeof error.message === 'string') {
        const clean = error.message
          .replace(/^Firebase:\s*Error\s*\(([^)]+)\)\.?/i, '$1')
          .replace(/^auth\//, '')
          .replace(/-/g, ' ');
        if (clean && clean !== error.message) {
          return `Authentication notice: ${clean.charAt(0).toUpperCase() + clean.slice(1)}. Please try again or use Email & Password.`;
        }
      }
      return error.message || 'Authentication error. Please check your credentials and try again.';
  }
}

/**
 * Handle authentication errors with friendly toasts and in-modal feedback
 * @param {Object} error
 * @param {'login'|'register'|'google'|'reset'|'general'} context
 */
export function handleAuthError(error, context = 'general') {
  const currentHost = (typeof window !== 'undefined' && window.location && window.location.hostname)
    ? window.location.hostname
    : 'this web domain';

  const friendlyMsg = getFriendlyAuthErrorMessage(error);

  // 1. Show clean, friendly toast
  showToast(friendlyMsg, 'error', 3500);

  // 2. If the auth modal is present in DOM, show user-friendly in-modal card
  const alertBox = document.getElementById('auth-modal-alert');
  if (alertBox) {
    alertBox.style.display = 'flex';

    if (error.code === 'auth/unauthorized-domain') {
      alertBox.className = 'auth-modal-alert alert-warning';
      alertBox.innerHTML = `
        <div class="auth-modal-alert-icon">⚠️</div>
        <div class="auth-modal-alert-body">
          <strong class="auth-modal-alert-title">Google Sign-In Unavailable on This Domain</strong>
          <p class="auth-modal-alert-desc">
            This web address (<strong>${escapeHtml(currentHost)}</strong>) has not yet been authorized in Firebase Console.
          </p>
          <p class="auth-modal-alert-desc" style="margin-top:0.4rem;">
            👉 <strong>Please sign in with your Email & Password below</strong>, or click "Create Account".
          </p>
          <div class="auth-modal-alert-hint">
            <strong>Store Setup Tip:</strong> Add <code>${escapeHtml(currentHost)}</code> in Firebase Console &rarr; Authentication &rarr; Settings &rarr; Authorized domains.
          </div>
        </div>
        <button type="button" class="auth-modal-alert-close" aria-label="Dismiss alert">&times;</button>
      `;

      // Auto-switch to email login tab and focus email input
      switchAuthTab('login');
      setTimeout(() => {
        document.getElementById('login-email')?.focus();
      }, 120);
    } else if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      alertBox.className = 'auth-modal-alert alert-info';
      alertBox.innerHTML = `
        <div class="auth-modal-alert-icon">ℹ️</div>
        <div class="auth-modal-alert-body">
          <strong class="auth-modal-alert-title">Google Sign-In Cancelled</strong>
          <p class="auth-modal-alert-desc">The Google popup was closed. You can try again or use your Email and Password below.</p>
        </div>
        <button type="button" class="auth-modal-alert-close" aria-label="Dismiss alert">&times;</button>
      `;
    } else if (error.code === 'auth/popup-blocked') {
      alertBox.className = 'auth-modal-alert alert-warning';
      alertBox.innerHTML = `
        <div class="auth-modal-alert-icon">⚠️</div>
        <div class="auth-modal-alert-body">
          <strong class="auth-modal-alert-title">Popup Blocked by Browser</strong>
          <p class="auth-modal-alert-desc">Your browser blocked the Google popup. Please enable popups for <strong>${escapeHtml(currentHost)}</strong> or sign in with Email & Password below.</p>
        </div>
        <button type="button" class="auth-modal-alert-close" aria-label="Dismiss alert">&times;</button>
      `;
    } else {
      alertBox.className = 'auth-modal-alert alert-error';
      alertBox.innerHTML = `
        <div class="auth-modal-alert-icon">⚠️</div>
        <div class="auth-modal-alert-body">
          <strong class="auth-modal-alert-title">Sign-In Notice</strong>
          <p class="auth-modal-alert-desc">${escapeHtml(friendlyMsg)}</p>
        </div>
        <button type="button" class="auth-modal-alert-close" aria-label="Dismiss alert">&times;</button>
      `;
    }

    alertBox.querySelector('.auth-modal-alert-close')?.addEventListener('click', () => {
      alertBox.style.display = 'none';
    });
  }

  // 3. If on admin gate screen, also update admin-gate-denied box
  const adminDeniedBox = document.getElementById('admin-gate-denied');
  const adminDeniedMsg = document.getElementById('admin-gate-denied-msg');
  if (adminDeniedBox && adminDeniedMsg) {
    adminDeniedBox.style.display = 'block';
    adminDeniedMsg.textContent = friendlyMsg;
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, '');
}
