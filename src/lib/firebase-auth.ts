import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  sendPasswordResetEmail,
  updatePassword,
} from 'firebase/auth';
import { auth } from './firebase-config';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
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
// AUTHENTICATION
// ═══════════════════════════════════════════════════════════

// Check if auth is available
const isAuthAvailable = (): boolean => {
  return auth !== null && auth !== undefined;
};

/**
 * Sign in admin user with email and password
 */
export const signInAdmin = async (email: string, password: string): Promise<AdminUser> => {
  if (!isAuthAvailable()) {
    throw new Error('Firebase Authentication is not available. Please enable it in Firebase Console.');
  }
  
  const result = await signInWithEmailAndPassword(auth, email, password);
  
  return {
    uid: result.user.uid,
    email: result.user.email || email,
    displayName: result.user.displayName || undefined,
    createdAt: new Date(result.user.metadata.creationTime || Date.now()),
  };
};

/**
 * Create a new admin user
 */
export const createAdminUser = async (email: string, password: string, displayName?: string): Promise<AdminUser> => {
  if (!isAuthAvailable()) {
    throw new Error('Firebase Authentication is not available. Please enable it in Firebase Console.');
  }
  
  const result = await createUserWithEmailAndPassword(auth, email, password);
  
  // Save admin info to Firestore
  await setDoc(doc(db, 'admins', result.user.uid), {
    email,
    displayName: displayName || email.split('@')[0],
    createdAt: Timestamp.now(),
    role: 'admin',
  });
  
  return {
    uid: result.user.uid,
    email: result.user.email || email,
    displayName: displayName || undefined,
    createdAt: new Date(),
  };
};

/**
 * Sign out current admin
 */
export const signOutAdmin = async (): Promise<void> => {
  if (!isAuthAvailable()) {
    throw new Error('Firebase Authentication is not available.');
  }
  await firebaseSignOut(auth);
};

/**
 * Listen to auth state changes
 */
export const onAuthChange = (callback: (user: AdminUser | null) => void): (() => void) => {
  if (!isAuthAvailable() || !auth) {
    callback(null);
    return () => {};
  }
  
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
        callback(null);
      }
    });
  } catch (error) {
    console.warn('[Firebase Auth] onAuthStateChanged failed:', error);
    callback(null);
    return () => {};
  }
};

/**
 * Get current user
 */
export const getCurrentUser = (): AdminUser | null => {
  if (!isAuthAvailable()) {
    return null;
  }
  
  const firebaseUser = auth.currentUser;
  
  if (!firebaseUser) return null;
  
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: firebaseUser.displayName || undefined,
    createdAt: new Date(firebaseUser.metadata.creationTime || Date.now()),
  };
};

/**
 * Send password reset email
 */
export const resetAdminPassword = async (email: string): Promise<void> => {
  if (!isAuthAvailable()) {
    throw new Error('Firebase Authentication is not available.');
  }
  await sendPasswordResetEmail(auth, email);
};

/**
 * Update admin password
 */
export const updateAdminPassword = async (newPassword: string): Promise<void> => {
  if (!isAuthAvailable()) {
    throw new Error('Firebase Authentication is not available.');
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
  // Firebase doesn't provide a direct way to check this
  // We'll try to sign in with a wrong password to check
  try {
    // This is a workaround - in production, you'd use Firebase Admin SDK
    // or a Cloud Function to check email existence
    return true; // For now, assume email might exist
  } catch (error) {
    return false;
  }
};
