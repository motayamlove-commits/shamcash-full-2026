import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AdminUser, signInAdmin, signOutAdmin, onAuthChange } from '@/lib/firebase-auth';
import { saveAdminToken } from '@/lib/firestore';

type AdminAuthContextType = {
  admin: AdminUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkNotificationsEnabled: () => Promise<boolean>;
  setNotificationsEnabled: (enabled: boolean) => void;
  notificationsEnabled: boolean;
};

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const NOTIFICATIONS_KEY = 'admin_notifications_enabled';

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(false);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      setAdmin(user);
      setIsLoading(false);
      
      // If user is logged in, check notifications status
      if (user) {
        const stored = localStorage.getItem(NOTIFICATIONS_KEY);
        if (stored === 'true') {
          setNotificationsEnabledState(true);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Save FCM token when admin logs in
  useEffect(() => {
    if (admin && notificationsEnabled) {
      // Request FCM token and save to Firestore
      import('@/lib/messaging').then(({ requestFCMPermission }) => {
        requestFCMPermission(admin.uid).then(token => {
          if (token) {
            console.log('[AdminAuth] FCM token saved');
          }
        });
      });
    }
  }, [admin, notificationsEnabled]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const user = await signInAdmin(email, password);
      setAdmin(user);
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    await signOutAdmin();
    setAdmin(null);
    setNotificationsEnabledState(false);
  };

  const checkNotificationsEnabled = async (): Promise<boolean> => {
    return notificationsEnabled;
  };

  const setNotificationsEnabled = (enabled: boolean) => {
    setNotificationsEnabledState(enabled);
    localStorage.setItem(NOTIFICATIONS_KEY, String(enabled));
  };

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        isLoading,
        isAuthenticated: !!admin,
        login,
        logout,
        checkNotificationsEnabled,
        setNotificationsEnabled,
        notificationsEnabled,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  
  return context;
}
