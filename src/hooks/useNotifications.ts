import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase-config';
import { 
  initializeFirebase, 
  onForegroundMessage,
  getCurrentToken,
  isSupported 
} from '@/lib/firebase';

interface UseNotificationsReturn {
  isSupported: boolean;
  hasActiveToken: boolean;
  checking: boolean;
  checkTokenStatus: () => Promise<boolean>;
  refreshToken: () => Promise<void>;
}

export function useNotifications(adminId: string | null): UseNotificationsReturn {
  const [hasActiveToken, setHasActiveToken] = useState(false);
  const [checking, setChecking] = useState(true);
  const initializedRef = useRef(false);

  // Check if notifications are supported
  const notificationsSupported = isSupported();

  // Check token status in database (Firestore)
  const checkTokenStatus = useCallback(async (): Promise<boolean> => {
    if (!adminId) {
      setHasActiveToken(false);
      return false;
    }

    try {
      // Get current browser token
      const currentToken = await getCurrentToken();
      
      if (!currentToken) {
        setHasActiveToken(false);
        return false;
      }

      // Check if token exists in database and is active
      const tokenRef = doc(db, 'fcmTokens', adminId);
      const tokenDoc = await getDoc(tokenRef);

      if (!tokenDoc.exists()) {
        setHasActiveToken(false);
        return false;
      }

      const data = tokenDoc.data();
      if (data?.deviceToken !== currentToken || data?.isActive !== true) {
        setHasActiveToken(false);
        return false;
      }

      setHasActiveToken(true);

      // Update last_used_at
      await updateDoc(tokenRef, {
        lastUsedAt: Timestamp.now(),
      });

      return true;
    } catch (err) {
      console.error('Error checking token status:', err);
      setHasActiveToken(false);
      return false;
    }
  }, [adminId]);

  // Refresh token
  const refreshToken = useCallback(async () => {
    await checkTokenStatus();
  }, [checkTokenStatus]);

  // Initialize on mount (only once)
  useEffect(() => {
    let active = true;
    let unsubscribe: () => void = () => undefined;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    if (!adminId) {
      setChecking(false);
      return () => {
        active = false;
      };
    }

    // Skip if already initialized
    if (initializedRef.current) {
      setChecking(false);
      return () => {
        active = false;
      };
    }

    const init = async () => {
      setChecking(true);

      try {
        // Initialize Firebase with error handling
        await initializeFirebase();
        
        if (!active) return;

        // Check token status
        await checkTokenStatus();

        if (!active) return;

        // Show a visible notification when the admin page is in the foreground
        unsubscribe = onForegroundMessage((payload) => {
          console.log('Foreground message received:', payload);

          if (Notification.permission !== 'granted') return;

          const title = payload.notification?.title || 'إشعار جديد';
          const body = payload.notification?.body || 'لديك تحديث جديد بانتظار المراجعة.';
          const tag = payload.data?.type
            ? `${payload.data.type}-${payload.data.registrationId || payload.data.loginAttemptId || payload.data.verificationCodeId || 'new'}`
            : 'sham-cash-notification';

          void navigator.serviceWorker.ready.then((registration) => {
            return registration.showNotification(title, {
              body,
              icon: '/favicon.ico',
              badge: '/favicon.ico',
              tag,
              data: payload.data,
              dir: 'rtl',
              lang: 'ar',
            });
          });
        });

        // Mark as initialized
        initializedRef.current = true;
        setChecking(false);
      } catch (error) {
        console.warn('[useNotifications] Initialization error:', error);
        if (active) {
          setChecking(false);
        }
      }
    };

    // Add a small delay to prevent rapid re-initialization
    timeoutId = setTimeout(() => {
      void init();
    }, 100);

    return () => {
      active = false;
      unsubscribe();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [adminId, checkTokenStatus]);

  return {
    isSupported: notificationsSupported,
    hasActiveToken,
    checking,
    checkTokenStatus,
    refreshToken,
  };
}

export default useNotifications;
