-- 1. Registrations Table
CREATE TABLE IF NOT EXISTS registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text,
  email text,
  phone text,
  national_id text,
  date_of_birth date,
  password_hash text,
  extra_fields jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Verification Codes Table
CREATE TABLE IF NOT EXISTS verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid REFERENCES registrations(id) ON DELETE CASCADE,
  code text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Site Config Table
CREATE TABLE IF NOT EXISTS site_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- 4. Form Fields Table
CREATE TABLE IF NOT EXISTS form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL,
  field_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL,
  placeholder text,
  required boolean DEFAULT false,
  is_hidden boolean DEFAULT false,
  field_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(page_key, field_key)
);

-- 5. Login Attempts Table
CREATE TABLE IF NOT EXISTS login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid REFERENCES registrations(id) ON DELETE SET NULL,
  email text NOT NULL,
  password text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS for all tables
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- Simple permissive policies for demo/prototype
DO $$ 
BEGIN
    EXECUTE 'CREATE POLICY anon_all_registrations ON registrations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY anon_all_ver_codes ON verification_codes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY anon_all_site_config ON site_config FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY anon_all_form_fields ON form_fields FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY anon_all_login_attempts ON login_attempts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Enable Realtime
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
COMMIT;
