/**
 * Migration System - Migrated from Supabase to Firebase
 * 
 * This file is now a placeholder since we use Firebase instead of Supabase.
 * The actual data seeding is handled by setup-firebase.js
 */

type MigrationResult = {
  success: boolean;
  message: string;
  errors: string[];
};

export async function runMigrations(): Promise<{
  success: boolean;
  results: MigrationResult[];
}> {
  console.log('[Migration] Using Firebase - no Supabase migrations needed');
  
  return {
    success: true,
    results: [{
      success: true,
      message: 'Migrations skipped - using Firebase instead of Supabase',
      errors: [],
    }],
  };
}

export function getDefaultCMSData() {
  return {
    site_config: [],
    form_fields: [],
    admin_user: null,
  };
}
