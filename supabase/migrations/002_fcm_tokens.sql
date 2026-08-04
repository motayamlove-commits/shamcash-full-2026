-- Migration: Add FCM tokens table for push notifications
-- Description: Stores device tokens for admin push notifications

-- Create FCM tokens table
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL,
  device_name TEXT,
  device_type TEXT CHECK (device_type IN ('desktop', 'android', 'ios')),
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique index on token + admin_id
CREATE UNIQUE INDEX IF NOT EXISTS fcm_tokens_admin_token_idx 
ON fcm_tokens(admin_id, device_token);

-- Create index for active tokens lookup
CREATE INDEX IF NOT EXISTS fcm_tokens_admin_active_idx 
ON fcm_tokens(admin_id) WHERE is_active = true;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_fcm_tokens_updated_at
  BEFORE UPDATE ON fcm_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Allow anon to read/write (for now - in production, restrict to authenticated)
DO $$ 
BEGIN
  -- Create policy for all operations
  CREATE POLICY "fcm_tokens_all" ON fcm_tokens 
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Insert sample data for testing (optional - remove in production)
-- INSERT INTO fcm_tokens (admin_id, device_token, device_name, device_type)
-- SELECT id, 'TEST_TOKEN', 'Test Device', 'desktop'
-- FROM admin_users LIMIT 1;
