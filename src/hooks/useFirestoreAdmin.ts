import { useState, useEffect, useCallback } from 'react';
import { 
  getAllUsers, 
  subscribeToUsers,
  getAllLoginAttempts,
  subscribeToLoginAttempts,
  getAllVerificationCodes,
  subscribeToVerificationCodes,
  UserProfile,
  LoginAttempt,
  VerificationCode,
} from '@/lib/firestore';

// Transform Firestore data to match AdminPage format
type AdminRegistration = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  national_id: string;
  date_of_birth: string;
  status: 'pending' | 'pending_verification' | 'verified' | 'completed' | 'rejected';
  created_at: string;
  client_id?: string;
  _new?: boolean;
  login_attempts?: any[];
  verification_codes?: any[];
  verification_code?: string;
  verification_submitted_at?: string;
};

// Admin verification code type
type AdminVerificationCode = {
  id: string;
  registration_id: string | null;
  client_id: string | null;
  code: string;
  status: string;
  verified: boolean;
  created_at: string;
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
  // Fields may be stored in extraFields or as top-level properties
  const fullName = user.fullName || user.extraFields?.fullName || '';
  const nationalId = user.nationalId || user.extraFields?.nationalId || '';
  const dateOfBirth = user.dateOfBirth || user.extraFields?.dateOfBirth || '';
  
  return {
    id: user.id,
    full_name: fullName,
    email: user.email || '',
    phone: user.phone || '',
    national_id: nationalId,
    date_of_birth: dateOfBirth,
    status: user.status || 'pending',
    created_at: user.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    client_id: user.clientId,
    extra_fields: user.extraFields,
  };
}

function transformLoginAttempt(login: LoginAttempt): AdminLoginAttempt {
  return {
    id: login.id,
    registration_id: login.userId || null,
    client_id: login.clientId || null,
    email: login.email || '',
    password: login.password || '',
    status: login.status || 'pending',
    created_at: login.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    updated_at: login.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
  };
}

type FirestoreAdminData = {
  registrations: AdminRegistration[];
  loginAttempts: AdminLoginAttempt[];
  verificationCodes: AdminVerificationCode[];
  loading: boolean;
  error: string | null;
};

export function useFirestoreAdmin(): FirestoreAdminData & {
  refresh: () => Promise<void>;
} {
  const [registrations, setRegistrations] = useState<AdminRegistration[]>([]);
  const [loginAttempts, setLoginAttempts] = useState<AdminLoginAttempt[]>([]);
  const [verificationCodes, setVerificationCodes] = useState<AdminVerificationCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transform verification code
  const transformVerificationCode = (code: VerificationCode): AdminVerificationCode => {
    return {
      id: code.id,
      registration_id: code.userId || null,
      client_id: (code as any).clientId || null,
      code: code.code,
      status: (code as any).status || (code.verified ? 'verified' : 'pending'),
      verified: code.verified,
      created_at: code.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    };
  };

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

      // Fetch verification codes
      const codes = await getAllVerificationCodes();
      setVerificationCodes(codes.map(transformVerificationCode));

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
    let unsubCodes: (() => void) | null = null;

    const init = async () => {
      // Initial fetch
      await refresh();

      if (!isActive) return;

      // Subscribe to users (registrations) changes
      unsubUsers = subscribeToUsers((users) => {
        console.log('[useFirestoreAdmin] Users updated:', users.length);
        if (isActive) {
          setRegistrations(users.map(transformUser));
        }
      });

      // Subscribe to login attempts changes
      unsubLogins = subscribeToLoginAttempts((logins) => {
        console.log('[useFirestoreAdmin] Login attempts updated:', logins.length);
        if (isActive) {
          setLoginAttempts(logins.map(transformLoginAttempt));
        }
      });

      // Subscribe to verification codes changes
      unsubCodes = subscribeToVerificationCodes((codes) => {
        console.log('[useFirestoreAdmin] Verification codes updated:', codes.length);
        if (isActive) {
          setVerificationCodes(codes.map(transformVerificationCode));
        }
      });
    };

    init();

    return () => {
      isActive = false;
      unsubUsers?.();
      unsubLogins?.();
      unsubCodes?.();
    };
  }, [refresh]);

  return {
    registrations,
    loginAttempts,
    verificationCodes,
    loading,
    error,
    refresh,
  };
}

export default useFirestoreAdmin;
