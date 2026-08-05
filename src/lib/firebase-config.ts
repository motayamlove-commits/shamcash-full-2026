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
let app: FirebaseApp;
let db: Firestore;
let auth: Auth;
let rtdb: Database;
let messaging: Messaging | null = null;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  
  // Only initialize RTDB if URL is provided
  if (firebaseConfig.databaseURL) {
    rtdb = getDatabase(app);
  }
  
  console.log('[Firebase] ✅ Firebase initialized successfully');
} catch (error) {
  console.error('[Firebase] ❌ Error initializing Firebase:', error);
  throw error;
}

// Get Messaging instance (async due to service worker support check)
export const getMessagingInstance = async (): Promise<Messaging | null> => {
  if (messaging) return messaging;
  
  if (typeof window !== 'undefined') {
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

export { app, db, auth, rtdb };
export default app;
