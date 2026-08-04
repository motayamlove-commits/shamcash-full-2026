import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
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

  // Check if notifications are supported
  const notificationsSupported = isSupported();

  // Check token status in database
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
      const { data, error } = await supabase
        .from('fcm_tokens')
        .select('id, is_active')
        .eq('admin_id', adminId)
        .eq('device_token', currentToken)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        setHasActiveToken(false);
        return false;
      }

      setHasActiveToken(true);

      // Update last_used_at
      await supabase
        .from('fcm_tokens')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', data.id);

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

  // Initialize on mount
  useEffect(() => {
    let active = true;
    let unsubscribe: () => void = () => undefined;

    if (!adminId) {
      setChecking(false);
      return () => {
        active = false;
      };
    }

    const init = async () => {
      setChecking(true);

      // Initialize Firebase
      await initializeFirebase();

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

      setChecking(false);
    };

    void init();

    return () => {
      active = false;
      unsubscribe();
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
