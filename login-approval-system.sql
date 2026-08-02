-- جدول تتبع محاولات تسجيل الدخول
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  registration_id UUID REFERENCES registrations(id),
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  approved_by UUID,
  rejected_by UUID
);

-- Index للبحث السريع
CREATE INDEX IF NOT EXISTS idx_login_attempts_client_id ON login_attempts(client_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_status ON login_attempts(status);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created ON login_attempts(created_at DESC);

-- تفعيل Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE login_attempts;
