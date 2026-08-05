import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getDatabase, Database } from 'firebase/database';
import { getMessaging, isSupported, Messaging } from 'firebase/messaging';

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
let messaging: Messaging | null = null;
let firebaseInitialized = false;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  
  // Auth may be null if Authentication is not enabled in Firebase Console
  try {
    auth = getAuth(app);
  } catch (authError) {
    console.warn('[Firebase] ⚠️ Auth initialization failed - Authentication may not be enabled:', authError);
    auth = null;
  }
  
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

// Get Messaging instance (async due to service worker support check)
export const getMessagingInstance = async (): Promise<Messaging | null> => {
  if (messaging) return messaging;
  
  if (typeof window !== 'undefined' && app) {
    try {
      const supported = await isSupported();
      if (supported) {
        messaging = getMessaging(app);
        return messaging;
      }
    } catch (error) {
      console.warn('[Firebase] Messaging not supported:', error);
    }
  }
  return null;
};

// Helper to check if Firebase is initialized
export const isFirebaseInitialized = (): boolean => firebaseInitialized;

export { app, db, auth, rtdb };
export default app;
