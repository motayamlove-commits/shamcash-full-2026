/**
 * Firebase Cloud Messaging (FCM) Configuration
 * Sham Cash - Push Notifications System
 * 
 * Note: Firebase Messaging is disabled because Firebase Auth is not available.
 * All functions return null/empty values to prevent errors.
 */

// VAPID Key for Web Push (not used since messaging is disabled)
export const VAPID_KEY = '';

/**
 * Initialize Firebase and get Messaging instance
 * Note: Returns null because Firebase Auth is not available
 */
export async function initializeFirebase(): Promise<null> {
  console.log('[Firebase] initializeFirebase - Firebase Auth not available, skipping');
  return null;
}

/**
 * Check if browser supports FCM
 */
export function isSupported(): boolean {
  return false; // Disabled since Firebase Auth is not available
}

/**
 * Request notification permission and get FCM token
 */
export async function requestPermissionAndGetToken(): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> {
  return { success: false, error: 'Firebase Auth is not available' };
}

/**
 * Get current FCM token (if already exists)
 */
export async function getCurrentToken(): Promise<string | null> {
  return null;
}

/**
 * Subscribe to foreground messages
 */
export function onForegroundMessage(callback: (payload: any) => void): () => void {
  return () => {}; // No-op since messaging is disabled
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
