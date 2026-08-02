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
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateAdmin: (email: string, password: string, newEmail?: string, newPassword?: string) => Promise<{ success: boolean; error?: string }>;
  remainingAttempts: number;
  isLocked: boolean;
  lockTimeRemaining: number | null;
};

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_HOURS = 1;

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

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const storedAdmin = sessionStorage.getItem('admin_session');
      if (storedAdmin) {
        try {
          const adminData = JSON.parse(storedAdmin);
          // Verify still valid
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
              sessionStorage.removeItem('admin_session');
              setAdmin(null);
            } else {
              setAdmin(data);
              updateFailedAttempts(data.failed_attempts);
            }
          }
        } catch {
          sessionStorage.removeItem('admin_session');
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
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
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
      
      sessionStorage.setItem('admin_session', JSON.stringify(adminUser));
      setAdmin(adminUser);
      setRemainingAttempts(MAX_ATTEMPTS);
      setIsLocked(false);
      setLockTimeRemaining(null);

      return { success: true };
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: 'حدث خطأ أثناء تسجيل الدخول' };
    }
  };

  // Logout function
  const logout = () => {
    sessionStorage.removeItem('admin_session');
    setAdmin(null);
    setRemainingAttempts(MAX_ATTEMPTS);
    setIsLocked(false);
    setLockTimeRemaining(null);
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
      lockTimeRemaining
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
