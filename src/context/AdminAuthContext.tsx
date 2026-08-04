import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  failed_attempts: number;
  locked_until: string | null;
};

type AdminAuthContextType = {
  admin: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateAdmin: (email: string, password: string, newEmail?: string, newPassword?: string) => Promise<{ success: boolean; error?: string }>;
  remainingAttempts: number;
  isLocked: boolean;
  lockTimeRemaining: number | null;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  checkNotificationsEnabled: () => Promise<boolean>;
};

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_HOURS = 1;
const SESSION_DURATION_DAYS = 7; // Session lasts 7 days if "Remember Me" is checked

// Storage keys
const ADMIN_SESSION_KEY = 'admin_session';
const ADMIN_TOKEN_KEY = 'admin_token';
const FCM_TOKEN_KEY = 'fcm_token';

// Simple password comparison (in production, use proper bcrypt on backend)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'shamcash_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function comparePassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [remainingAttempts, setRemainingAttempts] = useState(MAX_ATTEMPTS);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTimeRemaining, setLockTimeRemaining] = useState<number | null>(null);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      // First check localStorage, then sessionStorage (for backwards compatibility)
      const storedAdmin = localStorage.getItem(ADMIN_SESSION_KEY) || sessionStorage.getItem(ADMIN_SESSION_KEY);
      
      if (storedAdmin) {
        try {
          const adminData = JSON.parse(storedAdmin);
          
          // Check if session has expired
          if (adminData.expiresAt && new Date(adminData.expiresAt) < new Date()) {
            console.log('[Auth] Session expired, clearing...');
            localStorage.removeItem(ADMIN_SESSION_KEY);
            sessionStorage.removeItem(ADMIN_SESSION_KEY);
            setIsLoading(false);
            return;
          }
          
          // Verify still valid in database
          const { data } = await supabase
            .from('admin_users')
            .select('id, email, name, failed_attempts, locked_until')
            .eq('id', adminData.id)
            .single();
          
          if (data) {
            // Check if still logged in (not locked)
            if (data.locked_until && new Date(data.locked_until) > new Date()) {
              setIsLocked(true);
              updateLockTime(data.locked_until);
              localStorage.removeItem(ADMIN_SESSION_KEY);
              sessionStorage.removeItem(ADMIN_SESSION_KEY);
              setAdmin(null);
            } else {
              setAdmin(data);
              updateFailedAttempts(data.failed_attempts);
            }
          }
        } catch {
          localStorage.removeItem(ADMIN_SESSION_KEY);
          sessionStorage.removeItem(ADMIN_SESSION_KEY);
        }
      }
      setIsLoading(false);
    };
    
    checkSession();
  }, []);

  // Update lock time countdown
  const updateLockTime = useCallback((lockUntil: string) => {
    const update = () => {
      const now = new Date();
      const lockDate = new Date(lockUntil);
      const diff = lockDate.getTime() - now.getTime();
      
      if (diff <= 0) {
        setIsLocked(false);
        setLockTimeRemaining(null);
        return false;
      }
      
      setLockTimeRemaining(Math.ceil(diff / 1000));
      return true;
    };
    
    if (update()) {
      const interval = setInterval(() => {
        if (!update()) {
          clearInterval(interval);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, []);

  // Update remaining attempts
  const updateFailedAttempts = (attempts: number) => {
    const remaining = MAX_ATTEMPTS - attempts;
    setRemainingAttempts(Math.max(0, remaining));
    
    if (remaining <= 0) {
      setIsLocked(true);
    }
  };

  // Login function
  const login = async (email: string, password: string, rememberMe: boolean = true): Promise<{ success: boolean; error?: string }> => {
    try {
      // Check if already locked
      if (isLocked) {
        return { success: false, error: `تم تجاوز عدد المحاولات. يرجى الانتظار ${lockTimeRemaining} ثانية.` };
      }

      // Find admin by email
      const { data: adminData, error: fetchError } = await supabase
        .from('admin_users')
        .select('id, email, password_hash, name, failed_attempts, locked_until')
        .eq('email', email.toLowerCase().trim())
        .single();

      if (fetchError || !adminData) {
        // Increment failed attempts for non-existent user (for tracking)
        return { success: false, error: 'البريد الإلكتروني غير موجود' };
      }

      // Check if locked
      if (adminData.locked_until && new Date(adminData.locked_until) > new Date()) {
        setIsLocked(true);
        updateLockTime(adminData.locked_until);
        const remaining = Math.ceil((new Date(adminData.locked_until).getTime() - new Date().getTime()) / 1000);
        return { success: false, error: `تم تجاوز عدد المحاولات. يرجى الانتظار ${remaining} ثانية.` };
      }

      // Verify password
      const isValid = await comparePassword(password, adminData.password_hash);
      
      if (!isValid) {
        // Increment failed attempts
        const newAttempts = adminData.failed_attempts + 1;
        const shouldLock = newAttempts >= MAX_ATTEMPTS;
        const lockUntil = shouldLock 
          ? new Date(Date.now() + LOCK_DURATION_HOURS * 60 * 60 * 1000).toISOString()
          : null;

        await supabase
          .from('admin_users')
          .update({
            failed_attempts: newAttempts,
            locked_until: lockUntil
          })
          .eq('id', adminData.id);

        updateFailedAttempts(newAttempts);
        
        if (shouldLock) {
          setIsLocked(true);
          updateLockTime(lockUntil!);
          return { success: false, error: `تم تجاوز عدد المحاولات (${MAX_ATTEMPTS}). تم قفل الحساب لمدة ساعة.` };
        }

        const remaining = MAX_ATTEMPTS - newAttempts;
        return { success: false, error: `كلمة المرور غير صحيحة. ${remaining} محاولات متبقية.` };
      }

      // Login successful - reset failed attempts
      await supabase
        .from('admin_users')
        .update({
          failed_attempts: 0,
          locked_until: null
        })
        .eq('id', adminData.id);

      // Save session
      const adminUser: AdminUser = {
        id: adminData.id,
        email: adminData.email,
        name: adminData.name,
        failed_attempts: 0,
        locked_until: null
      };
      
      // Calculate expiration time
      const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const sessionData = { ...adminUser, expiresAt };
      
      // Save to localStorage (persists until cleared or expires)
      localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(sessionData));
      
      // Also save to sessionStorage as backup (cleared when browser closes)
      sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(sessionData));
      
      setAdmin(adminUser);
      setRemainingAttempts(MAX_ATTEMPTS);
      setIsLocked(false);
      setLockTimeRemaining(null);

      console.log('[Auth] Login successful, session expires:', expiresAt);
      return { success: true };
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: 'حدث خطأ أثناء تسجيل الدخول' };
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setAdmin(null);
    setRemainingAttempts(MAX_ATTEMPTS);
    setIsLocked(false);
    setLockTimeRemaining(null);
    console.log('[Auth] Logged out');
  };

  // Update admin credentials
  const updateAdmin = async (
    email: string, 
    password: string, 
    newEmail?: string, 
    newPassword?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!admin) {
        return { success: false, error: 'غير مصرح' };
      }

      // Find current admin
      const { data: adminData, error: fetchError } = await supabase
        .from('admin_users')
        .select('id, email, password_hash')
        .eq('id', admin.id)
        .single();

      if (fetchError || !adminData) {
        return { success: false, error: 'حدث خطأ في المصادقة' };
      }

      // Verify current password
      const isValid = await comparePassword(password, adminData.password_hash);
      if (!isValid) {
        return { success: false, error: 'كلمة المرور الحالية غير صحيحة' };
      }

      // Verify current email
      if (email !== adminData.email) {
        return { success: false, error: 'البريد الإلكتروني غير صحيح' };
      }

      // Prepare updates
      const updates: Record<string, string> = {};
      
      if (newEmail && newEmail !== adminData.email) {
        // Check if new email already exists
        const { data: existing } = await supabase
          .from('admin_users')
          .select('id')
          .eq('email', newEmail.toLowerCase().trim())
          .single();
        
        if (existing) {
          return { success: false, error: 'البريد الإلكتروني الجديد مستخدم بالفعل' };
        }
        updates.email = newEmail.toLowerCase().trim();
      }

      if (newPassword) {
        if (newPassword.length < 6) {
          return { success: false, error: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' };
        }
        updates.password_hash = await hashPassword(newPassword);
      }

      if (Object.keys(updates).length === 0) {
        return { success: false, error: 'لا توجد تغييرات' };
      }

      // Apply updates
      const { error: updateError } = await supabase
        .from('admin_users')
        .update(updates)
        .eq('id', admin.id);

      if (updateError) {
        return { success: false, error: 'حدث خطأ أثناء تحديث البيانات' };
      }

      // Update session if email changed
      if (updates.email) {
        const updatedAdmin = { ...admin, email: updates.email };
        sessionStorage.setItem('admin_session', JSON.stringify(updatedAdmin));
        setAdmin(updatedAdmin);
      }

      return { success: true };
    } catch (err) {
      console.error('Update error:', err);
      return { success: false, error: 'حدث خطأ أثناء تحديث البيانات' };
    }
  };

  // Set notifications enabled state
  const setNotificationsEnabled = (enabled: boolean) => {
    setNotificationsEnabledState(enabled);
    if (enabled) {
      localStorage.setItem('notifications_enabled', 'true');
    } else {
      localStorage.removeItem('notifications_enabled');
    }
  };

  // Check if notifications are enabled for this admin
  const checkNotificationsEnabled = async (): Promise<boolean> => {
    if (!admin) {
      setNotificationsEnabledState(false);
      return false;
    }

    try {
      // Check if we have an FCM token for this browser
      const { getCurrentToken, initializeFirebase } = await import('@/lib/firebase');
      
      // Initialize Firebase
      await initializeFirebase();
      
      // Get current token
      const currentToken = await getCurrentToken();
      
      if (!currentToken) {
        // No token - notifications not enabled
        console.log('[Notifications] No FCM token found for this browser');
        setNotificationsEnabledState(false);
        return false;
      }

      // Check if this token exists in database for this admin
      const { data, error } = await supabase
        .from('fcm_tokens')
        .select('id, is_active')
        .eq('admin_id', admin.id)
        .eq('device_token', currentToken)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        // Token not in database - notifications not enabled
        console.log('[Notifications] Token not found in database');
        setNotificationsEnabledState(false);
        return false;
      }

      // Token exists and is active - notifications enabled
      console.log('[Notifications] Token found and active');
      setNotificationsEnabledState(true);
      return true;
    } catch (err) {
      console.error('[Notifications] Error checking notifications:', err);
      setNotificationsEnabledState(false);
      return false;
    }
  };

  return (
    <AdminAuthContext.Provider value={{
      admin,
      isAuthenticated: admin !== null && !isLocked,
      isLoading,
      login,
      logout,
      updateAdmin,
      remainingAttempts,
      isLocked,
      lockTimeRemaining,
      notificationsEnabled,
      setNotificationsEnabled,
      checkNotificationsEnabled,
    }}>
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
