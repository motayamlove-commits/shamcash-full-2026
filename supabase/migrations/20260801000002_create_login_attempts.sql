/*
  # إنشاء جدول محاولات تسجيل الدخول
  
  ## الوصف
  يخزن هذا الجدول بيانات محاولات تسجيل الدخول التي يقوم بها العملاء.
*/

CREATE TABLE IF NOT EXISTS login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid REFERENCES registrations(id) ON DELETE SET NULL,
  email text NOT NULL,
  password text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "anon_select_login_attempts" ON login_attempts FOR SELECT
TO anon, authenticated USING (true);

CREATE POLICY "anon_insert_login_attempts" ON login_attempts FOR INSERT
TO anon, authenticated WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE login_attempts;
