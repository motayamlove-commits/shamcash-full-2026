-- إضافة أعمدة للتحقق من الرمز
ALTER TABLE verification_codes ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;
ALTER TABLE verification_codes ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE verification_codes ADD COLUMN IF NOT EXISTS verified_by UUID;

-- إضافة Status للتحكم بالحالة
ALTER TABLE verification_codes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));
