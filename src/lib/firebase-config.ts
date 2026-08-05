import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getDatabase, Database } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
};

// Initialize Firebase
let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let rtdb: Database | null = null;
let firebaseInitialized = false;
let authAvailable = false;
let messagingAvailable = false;

// Flag to track if Firebase Auth has been attempted
let authInitializationAttempted = false;

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
    
    // Only initialize Auth if it hasn't been attempted yet
    if (!authInitializationAttempted) {
      authInitializationAttempted = true;
      try {
        auth = getAuth(app);
        authAvailable = true;
        console.log('[Firebase] ✅ Firebase Auth initialized');
      } catch (authError: any) {
        console.warn('[Firebase] ⚠️ Auth initialization failed:', authError?.message);
        auth = null;
        authAvailable = false;
      }
    }
    
    // Only initialize RTDB if URL is provided
    if (firebaseConfig.databaseURL) {
      try {
        rtdb = getDatabase(app);
      } catch (rtdbError: any) {
        console.warn('[Firebase] ⚠️ RTDB initialization failed:', rtdbError?.message);
        rtdb = null;
      }
    }
    
    firebaseInitialized = true;
    console.log('[Firebase] ✅ Firebase initialized successfully');
  } catch (error: any) {
    console.error('[Firebase] ❌ Error initializing Firebase:', error?.message);
  }
} else {
  console.error('[Firebase] ❌ Missing required Firebase configuration');
}

// Get Messaging instance - returns null to prevent errors
// Note: Firebase Messaging requires Firebase Auth to be enabled
export const getMessagingInstance = async (): Promise<null> => {
  // Firebase Messaging requires Firebase Auth which may not be enabled
  // Return null to prevent errors
  return null;
};

// Helper to check if Firebase is initialized
export const isFirebaseInitialized = (): boolean => firebaseInitialized;

// Check if auth is available
export const isAuthAvailable = (): boolean => authAvailable;

// Check if messaging is available
export const isMessagingAvailable = (): boolean => messagingAvailable;

export { app, db, auth, rtdb };
export default app;
