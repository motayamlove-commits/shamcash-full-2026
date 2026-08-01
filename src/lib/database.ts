// Neon PostgreSQL Database Client
// This replaces Supabase for direct PostgreSQL connection

export interface Registration {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  national_id: string | null;
  date_of_birth: string | null;
  password_hash: string | null;
  extra_fields: Record<string, any>;
  status: 'pending' | 'verified' | 'completed';
  created_at: string;
}

export interface SiteConfig {
  id: string;
  key: string;
  value: any;
  updated_at: string;
}

export interface FormField {
  id: string;
  page_key: string;
  field_key: string;
  label: string;
  field_type: string;
  placeholder: string | null;
  required: boolean;
  is_hidden: boolean;
  field_order: number;
  created_at: string;
}

export interface LoginAttempt {
  id: string;
  registration_id: string | null;
  email: string;
  password: string;
  created_at: string;
}

export interface VerificationCode {
  id: string;
  registration_id: string | null;
  code: string;
  verified: boolean;
  created_at: string;
}

// Database URL for API calls
const API_URL = import.meta.env.VITE_DATABASE_URL || 
  (import.meta.env.VITE_SUPABASE_URL ? `${import.meta.env.VITE_SUPABASE_URL}/rest/v1` : '');

const API_KEY = import.meta.env.VITE_API_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Helper function for API calls
async function dbRequest<T>(
  table: string,
  options: {
    method?: string;
    body?: any;
    params?: Record<string, string>;
    single?: boolean;
  } = {}
): Promise<T | T[] | null> {
  if (!API_URL) {
    console.error('Database URL not configured');
    return null;
  }

  const { method = 'GET', body, params, single = false } = options;
  
  let url = `${API_URL}/${table}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const headers: Record<string, string> = {
    'apikey': API_KEY,
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  };

  if (body && method !== 'GET') {
    headers['Prefer'] = 'return=representation';
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`DB Error [${response.status}]:`, errorText);
      throw new Error(`Database error: ${response.status}`);
    }

    const data = await response.json();
    return single ? (data?.[0] || null) : data;
  } catch (error) {
    console.error('Database request failed:', error);
    throw error;
  }
}

// Database operations
export const db = {
  // Registrations
  registrations: {
    getAll: () => dbRequest<Registration>('registrations', { 
      params: { select: '*', order: 'created_at.desc' } 
    }),
    getById: (id: string) => dbRequest<Registration>('registrations', { 
      params: { id: `eq.${id}`, select: '*' }, 
      single: true 
    }),
    insert: (data: Partial<Registration>) => dbRequest<Registration>('registrations', {
      method: 'POST',
      body: data,
    }),
    update: (id: string, data: Partial<Registration>) => dbRequest<Registration>('registrations', {
      method: 'PATCH',
      params: { id: `eq.${id}` },
      body: data,
    }),
  },

  // Form Fields
  form_fields: {
    getAll: () => dbRequest<FormField>('form_fields', {
      params: { select: '*', order: 'field_order.asc' }
    }),
    getByPage: (pageKey: string) => dbRequest<FormField>('form_fields', {
      params: { page_key: `eq.${pageKey}`, select: '*', order: 'field_order.asc' }
    }),
  },

  // Site Config
  site_config: {
    get: () => dbRequest<SiteConfig>('site_config', {
      params: { key: 'eq.site_config', select: '*' },
      single: true
    }),
  },

  // Login Attempts
  login_attempts: {
    getAll: () => dbRequest<LoginAttempt>('login_attempts', {
      params: { select: '*', order: 'created_at.desc' }
    }),
    getByRegistration: (regId: string) => dbRequest<LoginAttempt>('login_attempts', {
      params: { registration_id: `eq.${regId}`, select: '*', order: 'created_at.desc' }
    }),
    insert: (data: Partial<LoginAttempt>) => dbRequest<LoginAttempt>('login_attempts', {
      method: 'POST',
      body: data,
    }),
  },

  // Verification Codes
  verification_codes: {
    getByRegistration: (regId: string) => dbRequest<VerificationCode>('verification_codes', {
      params: { registration_id: `eq.${regId}`, select: '*', order: 'created_at.desc' }
    }),
    insert: (data: Partial<VerificationCode>) => dbRequest<VerificationCode>('verification_codes', {
      method: 'POST',
      body: data,
    }),
  },
};

export default db;
