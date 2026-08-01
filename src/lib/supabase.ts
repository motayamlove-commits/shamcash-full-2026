import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Registration = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  national_id: string | null;
  date_of_birth: string | null;
  password_hash: string | null;
  status: 'pending' | 'verified' | 'completed';
  created_at: string;
};
