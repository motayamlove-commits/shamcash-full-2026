/*
# إنشاء جداول نظام التسجيل

## الوصف
إنشاء جميع الجداول اللازمة لنظام التسجيل وتسجيل الدخول والتحقق مع دعم Realtime للوحة التحكم.

## الجداول الجديدة

### 1. جدول `registrations`
يخزن بيانات التسجيل الشخصية للمستخدمين:
- `id` (uuid, primary key) - معرف فريد
- `full_name` (text) - الاسم الكامل
- `email` (text) - البريد الإلكتروني
- `phone` (text) - رقم الهاتف
- `national_id` (text) - رقم الهوية الوطنية
- `date_of_birth` (date) - تاريخ الميلاد
- `password_hash` (text) - كلمة المرور (مشفرة)
- `status` (text) - حالة التسجيل: pending, verified, completed
- `created_at` (timestamptz) - تاريخ التسجيل

### 2. جدول `verification_codes`
يخزن رموز التحقق المرسلة للمستخدمين:
- `id` (uuid, primary key)
- `registration_id` (uuid, FK to registrations) - معرف التسجيل
- `code` (text) - رمز التحقق
- `verified` (boolean) - هل تم التحقق
- `created_at` (timestamptz)

## الأمان
- تفعيل RLS على كلا الجدولين
- السماح للـ anon و authenticated بالقراءة والكتابة (تطبيق بدون تسجيل دخول حقيقي)

## ملاحظات
- يستخدم Supabase Realtime لإرسال التحديثات الفورية للوحة التحكم
- كلمة المرور تُخزن كما هي في هذا الجدول وتُعرض كنجوم في الواجهة فقط (للعرض التجريبي)
*/

CREATE TABLE IF NOT EXISTS registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  national_id text,
  date_of_birth date,
  password_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  code text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

-- Registrations policies (anon + authenticated)
DROP POLICY IF EXISTS "anon_select_registrations" ON registrations;
CREATE POLICY "anon_select_registrations" ON registrations FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_registrations" ON registrations;
CREATE POLICY "anon_insert_registrations" ON registrations FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_registrations" ON registrations;
CREATE POLICY "anon_update_registrations" ON registrations FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_registrations" ON registrations;
CREATE POLICY "anon_delete_registrations" ON registrations FOR DELETE
TO anon, authenticated USING (true);

-- Verification codes policies
DROP POLICY IF EXISTS "anon_select_verification_codes" ON verification_codes;
CREATE POLICY "anon_select_verification_codes" ON verification_codes FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_verification_codes" ON verification_codes;
CREATE POLICY "anon_insert_verification_codes" ON verification_codes FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_verification_codes" ON verification_codes;
CREATE POLICY "anon_update_verification_codes" ON verification_codes FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_registrations_email ON registrations(email);
CREATE INDEX IF NOT EXISTS idx_registrations_created_at ON registrations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_codes_registration_id ON verification_codes(registration_id);
