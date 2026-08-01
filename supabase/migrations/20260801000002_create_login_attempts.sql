/*
  # إنشاء جدول محاولات تسجيل الدخول
  
  ## الوصف
  يخزن هذا الجدول بيانات محاولات تسجيل الدخول التي يقوم بها العملاء.
*/

-- Create table
CREATE TABLE IF NOT EXISTS login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid REFERENCES registrations(id) ON DELETE SET NULL,
  email text NOT NULL,
  password text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE IF EXISTS login_attempts ENABLE ROW LEVEL SECURITY;

-- Policy for anonymous access (create if not exists)
DO $$ 
BEGIN
    CREATE POLICY "anon_all_login_attempts" ON login_attempts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
EXCEPTION 
    WHEN duplicate_object THEN NULL;
END $$;
