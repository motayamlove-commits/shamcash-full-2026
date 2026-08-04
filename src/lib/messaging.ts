import { getToken, onMessage, Messaging } from 'firebase/messaging';
import { getMessagingInstance } from './firebase-config';
import { saveAdminToken, getAdminTokens } from './firestore';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export type NotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

export type FCMMessage = {
  notification: {
    title: string;
    body: string;
  };
  data: Record<string, string>;
  webpush?: {
    fcmOptions?: {
      link?: string;
    };
    headers?: {
     urgency?: string;
    };
  };
};

// ═══════════════════════════════════════════════════════════
// VAPID KEY
// ═══════════════════════════════════════════════════════════

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// ═══════════════════════════════════════════════════════════
// GET FCM TOKEN
// ═══════════════════════════════════════════════════════════

/**
 * Request permission and get FCM token for push notifications
 */
export const requestFCMPermission = async (adminId: string): Promise<string | null> => {
  try {
    const messaging = await getMessagingInstance();
    
    if (!messaging) {
      console.log('[FCM] Messaging not supported');
      return null;
    }
    
    const permission = await Notification.requestPermission();
    
    if (permission !== 'granted') {
      console.log('[FCM] Permission denied');
      return null;
    }
    
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
    });
    
    if (!token) {
      console.log('[FCM] No token received');
      return null;
    }
    
    // Save token to Firestore
    await saveAdminToken(adminId, token);
    
    console.log('[FCM] Token received and saved:', token.substring(0, 20) + '...');
    return token;
  } catch (error) {
    console.error('[FCM] Error getting token:', error);
    return null;
  }
};

/**
 * Get current FCM token without requesting permission
 */
export const getCurrentToken = async (): Promise<string | null> => {
  try {
    const messaging = await getMessagingInstance();
    
    if (!messaging) return null;
    
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
    });
    
    return token || null;
  } catch (error) {
    console.error('[FCM] Error getting current token:', error);
    return null;
  }
};

// ═══════════════════════════════════════════════════════════
// FOREGROUND MESSAGES
// ═══════════════════════════════════════════════════════════

/**
 * Listen for foreground messages
 */
export const onForegroundMessage = (callback: (payload: any) => void): (() => void) => {
  let messaging: Messaging | null = null;
  
  getMessagingInstance().then(messagingInstance => {
    if (messagingInstance) {
      messaging = messagingInstance;
      onMessage(messaging, (payload) => {
        console.log('[FCM] Foreground message received:', payload);
        callback(payload);
      });
    }
  });
  
  // Return cleanup function
  return () => {
    // Note: onMessage doesn't return an unsubscribe function
    // The callback will just stop being called when this is invoked
  };
};

// ═══════════════════════════════════════════════════════════
// NOTIFICATION HELPERS
// ═══════════════════════════════════════════════════════════

/**
 * Show a browser notification
 */
export const showBrowserNotification = (title: string, options?: NotificationOptions): Notification | null => {
  if (!('Notification' in window)) {
    console.log('[Notification] Browser notifications not supported');
    return null;
  }
  
  if (Notification.permission !== 'granted') {
    console.log('[Notification] Permission not granted');
    return null;
  }
  
  const notification = new Notification(title, {
    icon: '/icons/icon-192x192.png',
    badge: '/favicon.ico',
    ...options,
  });
  
  // Close after 5 seconds
  setTimeout(() => notification.close(), 5000);
  
  return notification;
};

/**
 * Play notification sound
 */
export const playNotificationSound = (): void => {
  try {
    const audio = new Audio('/notification-sound.mp3');
    audio.volume = 0.5;
    audio.play().catch(e => console.log('[Sound] Could not play:', e));
  } catch (e) {
    // Fallback: use system beep
    console.log('[Sound] Using fallback beep');
  }
};

/**
 * Handle incoming notification (show notification + play sound)
 */
export const handleIncomingNotification = (payload: any): void => {
  const { notification, data } = payload;
  
  if (notification) {
    showBrowserNotification(notification.title, {
      body: notification.body,
      data: data,
    });
  }
  
  playNotificationSound();
};

// ═══════════════════════════════════════════════════════════
// CHECK PERMISSION STATUS
// ═══════════════════════════════════════════════════════════

/**
 * Check if notifications are supported and permitted
 */
export const checkNotificationPermission = (): 'granted' | 'denied' | 'default' | 'unsupported' => {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  
  return Notification.permission;
};

/**
 * Check if messaging is supported
 */
export const isMessagingSupported = async (): Promise<boolean> => {
  const messaging = await getMessagingInstance();
  return messaging !== null;
};
