import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getDatabase, Database } from 'firebase/database';
import { getMessaging, isSupported, Messaging } from 'firebase/messaging';

// Firebase Auth is NOT imported to avoid SDK internal errors
// Admin authentication uses custom auth via Firestore

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
};

// Initialize Firebase (without Auth)
let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let rtdb: Database | null = null;
let messaging: Messaging | null = null;
let firebaseInitialized = false;

// Auth is always false - we use custom auth instead
const authAvailable = false;

// Check if all required config values are present
const hasRequiredConfig = (): boolean => {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
  );
};

if (hasRequiredConfig()) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    
    // Only initialize RTDB if URL is provided
    if (firebaseConfig.databaseURL) {
      try {
        rtdb = getDatabase(app);
      } catch (rtdbError) {
        console.warn('[Firebase] ⚠️ RTDB initialization failed:', rtdbError);
        rtdb = null;
      }
    }
    
    firebaseInitialized = true;
    console.log('[Firebase] ✅ Firebase initialized successfully');
  } catch (error) {
    console.error('[Firebase] ❌ Error initializing Firebase:', error);
  }
} else {
  console.error('[Firebase] ❌ Missing required Firebase configuration');
}

// Get Messaging instance (async due to service worker support check)
// Note: Firebase Messaging requires Auth which is disabled
export const getMessagingInstance = async (): Promise<Messaging | null> => {
  // Firebase Messaging requires Firebase Auth which is not available
  // Return null to prevent errors
  return null;
};

// Helper to check if Firebase is initialized
export const isFirebaseInitialized = (): boolean => firebaseInitialized;

// Auth is always false - we use custom auth instead
export const isAuthAvailable = (): boolean => authAvailable;

// Stub auth object to prevent import errors
export const auth = null;

export { app, db, rtdb };
export default app;
