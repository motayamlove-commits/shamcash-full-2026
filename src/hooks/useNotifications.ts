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
    if (!adminId) {
      setChecking(false);
      return;
    }

    const init = async () => {
      setChecking(true);
      
      // Initialize Firebase
      await initializeFirebase();
      
      // Check token status
      await checkTokenStatus();
      
      // Subscribe to foreground messages
      const unsubscribe = onForegroundMessage((payload) => {
        console.log('Foreground message received:', payload);
      });

      setChecking(false);

      return () => {
        unsubscribe();
      };
    };

    init();
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
