import { useState, useEffect, useCallback } from 'react';
import { 
  getAllUsers, 
  subscribeToUsers,
  getAllLoginAttempts,
  subscribeToLoginAttempts,
  UserProfile,
  LoginAttempt,
} from '@/lib/firestore';

// Transform Firestore data to match AdminPage format
type AdminRegistration = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  national_id: string;
  date_of_birth: string;
  status: 'pending' | 'verified' | 'completed';
  created_at: string;
  client_id?: string;
  _new?: boolean;
  login_attempts?: any[];
  verification_codes?: any[];
};

type AdminLoginAttempt = {
  id: string;
  registration_id: string | null;
  client_id: string | null;
  email: string;
  password: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
};

function transformUser(user: UserProfile): AdminRegistration {
  console.log('[transformUser] Original user data:', JSON.stringify(user, null, 2));
  
  return {
    id: user.id,
    full_name: user.fullName || '',
    email: user.email || '',
    phone: user.phone || '',
    national_id: user.nationalId || '',
    date_of_birth: user.dateOfBirth || '',
    status: user.status || 'pending',
    created_at: user.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    client_id: user.clientId,
  };
}

function transformLoginAttempt(login: LoginAttempt): AdminLoginAttempt {
  return {
    id: login.id,
    registration_id: login.userId || null,
    client_id: login.clientId || null,
    email: login.email || '',
    password: '',
    status: login.status || 'pending',
    created_at: login.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    updated_at: login.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
  };
}

type FirestoreAdminData = {
  registrations: AdminRegistration[];
  loginAttempts: AdminLoginAttempt[];
  loading: boolean;
  error: string | null;
};

export function useFirestoreAdmin(): FirestoreAdminData & {
  refresh: () => Promise<void>;
} {
  const [registrations, setRegistrations] = useState<AdminRegistration[]>([]);
  const [loginAttempts, setLoginAttempts] = useState<AdminLoginAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all data
  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch registrations (users)
      const users = await getAllUsers();
      setRegistrations(users.map(transformUser));

      // Fetch login attempts
      const logins = await getAllLoginAttempts();
      setLoginAttempts(logins.map(transformLoginAttempt));

      setLoading(false);
    } catch (err: any) {
      console.error('[useFirestoreAdmin] Error fetching data:', err);
      setError(err.message || 'Failed to fetch data');
      setLoading(false);
    }
  }, []);

  // Subscribe to realtime updates
  useEffect(() => {
    let isActive = true;
    let unsubUsers: (() => void) | null = null;
    let unsubLogins: (() => void) | null = null;

    const init = async () => {
      // Initial fetch
      await refresh();

      if (!isActive) return;

      // Subscribe to users (registrations) changes
      unsubUsers = subscribeToUsers((users) => {
        if (isActive) {
          setRegistrations(users.map(transformUser));
        }
      });

      // Subscribe to login attempts changes
      unsubLogins = subscribeToLoginAttempts((logins) => {
        if (isActive) {
          setLoginAttempts(logins.map(transformLoginAttempt));
        }
      });
    };

    init();

    return () => {
      isActive = false;
      unsubUsers?.();
      unsubLogins?.();
    };
  }, [refresh]);

  return {
    registrations,
    loginAttempts,
    loading,
    error,
    refresh,
  };
}

export default useFirestoreAdmin;
