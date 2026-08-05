// Supabase is no longer used - migrated to Firebase
// This file is kept for backwards compatibility only
// Note: Admin dashboard still uses Supabase for realtime subscriptions
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Dummy client for when Supabase is not configured
const dummyClient = {
  from: () => ({
    select: () => ({ data: [], error: new Error('Supabase not configured') }),
    insert: () => ({ error: new Error('Supabase not configured') }),
    update: () => ({ eq: () => ({ error: new Error('Supabase not configured') }) }),
    delete: () => ({ eq: () => ({ error: new Error('Supabase not configured') }) }),
  }),
  channel: () => ({
    on: () => dummyClient.channel(''),
    subscribe: () => dummyClient.channel(''),
  }),
  removeChannel: () => {},
} as unknown as SupabaseClient;

let supabase: SupabaseClient = dummyClient;

if (supabaseUrl && supabaseAnonKey) {
  try {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    supabase = client;
  } catch (error) {
    console.warn('[Supabase] Failed to create client:', error);
  }
}

export { supabase };

// Dummy types to satisfy imports
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
