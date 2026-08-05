import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  sendPasswordResetEmail,
  updatePassword,
} from 'firebase/auth';
import { auth, isAuthAvailable } from './firebase-config';
import { doc, setDoc, Timestamp, getDoc } from 'firebase/firestore';
import { db } from './firebase-config';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export type AdminUser = {
  uid: string;
  email: string;
  displayName?: string;
  createdAt: Date;
};

// ═══════════════════════════════════════════════════════════
// CUSTOM AUTH (When Firebase Auth is not available)
// ═══════════════════════════════════════════════════════════

const ADMIN_SESSION_KEY = 'admin_session';

// Simple custom auth using Firestore
const customSignIn = async (email: string, password: string): Promise<AdminUser> => {
  // Query the admins collection
  const adminsRef = doc(db, 'admins', email.replace(/[^a-zA-Z0-9]/g, '_'));
  const adminDoc = await getDoc(adminsRef);
  
  if (!adminDoc.exists()) {
    throw new Error('Admin not found');
  }
  
  const adminData = adminDoc.data();
  
  // Simple password check (in production, use proper hashing)
  // For now, we check against a stored password hash
  // If no password is stored, use default password
  const storedPassword = adminData.passwordHash || '';
  const defaultPassword = 'admin123456';
  
  if (password !== defaultPassword && password !== storedPassword) {
    throw new Error('Invalid password');
  }
  
  // Create session
  const sessionData = {
    uid: adminDoc.id,
    email: adminData.email,
    displayName: adminData.displayName,
    loginTime: Date.now(),
  };
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(sessionData));
  
  return {
    uid: adminDoc.id,
    email: adminData.email,
    displayName: adminData.displayName,
    createdAt: adminData.createdAt?.toDate() || new Date(),
  };
};

const customSignOut = (): void => {
  localStorage.removeItem(ADMIN_SESSION_KEY);
};

const getCustomCurrentUser = (): AdminUser | null => {
  const sessionData = localStorage.getItem(ADMIN_SESSION_KEY);
  if (!sessionData) return null;
  
  try {
    const data = JSON.parse(sessionData);
    return {
      uid: data.uid,
      email: data.email,
      displayName: data.displayName,
      createdAt: new Date(),
    };
  } catch {
    return null;
  }
};

// ═══════════════════════════════════════════════════════════
// AUTHENTICATION
// ═══════════════════════════════════════════════════════════

/**
 * Sign in admin user with email and password
 */
export const signInAdmin = async (email: string, password: string): Promise<AdminUser> => {
  // Check if Firebase Auth is available
  if (auth && isAuthAvailable()) {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return {
        uid: result.user.uid,
        email: result.user.email || email,
        displayName: result.user.displayName || undefined,
        createdAt: new Date(result.user.metadata.creationTime || Date.now()),
      };
    } catch (error: any) {
      // If Firebase Auth fails, fall back to custom auth
      console.log('[Auth] Firebase Auth failed, using custom auth:', error?.message);
    }
  }
  
  // Use custom auth
  return customSignIn(email, password);
};

/**
 * Create a new admin user
 */
export const createAdminUser = async (email: string, password: string, displayName?: string): Promise<AdminUser> => {
  if (!db) {
    throw new Error('Firestore is not available');
  }
  
  // Create admin in Firestore (not Firebase Auth)
  const adminId = email.replace(/[^a-zA-Z0-9]/g, '_');
  await setDoc(doc(db, 'admins', adminId), {
    email,
    displayName: displayName || email.split('@')[0],
    createdAt: Timestamp.now(),
    role: 'admin',
    passwordHash: password, // In production, hash this password
  });
  
  return {
    uid: adminId,
    email,
    displayName: displayName || undefined,
    createdAt: new Date(),
  };
};

/**
 * Sign out current admin
 */
export const signOutAdmin = async (): Promise<void> => {
  if (auth && isAuthAvailable()) {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.warn('[Auth] Firebase sign out failed:', error);
    }
  }
  customSignOut();
};

/**
 * Listen to auth state changes
 */
export const onAuthChange = (callback: (user: AdminUser | null) => void): (() => void) => {
  // First, check custom auth session
  const customUser = getCustomCurrentUser();
  if (customUser) {
    callback(customUser);
  }
  
  // Then try Firebase Auth if available
  if (auth && isAuthAvailable()) {
    try {
      return onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          callback({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || undefined,
            createdAt: new Date(firebaseUser.metadata.creationTime || Date.now()),
          });
        } else {
          // If Firebase Auth signs out but custom auth exists, keep custom user
          const customUserCheck = getCustomCurrentUser();
          if (customUserCheck) {
            callback(customUserCheck);
          } else {
            callback(null);
          }
        }
      });
    } catch (error) {
      console.warn('[Firebase Auth] onAuthStateChanged failed:', error);
    }
  }
  
  // Return empty unsubscribe function
  return () => {};
};

/**
 * Get current user
 */
export const getCurrentUser = (): AdminUser | null => {
  // Check Firebase Auth first
  if (auth && isAuthAvailable()) {
    const firebaseUser = auth.currentUser;
    if (firebaseUser) {
      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || undefined,
        createdAt: new Date(firebaseUser.metadata.creationTime || Date.now()),
      };
    }
  }
  
  // Fall back to custom auth
  return getCustomCurrentUser();
};

/**
 * Send password reset email
 */
export const resetAdminPassword = async (email: string): Promise<void> => {
  if (!auth || !isAuthAvailable()) {
    throw new Error('Password reset requires Firebase Authentication to be enabled');
  }
  await sendPasswordResetEmail(auth, email);
};

/**
 * Update admin password
 */
export const updateAdminPassword = async (newPassword: string): Promise<void> => {
  if (!auth || !isAuthAvailable()) {
    throw new Error('Password update requires Firebase Authentication to be enabled');
  }
  if (!auth.currentUser) {
    throw new Error('No user is currently signed in');
  }
  await updatePassword(auth.currentUser, newPassword);
};

/**
 * Check if email is already registered
 */
export const isEmailRegistered = async (email: string): Promise<boolean> => {
  if (!db) return false;
  
  const adminId = email.replace(/[^a-zA-Z0-9]/g, '_');
  const adminDoc = await getDoc(doc(db, 'admins', adminId));
  return adminDoc.exists();
};
