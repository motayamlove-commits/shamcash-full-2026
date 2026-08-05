/**
 * Firebase Cloud Messaging (FCM) Configuration
 * Sham Cash - Push Notifications System
 */

// Import Firebase modules
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging, MessagePayload } from 'firebase/messaging';
import { getAuth } from 'firebase/auth';

// Firebase Configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// VAPID Key for Web Push
export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

// Initialize Firebase App (prevent multiple initializations)
let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;
let serviceWorkerRegistrationPromise: Promise<ServiceWorkerRegistration> | null = null;

const UNIFIED_SERVICE_WORKER_URL = '/sw.js';
const UNIFIED_SERVICE_WORKER_SCOPE = '/';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
}

async function getUnifiedServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (!serviceWorkerRegistrationPromise) {
    serviceWorkerRegistrationPromise = (async () => {
      const existingRegistration = await navigator.serviceWorker.getRegistration(UNIFIED_SERVICE_WORKER_SCOPE);
      const workerScriptUrls = [
        existingRegistration?.active?.scriptURL,
        existingRegistration?.waiting?.scriptURL,
        existingRegistration?.installing?.scriptURL,
      ].filter((scriptUrl): scriptUrl is string => Boolean(scriptUrl));

      const alreadyUsesUnifiedWorker = workerScriptUrls.some((scriptUrl) => {
        return new URL(scriptUrl).pathname === UNIFIED_SERVICE_WORKER_URL;
      });

      const registration = existingRegistration && alreadyUsesUnifiedWorker
        ? existingRegistration
        : await navigator.serviceWorker.register(UNIFIED_SERVICE_WORKER_URL, {
            scope: UNIFIED_SERVICE_WORKER_SCOPE,
          });

      await registration.update().catch((error) => {
        console.warn('[Firebase] Unified service worker update check failed:', error);
      });

      await navigator.serviceWorker.ready;
      return registration;
    })().catch((error) => {
      serviceWorkerRegistrationPromise = null;
      throw error;
    });
  }

  return serviceWorkerRegistrationPromise;
}

/**
 * Initialize Firebase and get Messaging instance
 */
export async function initializeFirebase(): Promise<Messaging | null> {
  try {
    console.log('[Firebase] initializeFirebase - starting...');

    // Check if browser supports FCM
    if (!isSupported()) {
      console.warn('[Firebase] initializeFirebase - browser does not support FCM');
      return null;
    }
    console.log('[Firebase] initializeFirebase - browser supports FCM');

    // Initialize Firebase only once
    if (!app) {
      console.log('[Firebase] initializeFirebase - creating new Firebase app');
      app = getApps().length === 0 
        ? initializeApp(firebaseConfig) 
        : getApps()[0];
      console.log('[Firebase] initializeFirebase - Firebase app created');
    } else {
      console.log('[Firebase] initializeFirebase - using existing Firebase app');
    }

    // Get Messaging instance
    if (!messaging) {
      console.log('[Firebase] initializeFirebase - getting messaging...');
      messaging = getMessaging(app);
      console.log('[Firebase] initializeFirebase - messaging ready');
    }

    return messaging;
  } catch (error: unknown) {
    console.error('[Firebase] initializeFirebase - error:', error);
    return null;
  }
}

/**
 * Check if browser supports FCM
 */
export function isSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

/**
 * Request notification permission and get FCM token
 */
export async function requestPermissionAndGetToken(): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> {
  try {
    console.log('[Firebase] Starting requestPermissionAndGetToken...');
    
    // Check support first
    if (!isSupported()) {
      console.log('[Firebase] Browser does not support notifications');
      return { success: false, error: 'المتصفح لا يدعم الإشعارات' };
    }
    
    console.log('[Firebase] Browser supports notifications');

    // Request permission
    const permission = await Notification.requestPermission();
    console.log('[Firebase] Permission result:', permission);
    
    if (permission !== 'granted') {
      return { success: false, error: 'تم رفض إذن الإشعارات' };
    }

    // Initialize Firebase
    console.log('[Firebase] Initializing Firebase...');
    const messagingInstance = await initializeFirebase();
    if (!messagingInstance) {
      console.log('[Firebase] Failed to initialize Firebase');
      return { success: false, error: 'فشل في تهيئة Firebase' };
    }
    console.log('[Firebase] Firebase initialized successfully');

    // Use the single PWA + FCM service worker registered at the root scope
    console.log('[Firebase] Getting unified service worker registration...');
    const registration = await getUnifiedServiceWorkerRegistration();
    console.log('[Firebase] Unified service worker ready:', registration.scope);
    
    // Get FCM token
    console.log('[Firebase] Getting FCM token with VAPID_KEY:', VAPID_KEY ? 'present' : 'missing');
    const token = await getToken(messagingInstance, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    console.log('[Firebase] Got token:', token ? 'yes' : 'no');

    if (!token) {
      return { success: false, error: 'فشل في الحصول على رمز الإشعارات' };
    }

    return { success: true, token };
  } catch (error: unknown) {
    console.error('[Firebase] Error getting FCM token:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Get current FCM token (if already exists)
 */
export async function getCurrentToken(): Promise<string | null> {
  try {
    console.log('[Firebase] getCurrentToken - checking support...');
    if (!isSupported()) {
      console.log('[Firebase] getCurrentToken - not supported');
      return null;
    }

    console.log('[Firebase] getCurrentToken - initializing Firebase...');
    const messagingInstance = await initializeFirebase();
    if (!messagingInstance) {
      console.log('[Firebase] getCurrentToken - initialization failed');
      return null;
    }
    console.log('[Firebase] getCurrentToken - Firebase initialized');

    console.log('[Firebase] getCurrentToken - getting unified service worker...');
    const registration = await getUnifiedServiceWorkerRegistration();
    console.log('[Firebase] getCurrentToken - unified service worker ready:', registration.scope);

    console.log('[Firebase] getCurrentToken - getting token with VAPID_KEY:', VAPID_KEY ? 'present' : 'MISSING');
    const token = await getToken(messagingInstance, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    console.log('[Firebase] getCurrentToken - got token:', token ? 'yes (length: ' + token.length + ')' : 'NO');

    return token || null;
  } catch (error: unknown) {
    console.error('[Firebase] getCurrentToken - error:', error);
    return null;
  }
}

/**
 * Subscribe to foreground messages
 */
export function onForegroundMessage(callback: (payload: MessagePayload) => void): () => void {
  let active = true;
  let unsubscribe: (() => void) | null = null;

  initializeFirebase().then((msg) => {
    if (msg && active) {
      unsubscribe = onMessage(msg, callback);
    }
  });

  return () => {
    active = false;
    unsubscribe?.();
  };
}

/**
 * Get device type based on user agent
 */
export function getDeviceType(): 'desktop' | 'android' | 'ios' {
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (/iphone|ipad|ipod/.test(userAgent)) {
    return 'ios';
  }
  
  if (/android/.test(userAgent)) {
    return 'android';
  }
  
  return 'desktop';
}

/**
 * Get device name
 */
export function getDeviceName(): string {
  const type = getDeviceType();
  
  switch (type) {
    case 'ios':
      return 'iPhone/iPad';
    case 'android':
      return 'Android Device';
    default:
      return 'Desktop Computer';
  }
}

export default {
  initializeFirebase,
  isSupported,
  requestPermissionAndGetToken,
  getCurrentToken,
  onForegroundMessage,
  getDeviceType,
  getDeviceName,
};
