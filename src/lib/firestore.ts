import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  increment,
  arrayUnion,
  arrayRemove,
  setDoc,
  DocumentReference,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from './firebase-config';

// Helper to check if db is available
const isDbAvailable = (): boolean => {
  return db !== null && db !== undefined;
};

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export type UserProfile = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  nationalId: string;
  dateOfBirth: string;
  status: 'pending' | 'verified' | 'completed';
  extraFields?: Record<string, string>;
  clientId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type LoginAttempt = {
  id: string;
  userId: string;
  clientId: string;
  email: string;
  password?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
  updatedAt?: Timestamp;
};

export type VerificationCode = {
  id: string;
  userId: string;
  code: string;
  verified: boolean;
  createdAt: Timestamp;
  expiresAt: Timestamp;
};

// ═══════════════════════════════════════════════════════════
// COLLECTION REFERENCES
// ═══════════════════════════════════════════════════════════

const USERS_COLLECTION = 'users';
const LOGIN_ATTEMPTS_COLLECTION = 'loginAttempts';
const VERIFICATION_CODES_COLLECTION = 'verificationCodes';
const ADMIN_TOKENS_COLLECTION = 'adminTokens';
const SITE_CONFIG_COLLECTION = 'siteConfig';
const FORM_FIELDS_COLLECTION = 'formFields';

// ═══════════════════════════════════════════════════════════
// USERS (registrations)
// ═══════════════════════════════════════════════════════════

export const createUser = async (data: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const docRef = await addDoc(collection(db, USERS_COLLECTION), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
};

export const updateUser = async (userId: string, data: Partial<UserProfile>): Promise<void> => {
  const userRef = doc(db, USERS_COLLECTION, userId);
  await updateDoc(userRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
};

export const getUser = async (userId: string): Promise<UserProfile | null> => {
  const userRef = doc(db, USERS_COLLECTION, userId);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return null;
  
  return { id: userSnap.id, ...userSnap.data() } as UserProfile;
};

export const getUserByEmail = async (email: string): Promise<UserProfile | null> => {
  const q = query(collection(db, USERS_COLLECTION), where('email', '==', email.toLowerCase()));
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) return null;
  
  const doc = querySnapshot.docs[0];
  return { id: doc.id, ...doc.data() } as UserProfile;
};

export const getAllUsers = async (constraints?: QueryConstraint[]): Promise<UserProfile[]> => {
  let q = query(collection(db, USERS_COLLECTION), orderBy('createdAt', 'desc'));
  
  if (constraints) {
    q = query(collection(db, USERS_COLLECTION), ...constraints, orderBy('createdAt', 'desc'));
  }
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
};

export const deleteUser = async (userId: string): Promise<void> => {
  await deleteDoc(doc(db, USERS_COLLECTION, userId));
};

// Subscribe to users collection (realtime)
export const subscribeToUsers = (callback: (users: UserProfile[]) => void): (() => void) => {
  const q = query(collection(db, USERS_COLLECTION), orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (querySnapshot) => {
    const users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
    callback(users);
  });
};

// ═══════════════════════════════════════════════════════════
// LOGIN ATTEMPTS
// ═══════════════════════════════════════════════════════════

export const createLoginAttempt = async (data: Omit<LoginAttempt, 'id' | 'createdAt'>): Promise<string> => {
  if (!isDbAvailable()) {
    throw new Error('Firestore not available');
  }
  const docRef = await addDoc(collection(db, LOGIN_ATTEMPTS_COLLECTION), {
    ...data,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};

export const updateLoginAttempt = async (attemptId: string, data: Partial<LoginAttempt>): Promise<void> => {
  const attemptRef = doc(db, LOGIN_ATTEMPTS_COLLECTION, attemptId);
  await updateDoc(attemptRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
};

export const getLoginAttemptsByUser = async (userId: string): Promise<LoginAttempt[]> => {
  const q = query(
    collection(db, LOGIN_ATTEMPTS_COLLECTION),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LoginAttempt));
};

export const getAllLoginAttempts = async (): Promise<LoginAttempt[]> => {
  if (!isDbAvailable()) {
    return [];
  }
  const q = query(collection(db, LOGIN_ATTEMPTS_COLLECTION), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LoginAttempt));
};

// Subscribe to login attempts (realtime)
export const subscribeToLoginAttempts = (callback: (attempts: LoginAttempt[]) => void): (() => void) => {
  if (!isDbAvailable()) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, LOGIN_ATTEMPTS_COLLECTION), orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (querySnapshot) => {
    const attempts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LoginAttempt));
    callback(attempts);
  });
};

// ═══════════════════════════════════════════════════════════
// VERIFICATION CODES
// ═══════════════════════════════════════════════════════════

export const createVerificationCode = async (
  userId: string,
  code: string,
  expiresInMinutes: number = 5
): Promise<string> => {
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + expiresInMinutes * 60 * 1000));
  
  const docRef = await addDoc(collection(db, VERIFICATION_CODES_COLLECTION), {
    userId,
    code,
    verified: false,
    createdAt: Timestamp.now(),
    expiresAt,
  });
  return docRef.id;
};

export const verifyCode = async (userId: string, code: string): Promise<boolean> => {
  const q = query(
    collection(db, VERIFICATION_CODES_COLLECTION),
    where('userId', '==', userId),
    where('code', '==', code),
    where('verified', '==', false)
  );
  
  const querySnapshot = await getDocs(q);
  
  for (const docSnap of querySnapshot.docs) {
    const data = docSnap.data();
    
    // Check if code is expired
    if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
      continue; // Skip expired codes
    }
    
    // Mark as verified
    await updateDoc(doc(db, VERIFICATION_CODES_COLLECTION, docSnap.id), {
      verified: true,
    });
    
    return true;
  }
  
  return false;
};

export const getUnverifiedCodes = async (userId: string): Promise<VerificationCode[]> => {
  const q = query(
    collection(db, VERIFICATION_CODES_COLLECTION),
    where('userId', '==', userId),
    where('verified', '==', false)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VerificationCode));
};

// ═══════════════════════════════════════════════════════════
// ADMIN TOKENS (for FCM)
// ═══════════════════════════════════════════════════════════

export const saveAdminToken = async (adminId: string, token: string): Promise<void> => {
  const tokenRef = doc(db, ADMIN_TOKENS_COLLECTION, adminId);
  await setDoc(tokenRef, {
    fcmToken: token,
    updatedAt: Timestamp.now(),
  }, { merge: true });
};

export const getAdminTokens = async (): Promise<string[]> => {
  const querySnapshot = await getDocs(collection(db, ADMIN_TOKENS_COLLECTION));
  return querySnapshot.docs
    .map(doc => doc.data().fcmToken as string)
    .filter(Boolean);
};

export const deleteAdminToken = async (adminId: string): Promise<void> => {
  await deleteDoc(doc(db, ADMIN_TOKENS_COLLECTION, adminId));
};

// ═══════════════════════════════════════════════════════════
// SITE CONFIG
// ═══════════════════════════════════════════════════════════

export const getSiteConfig = async (key: string): Promise<any> => {
  const configRef = doc(db, SITE_CONFIG_COLLECTION, key);
  const configSnap = await getDoc(configRef);
  
  if (!configSnap.exists()) return null;
  return configSnap.data().value;
};

export const setSiteConfig = async (key: string, value: any): Promise<void> => {
  const configRef = doc(db, SITE_CONFIG_COLLECTION, key);
  await setDoc(configRef, {
    value,
    updatedAt: Timestamp.now(),
  }, { merge: true });
};

// Subscribe to site config
export const subscribeToSiteConfig = (key: string, callback: (value: any) => void): (() => void) => {
  const configRef = doc(db, SITE_CONFIG_COLLECTION, key);
  
  return onSnapshot(configRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data().value);
    }
  });
};

// ═══════════════════════════════════════════════════════════
// FORM FIELDS
// ═══════════════════════════════════════════════════════════

export type FormField = {
  id?: string;
  pageKey: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  placeholder?: string;
  required: boolean;
  isHidden: boolean;
  fieldOrder: number;
  createdAt?: Timestamp;
};

export const getFormFields = async (pageKey: string): Promise<FormField[]> => {
  const q = query(
    collection(db, FORM_FIELDS_COLLECTION),
    where('pageKey', '==', pageKey),
    orderBy('fieldOrder', 'asc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FormField));
};

export const saveFormField = async (field: Omit<FormField, 'id' | 'createdAt'>): Promise<string> => {
  const existingQ = query(
    collection(db, FORM_FIELDS_COLLECTION),
    where('pageKey', '==', field.pageKey),
    where('fieldKey', '==', field.fieldKey)
  );
  const existing = await getDocs(existingQ);
  
  if (!existing.empty) {
    // Update existing
    await updateDoc(doc(db, FORM_FIELDS_COLLECTION, existing.docs[0].id), field);
    return existing.docs[0].id;
  }
  
  // Create new
  const docRef = await addDoc(collection(db, FORM_FIELDS_COLLECTION), {
    ...field,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};

export const deleteFormField = async (fieldId: string): Promise<void> => {
  await deleteDoc(doc(db, FORM_FIELDS_COLLECTION, fieldId));
};

// Subscribe to form fields
export const subscribeToFormFields = (pageKey: string, callback: (fields: FormField[]) => void): (() => void) => {
  const q = query(
    collection(db, FORM_FIELDS_COLLECTION),
    where('pageKey', '==', pageKey),
    orderBy('fieldOrder', 'asc')
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const fields = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FormField));
    callback(fields);
  });
};

// ═══════════════════════════════════════════════════════════
// STATISTICS HELPERS
// ═══════════════════════════════════════════════════════════

export const getUserStatistics = async () => {
  const users = await getAllUsers();
  
  return {
    total: users.length,
    pending: users.filter(u => u.status === 'pending').length,
    verified: users.filter(u => u.status === 'verified').length,
    completed: users.filter(u => u.status === 'completed').length,
  };
};
