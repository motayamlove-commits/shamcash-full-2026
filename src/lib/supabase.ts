// Supabase is no longer used - migrated to Firebase
// This file is kept for backwards compatibility only
export const supabase = null;

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
