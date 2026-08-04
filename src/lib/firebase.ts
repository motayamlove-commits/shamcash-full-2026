/**
 * Firebase Cloud Messaging (FCM) Configuration
 * Sham Cash - Push Notifications System
 */

// Import Firebase modules
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging, IsSupportedBrowser } from 'firebase/messaging';

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

/**
 * Initialize Firebase and get Messaging instance
 */
export async function initializeFirebase(): Promise<Messaging | null> {
  try {
    // Check if browser supports FCM
    if (!isSupported()) {
      console.warn('Firebase Messaging is not supported in this browser');
      return null;
    }

    // Initialize Firebase only once
    if (!app) {
      app = getApps().length === 0 
        ? initializeApp(firebaseConfig) 
        : getApps()[0];
    }

    // Get Messaging instance
    if (!messaging) {
      messaging = getMessaging(app);
    }

    return messaging;
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    return null;
  }
}

/**
 * Check if browser supports FCM
 */
export function isSupported(): boolean {
  return (
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    IsSupportedBrowser()
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
    // Check support first
    if (!isSupported()) {
      return { success: false, error: 'المتصفح لا يدعم الإشعارات' };
    }

    // Request permission
    const permission = await Notification.requestPermission();
    
    if (permission !== 'granted') {
      return { success: false, error: 'تم رفض إذن الإشعارات' };
    }

    // Initialize Firebase
    const messagingInstance = await initializeFirebase();
    if (!messagingInstance) {
      return { success: false, error: 'فشل في تهيئة Firebase' };
    }

    // Register service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    
    // Get FCM token
    const token = await getToken(messagingInstance, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      return { success: false, error: 'فشل في الحصول على رمز الإشعارات' };
    }

    return { success: true, token };
  } catch (error: any) {
    console.error('Error getting FCM token:', error);
    return { success: false, error: error.message || 'حدث خطأ غير متوقع' };
  }
}

/**
 * Get current FCM token (if already exists)
 */
export async function getCurrentToken(): Promise<string | null> {
  try {
    if (!isSupported()) return null;

    const messagingInstance = await initializeFirebase();
    if (!messagingInstance) return null;

    const registration = await navigator.serviceWorker.ready;
    const token = await getToken(messagingInstance, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    return token || null;
  } catch (error) {
    console.error('Error getting current token:', error);
    return null;
  }
}

/**
 * Subscribe to foreground messages
 */
export function onForegroundMessage(callback: (payload: any) => void): () => void {
  const messagingInstance = initializeFirebase().then((msg) => {
    if (msg) {
      onMessage(msg, callback);
    }
  });
  
  // Return unsubscribe function
  return () => {
    // Cleanup function
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
