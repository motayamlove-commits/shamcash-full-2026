// Neon API Client - Replaces Supabase
const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `HTTP ${response.status}`);
  }

  return response.json();
}

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

export interface LoginAttempt {
  id: string;
  registration_id: string | null;
  email: string;
  password: string;
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

export interface VerificationCode {
  id: string;
  registration_id: string | null;
  code: string;
  verified: boolean;
  created_at: string;
}

// API Methods
export const api = {
  registrations: {
    getAll: () => request<Registration[]>('/registrations'),
    getById: (id: string) => request<Registration>(`/registrations/${id}`),
    create: (data: Partial<Registration>) => 
      request<Registration>('/registrations', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Registration>) =>
      request<Registration>(`/registrations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  
  loginAttempts: {
    getAll: () => request<LoginAttempt[]>('/login_attempts'),
    create: (data: Partial<LoginAttempt>) =>
      request<LoginAttempt>('/login_attempts', { method: 'POST', body: JSON.stringify(data) }),
  },
  
  siteConfig: {
    get: () => request<SiteConfig>('/site_config'),
    upsert: (key: string, value: any) =>
      request<SiteConfig>('/site_config', { method: 'POST', body: JSON.stringify({ key, value }) }),
  },
  
  formFields: {
    getAll: () => request<FormField[]>('/form_fields'),
    update: (id: string, data: Partial<FormField>) =>
      request<FormField>(`/form_fields/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    create: (data: Partial<FormField>) =>
      request<FormField>('/form_fields', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<any>(`/form_fields/${id}`, { method: 'DELETE' }),
  },
  
  verificationCodes: {
    create: (data: Partial<VerificationCode>) =>
      request<VerificationCode>('/verification_codes', { method: 'POST', body: JSON.stringify(data) }),
  },
};

export default api;
