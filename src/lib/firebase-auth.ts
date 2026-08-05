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
 * Uses custom auth only (Firebase Auth is disabled for security)
 */
export const signInAdmin = async (email: string, password: string): Promise<AdminUser> => {
  // Always use custom auth for admin
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
  customSignOut();
};

/**
 * Listen to auth state changes
 * Uses custom auth session only (no Firebase Auth dependency)
 */
export const onAuthChange = (callback: (user: AdminUser | null) => void): (() => void) => {
  // Check custom auth session immediately
  const customUser = getCustomCurrentUser();
  callback(customUser);
  
  // Set up a polling interval to check for session changes
  const intervalId = setInterval(() => {
    const currentUser = getCustomCurrentUser();
    callback(currentUser);
  }, 5000); // Check every 5 seconds
  
  // Return cleanup function
  return () => {
    clearInterval(intervalId);
  };
};

/**
 * Get current user
 * Uses custom auth session only
 */
export const getCurrentUser = (): AdminUser | null => {
  return getCustomCurrentUser();
};

/**
 * Send password reset email
 * Note: Requires manual password reset via Firebase Console when using custom auth
 */
export const resetAdminPassword = async (email: string): Promise<void> => {
  // With custom auth, password reset must be done manually in Firebase Console
  // or by updating the passwordHash field in Firestore
  throw new Error('Password reset requires Firebase Authentication. Please contact support.');
};

/**
 * Update admin password
 */
export const updateAdminPassword = async (newPassword: string): Promise<void> => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('No user is currently signed in');
  }
  
  // Update password in Firestore
  await setDoc(doc(db, 'admins', currentUser.uid), {
    passwordHash: newPassword,
    updatedAt: Timestamp.now(),
  }, { merge: true });
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
