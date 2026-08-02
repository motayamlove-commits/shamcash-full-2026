/*
  # إنشاء جدول مستخدمي لوحة التحكم
  
  ## الوصف
  يخزن هذا الجدول بيانات اعتماد مسؤولي لوحة التحكم.
  - البريد الإلكتروني وكلمة المرور المشفرة
  - نظام الحماية من المحاولات الفاشلة (5 محاولات ثم حظر 1 ساعة)
*/

-- Create table
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name text NOT NULL DEFAULT 'مدير النظام',
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Policy for anonymous access (for login)
DO $$ 
BEGIN
    CREATE POLICY "anon_all_admin_users" ON admin_users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
EXCEPTION 
    WHEN duplicate_object THEN NULL;
END $$;

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_admin_users_updated_at ON admin_users;
CREATE TRIGGER update_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: ShamAdmin2024!)
-- Hash: SHA256(password + shamcash_salt_2024)
INSERT INTO admin_users (email, password_hash, name) 
VALUES (
  'admin@shamcash.sy',
  '6ea87b41ad85a432ee285686d5872c0d05f0e86815fc5f8f5712b264054b567a',
  'مدير النظام'
) ON CONFLICT (email) DO NOTHING;
